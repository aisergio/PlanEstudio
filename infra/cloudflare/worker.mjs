const base = '/PlanEstudio';
const discovery = new Set([
  '/.well-known/oauth-protected-resource/PlanEstudio/mcp',
  '/.well-known/oauth-authorization-server/PlanEstudio/oauth'
]);

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === base) return Response.redirect('https://aisergio.dev' + base + '/' + url.search, 308);
    if (!url.pathname.startsWith(base + '/') && !discovery.has(url.pathname)) return new Response('Ruta inexistente.', { status: 404 });
    const headers = new Headers(request.headers);
    headers.delete('Host');
    headers.delete('X-PlanEstudio-Origin');
    const origin = new URL(url.pathname + url.search, 'https://' + env.CLOUDFRONT_HOST);
    const privateRequest = discovery.has(url.pathname) || /^\/PlanEstudio\/(oauth\/|api\/|mcp$)/.test(url.pathname);
    return fetch(new Request(origin, {
      method: request.method, headers, body: request.body, redirect: 'manual'
    }), privateRequest ? { cf: { cacheTtl: 0, cacheEverything: false } } : undefined);
  }
};
