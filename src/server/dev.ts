import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { api } from './api.ts';
import { devAuth } from './auth.ts';
import { LocalStore } from './local-store.ts';
import type { Book } from '../core/calendar.ts';

const root = new URL('../../', import.meta.url);
const local = process.env.PLANESTUDIO_DATA_DIR
  ? pathToFileURL(resolve(process.env.PLANESTUDIO_DATA_DIR) + sep)
  : new URL('.private/', root);
const origin = process.env.PLANESTUDIO_DEV_ORIGIN ?? 'http://127.0.0.1:4321';
const port = Number(process.env.PLANESTUDIO_API_PORT ?? 4322);
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

createServer(async (input, output) => {
  try {
    const response = await handler(toRequest(input));
    output.writeHead(response.status, Object.fromEntries(response.headers));
    output.end(Buffer.from(await response.arrayBuffer()));
  } catch { output.writeHead(500).end(); }
}).listen(port, '127.0.0.1', () => console.log('API local en http://127.0.0.1:' + port));
