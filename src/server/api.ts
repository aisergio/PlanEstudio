import { z } from 'zod';
import { activityKey, roadmap, tracks, weekKey } from '../core/curriculum.ts';
import { monday, todayBogota } from '../core/calendar.ts';
import type { Book } from '../core/calendar.ts';
import { guides } from '../core/guides.ts';
import type { Guide } from '../core/guides.ts';
import { recommendations } from '../core/resources.ts';
import type { Auth } from './auth.ts';
import { failure, HttpError, json, readJson } from './http.ts';
import { serveMcp } from './mcp.ts';
import { loadState } from './store.ts';
import type { Store } from './store.ts';
import { completionSchema, jobSchema, nextSchema, resourceSchema, sessionSchema, settingsSchema, templateSchema, tutorSchema, workerSchema, workerUpdateSchema } from './validation.ts';
import { claim, enqueue, updateJob, verifyWorker, videoStatus } from './video-queue.ts';

type Services = {
  auth: Auth; store: Store; library: () => Promise<Book[]>;
  workerHash?: string; tutor?: (guide: Guide, title: string, question: string) => Promise<{ answer: string; remaining: number }>;
};
const routes = { sessions: sessionSchema, resources: resourceSchema, templates: templateSchema, next: nextSchema } as const;
const mcpOrigins = new Set(['https://chatgpt.com', 'https://chat.openai.com']);

async function data<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>> {
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, 'Revisa los campos antes de guardar.');
  return parsed.data;
}

export function api(services: Services) {
  const { auth, store, library } = services;
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const path = url.pathname.startsWith('/PlanEstudio/') ? url.pathname.slice('/PlanEstudio'.length) : url.pathname;
    const method = request.method;
    const origin = request.headers.get('Origin');
    const browserMcp = origin && mcpOrigins.has(origin);
    const discovery = path.startsWith('/.well-known/oauth-') || path === '/oauth/.well-known/oauth-authorization-server';
    const crossOrigin = path === '/mcp' || path === '/oauth/token' || discovery;
    const cors = browserMcp && crossOrigin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Expose-Headers': 'WWW-Authenticate, MCP-Protocol-Version', Vary: 'Origin' } : undefined;

    async function handle() {
      if (crossOrigin && origin && origin !== auth.origin && !browserMcp) return failure('Origen sin acceso.', 403);
      if (method === 'OPTIONS' && cors) return new Response(null, { status: 204, headers: {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version, Last-Event-ID'
      } });
      if (path === '/api/health' && method === 'GET') return json({ ok: true });
      const authResponse = await auth.handle(request, path);
      if (authResponse) return authResponse;
      if (path === '/mcp') {
        if (!await auth.authorize(request, 'mcp')) return failure('Se requiere autorización de lectura de PlanEstudio.', 401, { 'WWW-Authenticate': auth.mcpChallenge });
        if (method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
        return serveMcp(request, await readJson(request), store, library);
      }
      if (path.startsWith('/api/worker/') && method === 'POST') {
        if (!verifyWorker(request, services.workerHash ?? '')) return failure('Proceso de Windows sin acceso.', 401);
        if (path === '/api/worker/claim') {
          const job = await claim(store, await data(request, workerSchema));
          return json({ job, guide: job ? guides[weekKey(job.track, job.week)] : undefined });
        }
        const update = await data(request, z.object({
          key: z.string().regex(/^video\/job\/(?:ia|fullstack)-\d{1,2}-\d+\.\d+$/), lease: z.uuid(), update: workerUpdateSchema.optional()
        }));
        if (path === '/api/worker/update') {
          await updateJob(store, update.key, update.lease, update.update);
          return json({ ok: true });
        }
        return failure('Ruta inexistente.', 404);
      }
      if (!path.startsWith('/api/')) return failure('Ruta inexistente.', 404);
      if (!await auth.authorize(request, 'web')) return failure('Inicia sesión con la cuenta de Google autorizada.', 401);
      if (method !== 'GET' && origin !== auth.origin) return failure('El origen de la solicitud no está autorizado.', 403);
      if (method === 'GET' && path === '/api/bootstrap') {
        const [state, books] = await Promise.all([loadState(store), library()]);
        return json({ state, books, guides: Object.keys(guides), tutor: Boolean(services.tutor), video: Boolean(services.workerHash) });
      }
      if (method === 'GET' && path === '/api/state') return json(await loadState(store));
      if (method === 'PUT' && path === '/api/settings') {
        const settings = await data(request, settingsSchema);
        await store.put('study/settings', { ...settings, start: monday(settings.start) });
        return json({ ...settings, start: monday(settings.start) });
      }
      if (method === 'PUT' && path === '/api/completions') {
        const activity = await data(request, completionSchema);
        const key = activityKey(activity.track, activity.week, activity.block);
        if (activity.done) await store.put('study/completions/' + key, key);
        else await store.remove('study/completions/' + key);
        return json(activity);
      }
      const entity = path.match(/^\/api\/(sessions|resources|templates|next)(?:\/([a-f0-9-]{36}))?$/);
      if (entity) {
        const category = entity[1] as keyof typeof routes;
        if (method === 'PUT' && !entity[2]) {
          const item = await data(request, routes[category]);
          if ('date' in item && item.date > todayBogota()) throw new HttpError(400, 'Registra una sesión con fecha de hoy o anterior.');
          await store.put('study/' + category + '/' + item.id, item);
          return json(item);
        }
        if (method === 'DELETE' && entity[2]) {
          await store.remove('study/' + category + '/' + entity[2]);
          return json({ ok: true });
        }
      }
      const match = path.match(/^\/api\/weeks\/(ia|fullstack)\/(\d{1,2})$/);
      if (match && method === 'GET') {
        const track = match[1] as keyof typeof tracks;
        const week = roadmap[track][Number(match[2]) - 1];
        if (!week) return failure('La semana está fuera de esta ruta.', 404);
        const guide = guides[weekKey(track, week.number)];
        const [state, books, video] = await Promise.all([
          loadState(store), library(), guide ? videoStatus(store, track, week.number, guide.version) : null
        ]);
        return json({ guide: guide ?? null, suggestions: recommendations(week, books, state.resources, 5), video });
      }
      if (path === '/api/videos' && method === 'POST') {
        if (!services.workerHash) return failure('El proceso de video en Windows requiere configuración.', 503);
        const input = await data(request, jobSchema);
        const guide = guides[weekKey(input.track, input.week)];
        if (!guide) return failure('Esta semana aún no tiene una guía revisada.', 409);
        const week = roadmap[input.track][input.week - 1];
        await enqueue(store, { track: input.track, week: input.week, version: guide.version,
          title: tracks[input.track].name + ' · Semana ' + input.week + ' · ' + week.title, channelId: input.channelId });
        return json(await videoStatus(store, input.track, input.week, guide.version), 202);
      }
      if (path === '/api/tutor' && method === 'POST') {
        if (!services.tutor) return failure('Conecta Amazon Bedrock para usar el tutor.', 503);
        const input = await data(request, tutorSchema);
        const guide = guides[weekKey(input.track, input.week)];
        if (!guide) return failure('Elige una semana con guía revisada.', 409);
        return json(await services.tutor(guide, roadmap[input.track][input.week - 1].title, input.question));
      }
      return failure('Ruta inexistente.', 404);
    }

    try {
      const response = await handle();
      if (cors) for (const [name, value] of Object.entries(cors)) response.headers.set(name, value);
      return response;
    } catch (error) {
      if (error instanceof HttpError) return failure(error.message, error.status, cors);
      console.error('PlanEstudio request failed:', error instanceof Error ? error.name : 'Unknown');
      return failure('No se pudo completar la solicitud. Inténtalo de nuevo.', 500, cors);
    }
  };
}
