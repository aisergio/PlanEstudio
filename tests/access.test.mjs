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

test('la sesión web exige una identidad Google firmada del propietario y el MCP su propio permiso', async t => {
  const origin = 'https://example.test';
  const app = origin + '/PlanEstudio';
  const webClient = 'web-test';
  const poolId = 'us-east-2_example';
  const auth = cognitoAuth({ app, poolId, webClient, ownerEmail: 'owner@example.test', domain: 'https://login.example.test',
    mcpClient: 'mcp-test', mcpRedirect: '', mcpScope: 'planestudio/lectura', mcpEnabled: true });
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256' };
  t.mock.method(SimpleJwksCache.prototype, 'getJwk', async () => key);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const common = { iss: 'https://cognito-idp.us-east-2.amazonaws.com/' + poolId,
    sub: 'owner-id', exp: Math.floor(Date.now() / 1000) + 600 };
  const identity = { ...common, token_use: 'id', aud: webClient, email: 'Owner@example.test',
    email_verified: true, 'cognito:username': 'Google_test' };
  const legacy = { ...common, token_use: 'access', client_id: webClient, aud: app + '/api', planestudio_owner: true };
  const mcp = { ...legacy, client_id: 'mcp-test', aud: app + '/mcp', scope: 'planestudio/lectura' };
  function issue(claims) {
    const data = encode({ alg: 'RS256', kid: key.kid }) + '.' + encode(claims);
    return data + '.' + sign('sha256', Buffer.from(data), privateKey).toString('base64url');
  }
  let idToken;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ id_token: idToken, access_token: issue(legacy), expires_in: 600 }));
  const exchange = () => auth.handle(new Request(app + '/api/auth/token', { method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'dummy-code', verifier: 'x'.repeat(43) }) }), '/api/auth/token');

  const webSession = cookie => auth.authorize(new Request(app + '/api/bootstrap', { headers: { Cookie: cookie } }), 'web');
  const mcpAccess = token => auth.authorize(new Request(app + '/mcp', { headers: { Authorization: 'Bearer ' + token } }), 'mcp');

  for (const verified of [true, 'true']) {
    idToken = issue({ ...identity, email_verified: verified });
    const result = await exchange();
    assert.equal(result.status, 200);
    const cookie = result.headers.get('Set-Cookie');
    assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
    assert.equal(await webSession(cookie.split(';')[0]), true);
    assert.equal(await mcpAccess(idToken), false);
  }
  for (const invalid of [{ email: 'another@example.test' }, { email: undefined }, { email_verified: false },
    { email_verified: 'false' }, { 'cognito:username': 'local_test' }, { aud: 'mcp-test' }, { aud: undefined },
    { iss: 'https://another.example.test' }, { exp: 1 }, { exp: undefined }, { sub: '' }]) {
    idToken = issue({ ...identity, ...invalid });
    const rejected = await exchange();
    assert.equal(rejected.status, 403);
    assert.equal(rejected.headers.has('Set-Cookie'), false);
  }
  for (const wrongType of [undefined, issue(legacy), issue(mcp)]) {
    idToken = wrongType;
    assert.equal((await exchange()).status, 403);
  }
  assert.equal(await webSession('__Secure-planestudio=' + issue(legacy)), true);
  assert.equal(await webSession('__Secure-planestudio=' + issue({ ...legacy, aud: undefined })), false);
  assert.equal(await webSession('__Secure-planestudio=' + issue(mcp)), false);
  assert.equal(await mcpAccess(issue(mcp)), true);
  assert.equal(await mcpAccess(issue(legacy)), false);
  for (const invalid of [{ planestudio_owner: 'false' }, { scope: 'other' }, { aud: app + '/api' }, { exp: 1 }]) {
    assert.equal(await mcpAccess(issue({ ...mcp, ...invalid })), false);
  }
});

test('un canje rechazado distingue interrupciones del servicio y omite datos privados del diagnóstico', async t => {
  const origin = 'https://example.test';
  const app = origin + '/PlanEstudio';
  const auth = cognitoAuth({ app, poolId: 'us-east-2_example', webClient: 'web-test', ownerEmail: 'owner@example.test',
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
