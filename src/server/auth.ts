import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { failure, json, readJson, readText } from './http.ts';
import { z } from 'zod';

export type Auth = {
  origin: string;
  configured: boolean;
  authorize(request: Request, context: 'web' | 'mcp'): Promise<boolean>;
  handle(request: Request, path: string): Promise<Response | undefined>;
  mcpChallenge: string;
};

export type CognitoConfig = {
  app: string; domain: string; poolId: string; webClient: string;
  mcpClient: string; mcpRedirect: string; mcpScope: string; mcpEnabled: boolean;
};
const cookieName = '__Secure-planestudio';
const secureCookie = 'Path=/PlanEstudio/api; HttpOnly; Secure; SameSite=Strict';
const oauthError = (error: string, status: number) => json({ error }, status);
const exchangeInput = z.object({
  code: z.string().min(5).max(2048), verifier: z.string().regex(/^[a-zA-Z0-9._~-]{43,128}$/)
});

export function devAuth(origin: string): Auth {
  return {
    origin, configured: false,
    async authorize(request, context) {
      return context === 'web' || request.headers.get('Authorization') === 'Bearer planestudio-local';
    },
    async handle(request, path) {
      if (path === '/api/auth/config' && request.method === 'GET') return json({ mode: 'local' });
      return undefined;
    },
    mcpChallenge: 'Bearer'
  };
}

export function cognitoAuth(config: CognitoConfig): Auth {
  const app = config.app.replace(/\/$/, '');
  const origin = new URL(app).origin;
  const resource = app + '/mcp';
  const discovery = origin + '/.well-known/oauth-protected-resource' + new URL(resource).pathname;
  const issuer = app + '/oauth';
  const callback = app + '/auth/callback/';
  const loginHost = config.domain.replace(/\/$/, '');
  const verifyWeb = CognitoJwtVerifier.create({ userPoolId: config.poolId, tokenUse: 'access', clientId: config.webClient });
  const verifyMcp = CognitoJwtVerifier.create({ userPoolId: config.poolId, tokenUse: 'access', clientId: config.mcpClient || null, scope: config.mcpScope });

  async function verify(token: string, context: 'web' | 'mcp') {
    try {
      const payload = await (context === 'web' ? verifyWeb : verifyMcp).verify(token);
      const expectedAudience = context === 'web' ? app + '/api' : resource;
      return payload['planestudio_owner'] === 'true' && payload.aud === expectedAudience && Boolean(payload.sub);
    } catch { return false; }
  }

  async function tokenRequest(parameters: URLSearchParams) {
    return fetch(loginHost + '/oauth2/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: parameters, signal: AbortSignal.timeout(12_000), redirect: 'error'
    });
  }

  return {
    origin, configured: true,
    async authorize(request, context) {
      if (context === 'mcp') {
        const header = request.headers.get('Authorization');
        return config.mcpEnabled && Boolean(header?.startsWith('Bearer ') && await verify(header.slice(7), 'mcp'));
      }
      const token = request.headers.get('Cookie')?.split(/;\s*/).find(item => item.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
      return Boolean(token && await verify(token, 'web'));
    },
    async handle(request, path) {
      if (path === '/api/auth/config' && request.method === 'GET') {
        return json({ mode: 'google', authorize: loginHost + '/oauth2/authorize', clientId: config.webClient, callback, resource: app + '/api' });
      }
      if (path === '/api/auth/token' && request.method === 'POST') {
        if (request.headers.get('Origin') !== origin) return failure('El origen de la solicitud no está autorizado.', 403);
        const body = exchangeInput.safeParse(await readJson(request));
        if (!body.success) return failure('Regresa al inicio y vuelve a iniciar sesión.', 400);
        const result = await tokenRequest(new URLSearchParams({
          grant_type: 'authorization_code', client_id: config.webClient, redirect_uri: callback,
          code: body.data.code, code_verifier: body.data.verifier
        }));
        if (!result.ok) return failure('Google no pudo completar el inicio de sesión.', 401);
        const data: { access_token?: string; expires_in?: number } = await result.json();
        if (!data.access_token || !(await verify(data.access_token, 'web'))) return failure('Esta cuenta no tiene acceso a PlanEstudio.', 403);
        const age = typeof data.expires_in === 'number' ? Math.min(data.expires_in, 28_800) : 3600;
        return json({ ok: true }, 200, { 'Set-Cookie': cookieName + '=' + data.access_token + '; Max-Age=' + age + '; ' + secureCookie });
      }
      if (path === '/api/auth/logout' && request.method === 'POST') {
        if (request.headers.get('Origin') !== origin) return failure('El origen de la solicitud no está autorizado.', 403);
        return json({ ok: true }, 200, { 'Set-Cookie': cookieName + '=; Max-Age=0; ' + secureCookie });
      }
      if (request.method === 'GET' && (path === '/.well-known/oauth-protected-resource/PlanEstudio/mcp' || path === '/api/oauth/protected-resource')) {
        return json({ resource, authorization_servers: [issuer], scopes_supported: [config.mcpScope], bearer_methods_supported: ['header'] });
      }
      if (request.method === 'GET' && (path === '/.well-known/oauth-authorization-server/PlanEstudio/oauth' || path === '/oauth/.well-known/oauth-authorization-server')) {
        return json({
          issuer, authorization_endpoint: issuer + '/authorize', token_endpoint: issuer + '/token',
          jwks_uri: 'https://cognito-idp.' + config.poolId.split('_')[0] + '.amazonaws.com/' + config.poolId + '/.well-known/jwks.json',
          scopes_supported: [config.mcpScope], response_types_supported: ['code'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
          code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none']
        });
      }
      if (!config.mcpEnabled) return undefined;
      if (path === '/oauth/authorize' && request.method === 'GET') {
        const params = new URL(request.url).searchParams;
        if (params.get('client_id') !== config.mcpClient || params.get('redirect_uri') !== config.mcpRedirect || !config.mcpRedirect
          || params.get('response_type') !== 'code' || params.get('code_challenge_method') !== 'S256' || !params.get('state')
          || !/^[a-zA-Z0-9_-]{43}$/.test(params.get('code_challenge') ?? '') || (params.has('resource') && params.get('resource') !== resource)
          || params.getAll('resource').length > 1 || (params.has('scope') && params.get('scope') !== config.mcpScope)) return oauthError('invalid_request', 400);
        const upstream = new URL(loginHost + '/oauth2/authorize');
        for (const key of ['response_type', 'client_id', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method']) upstream.searchParams.set(key, params.get(key)!);
        upstream.searchParams.set('scope', config.mcpScope);
        upstream.searchParams.set('resource', resource);
        upstream.searchParams.set('identity_provider', 'Google');
        return new Response(null, { status: 302, headers: { Location: upstream.href, 'Cache-Control': 'no-store' } });
      }
      if (path === '/oauth/token' && request.method === 'POST') {
        if (!/^application\/x-www-form-urlencoded\b/i.test(request.headers.get('Content-Type') ?? '')) return oauthError('invalid_request', 400);
        const params = new URLSearchParams(await readText(request, 14_000));
        const grant = params.get('grant_type');
        if (params.get('client_id') !== config.mcpClient || (params.has('resource') && params.get('resource') !== resource)
          || params.getAll('resource').length > 1 || (params.has('scope') && params.get('scope') !== config.mcpScope)) return oauthError('invalid_client', 400);
        const upstream = new URLSearchParams({ client_id: config.mcpClient });
        if (grant === 'authorization_code') {
          const validated = exchangeInput.safeParse({ code: params.get('code'), verifier: params.get('code_verifier') });
          if (!validated.success || params.get('redirect_uri') !== config.mcpRedirect) return oauthError('invalid_request', 400);
          upstream.set('redirect_uri', config.mcpRedirect);
          upstream.set('code', validated.data.code);
          upstream.set('code_verifier', validated.data.verifier);
        } else if (grant === 'refresh_token' && params.get('refresh_token')) upstream.set('refresh_token', params.get('refresh_token')!);
        else return oauthError('unsupported_grant_type', 400);
        upstream.set('grant_type', grant);
        const response = await tokenRequest(upstream);
        if (!response.ok) return oauthError('invalid_grant', 400);
        const tokens = await response.json();
        if (typeof tokens.access_token !== 'string' || !(await verify(tokens.access_token, 'mcp'))) return oauthError('invalid_grant', 400);
        return json({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_in: tokens.expires_in, token_type: 'Bearer', scope: config.mcpScope });
      }
      return undefined;
    },
    mcpChallenge: 'Bearer resource_metadata="' + discovery + '", scope="' + config.mcpScope + '"'
  };
}

type CognitoEvent = {
  triggerSource: string; userName: string; request: { userAttributes: Record<string, string> };
  response: Record<string, unknown>;
};

export function ownerTrigger(event: CognitoEvent, ownerEmail: string) {
  const attributes = event.request.userAttributes;
  if (!event.userName.toLowerCase().startsWith('google_') || attributes.email?.toLowerCase() !== ownerEmail.toLowerCase()) {
    throw new Error('Cuenta sin acceso.');
  }
  if (event.triggerSource === 'PreSignUp_ExternalProvider') return event;
  if (!event.triggerSource.startsWith('TokenGeneration_') || attributes.email_verified !== 'true' || !attributes.sub) throw new Error('Identidad de Google sin verificar.');
  event.response.claimsAndScopeOverrideDetails = { accessTokenGeneration: { claimsToAddOrOverride: { planestudio_owner: 'true' } } };
  return event;
}
