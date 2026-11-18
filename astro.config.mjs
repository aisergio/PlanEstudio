import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { request } from 'node:http';

const api = 'http://127.0.0.1:' + (process.env.PLANESTUDIO_API_PORT ?? 4322);
const localApi = {
  name: 'planestudio-local-api',
  configureServer(server) {
    server.middlewares.use((input, output, next) => {
      const pathname = input.url?.split('?')[0] ?? '';
      if (!/^(?:\/PlanEstudio)?\/(?:api\/|mcp$|oauth\/)|^\/\.well-known\/oauth-/.test(pathname)) return next();
      const upstream = request(api + input.url, { method: input.method, headers: input.headers }, response => {
        output.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(output);
      });
      upstream.on('error', () => {
        if (!output.headersSent) output.writeHead(502, { 'Content-Type': 'application/json' });
        output.end(JSON.stringify({ error: 'La API local está iniciando. Vuelve a cargar la página.' }));
      });
      input.pipe(upstream);
    });
  }
};

export default defineConfig({
  site: 'https://aisergio.dev',
  base: '/PlanEstudio/',
  trailingSlash: 'ignore',
  integrations: [react()],
  devToolbar: { enabled: false },
  server: { host: '127.0.0.1', port: Number(process.env.PLANESTUDIO_WEB_PORT ?? 4321) },
  vite: { plugins: [localApi] }
});
