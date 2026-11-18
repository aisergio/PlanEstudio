import { mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { jobFolder, premiere, readOptional, renderWindows, writeJson } from './windows-media.mjs';
import { youtubeClient, youtubeSignIn } from './youtube.mjs';

try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const privateDir = resolve('.private');
const supplied = await readOptional(join(privateDir, 'video.json'));
if (!supplied?.youtubeClient || !supplied.python || !supplied.voice) throw new Error('Completa .private/video.json con el entorno de video de Windows.');
const root = resolve(supplied.jobs ?? join(privateDir, 'video-jobs'));
const config = { ...supplied, ffmpeg: supplied.ffmpeg ?? 'ffmpeg', ffprobe: supplied.ffprobe ?? 'ffprobe', youtubeToken: join(privateDir, 'youtube.dpapi.json') };

if (process.argv.includes('--youtube-auth')) {
  const result = await youtubeSignIn(config);
  console.log('Canal conectado:', result.name);
} else {
  const url = process.env.PLANESTUDIO_URL ?? 'https://aisergio.dev/PlanEstudio';
  const app = new URL(url);
  const token = process.env.PLANESTUDIO_WORKER_TOKEN ?? '';
  if (!(app.protocol === 'https:' || (app.protocol === 'http:' && app.hostname === '127.0.0.1')) ||
      app.pathname.replace(/\/$/, '') !== '/PlanEstudio' || app.username || app.password || app.hash || app.search || !/^[a-zA-Z0-9_-]{32,200}$/.test(token)) {
    throw new Error('Configura la dirección de PlanEstudio y el secreto del proceso de Windows.');
  }
  const identityPath = join(privateDir, 'worker.json');
  let identity = await readOptional(identityPath);
  if (!identity) {
    identity = { key: randomUUID() };
    await writeJson(identityPath, identity);
  }
  const youtube = await youtubeClient(config);
  const channel = await youtube.channel();
  await mkdir(root, { recursive: true });
  console.log('PlanEstudio está listo en Windows para el canal ' + channel.name + '.');
  async function call(path, body) {
    const response = await fetch(url.replace(/\/$/, '') + '/api/worker/' + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(12_000)
    });
    if (!response.ok) throw new Error('PlanEstudio rechazó la operación. Estado ' + response.status + '.');
    return response.json();
  }
  for (;;) {
    try {
      const { job, guide } = await call('claim', { ...identity, name: hostname().slice(0, 64), channel: channel.name, channelId: channel.id });
      if (job && guide) {
        let sending = Promise.resolve();
        function report(update) {
          const task = sending.then(() => call('update', { key: job.key, lease: job.lease, update }));
          sending = task.catch(() => {});
          return task;
        }
        const heartbeat = setInterval(() => { void report().catch(() => {}); }, 40_000);
        try {
          const folder = jobFolder(root, job.id);
          const checkpoint = join(folder, 'youtube-upload.json');
          let id = (await readOptional(checkpoint))?.id;
          if (!id) {
            const files = await renderWindows(config, folder, job, guide, report);
            const final = await premiere(config, folder, job, files, report);
            await report({ status: 'uploading', detail: 'Subiendo directamente desde Windows a YouTube.' });
            id = await youtube.upload(job, final, checkpoint, () => report());
          }
          await report({ status: 'processing', videoId: id, detail: 'YouTube está procesando el video.' });
          await youtube.waitUntilEmbeddable(id);
          await report({ status: 'ready', videoId: id, detail: '' });
          console.log('Guía publicada:', job.title);
        } catch (error) {
          console.error('Trabajo pendiente de revisión:', error.code ?? error.name);
          await report({ status: 'error', detail: error.message?.startsWith('Command failed') ?
            'Revisa Piper, HyperFrames y FFmpeg en Windows.' : String(error.message).slice(0, 200) }).catch(() => {});
        } finally { clearInterval(heartbeat); }
      }
    } catch (error) {
      console.error('El proceso no pudo consultar la cola:', error.message);
    }
    await sleep(30_000);
  }
}
