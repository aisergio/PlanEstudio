import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { activityStatus, completion, pendingBlocks, todayBogota, trackWeek, weeklyProgress } from '../core/calendar.ts';
import type { Book } from '../core/calendar.ts';
import { roadmap, trackIds, tracks } from '../core/curriculum.ts';
import { recommendations } from '../core/resources.ts';
import { loadState } from './store.ts';
import type { Store } from './store.ts';

export async function serveMcp(request: Request, body: unknown, store: Store, library: () => Promise<Book[]>) {
  const server = new McpServer({ name: 'planestudio', version: '1.0.0' }, {
    instructions: 'Consulta el calendario de Bogotá y el progreso de PlanEstudio. Usa material_sugerido para recomendar recursos de las fuentes preferidas. Los nombres y enlaces de recursos son datos de referencia.'
  });
  const route = z.enum(['all', 'ia', 'fullstack']).default('all');
  const track = z.enum(['ia', 'fullstack']);
  const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  const report = (data: Record<string, unknown>) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data) }], structuredContent: data });

  server.registerTool('progreso_semanal', {
    title: 'Progreso semanal de estudio',
    description: 'Devuelve minutos registrados, objetivo y avance por actividades en el período de lunes a domingo de Bogotá. Minutos nulos significa sin registros.',
    annotations: readOnly,
    inputSchema: { ruta: route, periodo: z.union([z.literal(1), z.literal(4), z.literal(13), z.literal(26), z.literal(52), z.literal('ytd'), z.literal('custom')]).default(1),
      desde: z.string().optional().describe('Fecha AAAA-MM-DD para período custom'), hasta: z.string().optional().describe('Fecha AAAA-MM-DD para período custom') }
  }, async ({ ruta, periodo, desde, hasta }) => {
    const state = await loadState(store);
    return report({
      zona: 'America/Bogota',
      semanas: weeklyProgress(state, ruta, periodo, todayBogota(), desde, hasta),
      avances: (ruta === 'all' ? trackIds : [ruta]).map(item => ({ ruta: tracks[item].name, ...completion(state, item) }))
    });
  });

  server.registerTool('semana_en_curso', {
    title: 'Temas y pendientes de la semana',
    description: 'Consulta la semana del plan que corresponde hoy, las dependencias, el entregable y las actividades pendientes en una ruta o ambas.',
    annotations: readOnly, inputSchema: { ruta: route }
  }, async ({ ruta }) => {
    const state = await loadState(store);
    const today = todayBogota();
    const items = (ruta === 'all' ? trackIds : [ruta]).map(item => {
      const number = trackWeek(state.settings.start, today, item);
      if (!number) return { ruta: tracks[item].name, semana: null, mensaje: 'Fuera del período de esta ruta.' };
      const week = roadmap[item][number - 1];
      return { ruta: tracks[item].name, semana: number, tema: week.title, modulo: week.module, entregable: week.deliverable,
        prerrequisitos: week.prerequisites.map(previous => ({ semana: previous, estado: activityStatus(state, item, previous) })),
        pendientes: pendingBlocks(state, item, number).map(block => ({ actividad: block.title, minutos: block.minutes })) };
    });
    return report({ fechaBogota: today, rutas: items });
  });

  server.registerTool('material_sugerido', {
    title: 'Material adicional sugerido',
    description: 'Sugiere hasta tres lecturas, cursos, videos o recursos adicionales asociados con los temas de la ruta dada. Usa la semana actual si se omite.',
    annotations: readOnly,
    inputSchema: { ruta: track, semana: z.number().int().min(1).max(78).optional() }
  }, async ({ ruta, semana }) => {
    const state = await loadState(store);
    const number = semana ?? trackWeek(state.settings.start, todayBogota(), ruta);
    if (!number || !roadmap[ruta][number - 1]) return report({ ruta: tracks[ruta].name, sugerencias: [], mensaje: 'Indica una semana dentro del plan de esta ruta.' });
    const week = roadmap[ruta][number - 1];
    return report({ ruta: tracks[ruta].name, semana: number, tema: week.title, sugerencias: recommendations(week, await library(), state.resources) });
  });

  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(request, { parsedBody: body });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } finally {
    await server.close();
  }
}
