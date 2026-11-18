import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Track } from '../core/curriculum.ts';
import type { Store } from './store.ts';
import { HttpError } from './http.ts';
import type { workerSchema, workerUpdateSchema } from './validation.ts';
import type { z } from 'zod';

type Worker = z.infer<typeof workerSchema> & { seen: number };
export type Job = {
  id: string; track: Track; week: number; version: string; title: string; channelId: string; channel: string;
  status: 'queued' | z.infer<typeof workerUpdateSchema>['status'];
  detail: string; worker?: string; lease?: string; until?: number; videoId?: string;
};
const leaseMs = 180_000;
const workerKey = 'video/worker';
const jobKey = (track: Track, week: number, version: string) => 'video/job/' + track + '-' + week + '-' + version;

export function verifyWorker(request: Request, tokenHash: string) {
  if (!/^[a-f0-9]{64}$/.test(tokenHash)) return false;
  const token = request.headers.get('Authorization')?.match(/^Bearer ([a-zA-Z0-9_-]{32,200})$/)?.[1];
  return Boolean(token && timingSafeEqual(createHash('sha256').update(token).digest(), Buffer.from(tokenHash, 'hex')));
}

export async function videoStatus(store: Store, track: Track, week: number, version: string) {
  const [entry, recent] = await Promise.all([store.get(jobKey(track, week, version)), store.get(workerKey)]);
  const worker = recent?.value as Worker | undefined;
  const job = entry?.value as Job | undefined;
  return {
    job: job ? { status: job.status, detail: job.detail, videoId: job.status === 'ready' ? job.videoId : undefined } : null,
    channel: worker && Date.now() - worker.seen < 180_000 ? { id: worker.channelId, name: worker.channel } : null
  };
}

export async function enqueue(store: Store, spec: Pick<Job, 'track' | 'week' | 'version' | 'title' | 'channelId'>) {
  const recent = (await store.get(workerKey))?.value as Worker | undefined;
  if (!recent || Date.now() - recent.seen >= 180_000 || recent.channelId !== spec.channelId) {
    throw new HttpError(409, 'Abre el proceso de video en Windows y confirma su canal de YouTube.');
  }
  const key = jobKey(spec.track, spec.week, spec.version);
  const current = await store.get(key);
  const previous = current?.value as Job | undefined;
  if (previous && previous.status !== 'error') return;
  if (previous && previous.channelId !== spec.channelId) throw new HttpError(409, 'Este trabajo ya está asociado a otro canal.');
  const job: Job = { ...spec, channel: recent.channel, id: previous?.id ?? randomUUID(), status: 'queued', detail: '' };
  await store.put(key, job, current?.revision ?? null);
}

export async function claim(store: Store, worker: z.infer<typeof workerSchema>) {
  const now = Date.now();
  const recent = (await store.get(workerKey))?.value as Worker | undefined;
  if (!recent || recent.key !== worker.key || now - recent.seen > 60_000) await store.put(workerKey, { ...worker, seen: now });
  const entries = await store.list('video/job/');
  for (const entry of entries) {
    const job = entry.value as Job;
    if (job.channelId !== worker.channelId || job.status === 'ready' || job.status === 'error' || (job.until ?? 0) > now) continue;
    const next = { ...job, status: job.status === 'queued' ? 'rendering' : job.status, worker: worker.key, lease: randomUUID(), until: now + leaseMs };
    if (await store.put(entry.key, next, entry.revision)) return { ...next, key: entry.key };
  }
  return null;
}

export async function updateJob(store: Store, key: string, lease: string, update?: z.infer<typeof workerUpdateSchema>) {
  const entry = await store.get(key);
  const job = entry?.value as Job | undefined;
  if (!entry || !job || job.lease !== lease || (job.until ?? 0) < Date.now()) throw new HttpError(409, 'El trabajo fue reasignado.');
  if (update && ['ready', 'processing'].includes(update.status) && !update.videoId && !job.videoId) throw new HttpError(400, 'Falta el identificador del video.');
  const next = { ...job, ...update, ...(update?.videoId ? { videoId: update.videoId } : {}), until: update?.status === 'ready' || update?.status === 'error' ? 0 : Date.now() + leaseMs };
  if (!await store.put(key, next, entry.revision)) throw new HttpError(409, 'El estado del trabajo cambió.');
}
