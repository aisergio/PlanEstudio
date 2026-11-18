export const base = '/PlanEstudio/';
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(base + 'api/' + path, {
    method, cache: 'no-store',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  });
  const value = await response.json();
  if (!response.ok) throw new ApiError(value.error ?? 'No se pudo completar la solicitud.', response.status);
  return value as T;
}
export const messageOf = (error: unknown) => error instanceof Error ? error.message : 'No se pudo completar la solicitud.';

export type LoginConfig = { mode: 'local' } | { mode: 'google'; authorize: string; clientId: string; callback: string; resource: string };
const encoded = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const loginKey = 'planestudio-pkce';
export async function signIn(config: Extract<LoginConfig, { mode: 'google' }>) {
  const state = encoded(crypto.getRandomValues(new Uint8Array(24)));
  const verifier = encoded(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = encoded(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  sessionStorage.setItem(loginKey, JSON.stringify({ state, verifier }));
  const url = new URL(config.authorize);
  url.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: config.callback, resource: config.resource,
    response_type: 'code', scope: 'openid email', identity_provider: 'Google', state,
    code_challenge_method: 'S256', code_challenge: challenge
  }).toString();
  window.location.assign(url);
}

export async function finishLogin() {
  const params = new URL(location.href).searchParams;
  const stored = JSON.parse(sessionStorage.getItem(loginKey) ?? 'null') as { state: string; verifier: string } | null;
  sessionStorage.removeItem(loginKey);
  history.replaceState(null, '', location.pathname);
  if (!stored || stored.state !== params.get('state') || !params.get('code')) throw new Error('El inicio de sesión no se completó. Abre PlanEstudio y vuelve a intentarlo.');
  await request('auth/token', 'POST', { code: params.get('code'), verifier: stored.verifier });
  location.replace(base);
}
