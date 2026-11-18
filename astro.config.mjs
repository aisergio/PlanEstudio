import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

const api = 'http://127.0.0.1:' + (process.env.PLANESTUDIO_API_PORT ?? 4322);
export default defineConfig({
  site: 'https://aisergio.dev',
  base: '/PlanEstudio/',
  trailingSlash: 'always',
  integrations: [react()],
  server: { host: '127.0.0.1', port: Number(process.env.PLANESTUDIO_WEB_PORT ?? 4321) },
  vite: {
    server: {
      proxy: { '/PlanEstudio/api': api, '/PlanEstudio/mcp': api, '/PlanEstudio/oauth': api, '/.well-known/oauth-': api }
    }
  }
});
