import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { api } from './api.ts';
import { devAuth } from './auth.ts';
import { LocalStore } from './local-store.ts';
import type { Book } from '../core/calendar.ts';

const root = new URL('../../', import.meta.url);
const preview = process.argv.includes('--preview');
const local = process.env.PLANESTUDIO_DATA_DIR
  ? pathToFileURL(resolve(process.env.PLANESTUDIO_DATA_DIR) + sep)
  : new URL('.private/', root);
const port = Number(preview ? process.env.PLANESTUDIO_WEB_PORT ?? 4321 : process.env.PLANESTUDIO_API_PORT ?? 4322);
const origin = process.env.PLANESTUDIO_DEV_ORIGIN ?? 'http://127.0.0.1:' + (preview ? port : 4321);
const library = async () => {
  try { return JSON.parse(await readFile(new URL('library.json', local), 'utf8')) as Book[]; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
};
const handler = api({ auth: devAuth(origin), store: new LocalStore(fileURLToPath(new URL('state.json', local))),
  library, workerHash: process.env.PLANESTUDIO_WORKER_HASH });

function toRequest(input: IncomingMessage) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(input.headers)) {
    for (const item of Array.isArray(value) ? value : value ? [value] : []) headers.append(key, item);
  }
  const options: RequestInit & { duplex?: 'half' } = { method: input.method, headers };
  if (input.method !== 'GET' && input.method !== 'HEAD') {
    options.body = Readable.toWeb(input) as ReadableStream<Uint8Array>;
    options.duplex = 'half';
  }
  return new Request(origin + input.url, options);
}

const assets = fileURLToPath(new URL('dist/', root));
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
async function site(request: Request, path: string) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 });
  if (path === '/PlanEstudio') return new Response(null, { status: 308, headers: { Location: '/PlanEstudio/' + new URL(request.url).search } });
  if (!path.startsWith('/PlanEstudio/') || /%|\\/.test(path)) return new Response(null, { status: 404 });
  const relative = path.slice('/PlanEstudio/'.length);
  const file = resolve(assets, relative, ...(extname(relative) ? [] : ['index.html']));
  if (!file.startsWith(assets)) return new Response(null, { status: 404 });
  try {
    const body = await readFile(file);
    return new Response(request.method === 'GET' ? Uint8Array.from(body) : null, {
      headers: { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }
    });
  } catch { return new Response(null, { status: 404 }); }
}

createServer(async (input, output) => {
  try {
    const request = toRequest(input);
    const path = new URL(request.url).pathname;
    const api = /^\/PlanEstudio\/(?:api\/|mcp$|oauth\/)|^\/\.well-known\/oauth-/.test(path);
    const response = preview && !api ? await site(request, path) : await handler(request);
    output.writeHead(response.status, Object.fromEntries(response.headers));
    output.end(Buffer.from(await response.arrayBuffer()));
  } catch { output.writeHead(500).end(); }
}).listen(port, '127.0.0.1', () => console.log(preview ? 'PlanEstudio en ' + origin + '/PlanEstudio/' : 'API local en http://127.0.0.1:' + port));
