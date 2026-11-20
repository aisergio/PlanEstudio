import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { SimpleJwksCache } from 'aws-jwt-verify/jwk';
import { cognitoAuth } from '../src/server/auth.ts';

test('CloudFront sirve hojas de estilo con puntos consecutivos en su nombre', () => {
  const viewer = readFileSync(new URL('../infra/viewer.js', import.meta.url), 'utf8');
  const route = vm.runInNewContext(viewer + '\nhandler');
  const request = uri => route({ request: { uri } });
  const css = '/PlanEstudio/_astro/_..CLJEp-Mb.css';
  assert.equal(request(css).uri, css);
  assert.equal(request('/PlanEstudio/auth/callback/').uri, '/PlanEstudio/auth/callback/index.html');
  assert.equal(request('/PlanEstudio/../private/library.json').statusCode, 404);
  assert.equal(request('/private/library.json').statusCode, 404);
});

test('el retorno emite una sesión exclusiva del propietario y del recurso web', async t => {
  const origin = 'https://example.test';
  const app = origin + '/PlanEstudio';
  const webClient = 'web-test';
  const poolId = 'us-east-2_example';
  const auth = cognitoAuth({ app, poolId, webClient, domain: 'https://login.example.test',
    mcpClient: 'mcp-test', mcpRedirect: '', mcpScope: 'planestudio/lectura', mcpEnabled: true });
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256' };
  t.mock.method(SimpleJwksCache.prototype, 'getJwk', async () => key);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const claims = { iss: 'https://cognito-idp.us-east-2.amazonaws.com/' + poolId, client_id: webClient,
    sub: 'owner-id', token_use: 'access', exp: Math.floor(Date.now() / 1000) + 600,
    aud: app + '/api', planestudio_owner: true };
  let token;
  function issue(overrides = {}) {
    const data = encode({ alg: 'RS256', kid: key.kid }) + '.' + encode({ ...claims, ...overrides });
    token = data + '.' + sign('sha256', Buffer.from(data), privateKey).toString('base64url');
    return token;
  }
  t.mock.method(globalThis, 'fetch', async () => Response.json({ access_token: token, expires_in: 600 }));
  const exchange = () => auth.handle(new Request(app + '/api/auth/token', { method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'dummy-code', verifier: 'x'.repeat(43) }) }), '/api/auth/token');

  for (const owner of [true, 'true']) {
    issue({ planestudio_owner: owner });
    const result = await exchange();
    assert.equal(result.status, 200);
    const cookie = result.headers.get('Set-Cookie');
    assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
    const request = new Request(app + '/api/bootstrap', { headers: { Cookie: cookie.split(';')[0] } });
    assert.equal(await auth.authorize(request, 'web'), true);
    assert.equal(await auth.authorize(new Request(app + '/mcp', { headers: { Authorization: 'Bearer ' + token } }), 'mcp'), false);
  }
  for (const invalid of [{ planestudio_owner: false }, { planestudio_owner: 'false' }, { aud: undefined },
    { aud: app + '/mcp' }, { client_id: 'other-client' }, { exp: 1 }, { sub: '' }]) {
    issue(invalid);
    const rejected = await exchange();
    assert.equal(rejected.status, 403);
    assert.equal(rejected.headers.has('Set-Cookie'), false);
  }
});

test('un canje rechazado distingue interrupciones del servicio y omite datos privados del diagnóstico', async t => {
  const origin = 'https://example.test';
  const app = origin + '/PlanEstudio';
  const auth = cognitoAuth({ app, poolId: 'us-east-2_example', webClient: 'web-test',
    domain: 'https://login.example.test', mcpClient: '', mcpRedirect: '', mcpScope: '', mcpEnabled: false });
  const warnings = t.mock.method(console, 'warn', () => {});
  let upstream;
  t.mock.method(globalThis, 'fetch', async () => upstream);
  for (const [status, providerCode, reason, expected] of [
    [400, 'invalid_grant', 'invalid_grant', 401],
    [400, 'private-provider-detail', 'unknown', 401],
    [503, 'server_error', 'server_error', 503]
  ]) {
    upstream = Response.json({ error: providerCode, error_description: 'private-provider-detail' }, { status });
    const result = await auth.handle(new Request(app + '/api/auth/token', { method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'test-one-time-code', verifier: 'x'.repeat(43) }) }), '/api/auth/token');
    assert.equal(result.status, expected);
    assert.equal(result.headers.has('Set-Cookie'), false);
    assert.doesNotMatch(await result.text(), /private-provider-detail|test-one-time-code/);
    assert.deepEqual(warnings.mock.calls.at(-1).arguments, ['Cognito web exchange rejected', { status, reason }]);
  }
});
