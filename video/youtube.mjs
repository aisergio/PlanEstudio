import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, open, readFile, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { readOptional, writeJson } from './windows-media.mjs';

const consent = 'https://accounts.google.com/o/oauth2/v2/auth';
const tokenUrl = 'https://oauth2.googleapis.com/token';
const apiRoot = 'https://www.googleapis.com/youtube/v3/';
const uploadRoot = 'https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable';
const scope = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';
const mediaType = 'video/mp4';
const chunkBytes = 8 * 1024 * 1024;
const videoId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(value);
const marker = id => 'Trabajo PlanEstudio ' + id;

function protect(operation, input) {
  if (process.platform !== 'win32') throw new Error('La credencial de YouTube se guarda en Windows.');
  const scripts = {
    wrap: 'ConvertTo-SecureString ([Console]::In.ReadToEnd()) -AsPlainText -Force | ConvertFrom-SecureString',
    unwrap: '$secure=ConvertTo-SecureString ([Console]::In.ReadToEnd()); [Console]::Write((New-Object System.Management.Automation.PSCredential("planestudio",$secure)).GetNetworkCredential().Password)'
  };
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', scripts[operation]], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    let result = '';
    child.stdout.setEncoding('utf8').on('data', value => { result += value; });
    child.once('error', reject);
    child.once('close', code => code === 0 && result.trim() ? resolve(result.trim()) : reject(new Error('Windows no pudo abrir la credencial local de YouTube.')));
    child.stdin.on('error', reject);
    child.stdin.end(input);
  });
}

async function credentials(config) {
  const value = JSON.parse(await readFile(config.youtubeClient, 'utf8')).installed;
  if (!value?.client_id || !value.client_secret) throw new Error('Selecciona un cliente OAuth de escritorio para YouTube.');
  return { client_id: value.client_id, client_secret: value.client_secret };
}

async function token(parameters) {
  const result = await fetch(tokenUrl, { method: 'POST', body: new URLSearchParams(parameters), signal: AbortSignal.timeout(15_000), redirect: 'error' });
  if (!result.ok) throw new Error('YouTube no autorizó el cliente de escritorio. Revisa el acceso en Windows.');
  return result.json();
}

export async function youtubeSignIn(config) {
  const client = await credentials(config);
  const verifier = randomBytes(40).toString('base64url');
  const state = randomBytes(32).toString('base64url');
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const redirect_uri = 'http://127.0.0.1:' + server.address().port + '/youtube/callback';
  const url = new URL(consent);
  url.search = new URLSearchParams({ client_id: client.client_id, response_type: 'code', redirect_uri,
    access_type: 'offline', prompt: 'consent', scope, state, code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(verifier).digest('base64url') }).toString();
  const timer = AbortSignal.timeout(240_000);
  try {
    const code = await new Promise((resolve, reject) => {
      timer.addEventListener('abort', () => reject(new Error('Caducó el inicio de sesión de YouTube.')), { once: true });
      server.on('request', (request, response) => {
        const callback = new URL(request.url, redirect_uri);
        if (callback.pathname !== '/youtube/callback' || callback.searchParams.get('state') !== state) {
          response.writeHead(404).end(); return;
        }
        const code = callback.searchParams.get('code');
        response.writeHead(code ? 200 : 400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(code ? 'YouTube autorizó PlanEstudio. Ya puedes cerrar esta pestaña.' : 'La autorización se canceló.');
        if (code) resolve(code); else reject(new Error('Autorización de YouTube cancelada.'));
      });
      const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url.href], { shell: false, windowsHide: false, stdio: 'ignore' });
      browser.once('error', reject);
    });
    const result = await token({ ...client, grant_type: 'authorization_code', code, redirect_uri, code_verifier: verifier });
    if (!result.refresh_token) throw new Error('YouTube no devolvió permiso de acceso offline.');
    await mkdir(dirname(config.youtubeToken), { recursive: true });
    await writeJson(config.youtubeToken, { dpapi: await protect('wrap', result.refresh_token) });
    const youtube = await youtubeClient(config);
    return youtube.channel();
  } finally { server.close(); }
}

export async function youtubeClient(config) {
  const client = await credentials(config);
  const encrypted = await readOptional(config.youtubeToken);
  if (!encrypted?.dpapi) throw new Error('Autoriza YouTube en Windows con el comando de conexión.');
  const refresh_token = await protect('unwrap', encrypted.dpapi);
  let activeToken;
  let expiry = 0;
  async function google(url, init = {}, retry = true) {
    if (!activeToken || Date.now() >= expiry) {
      const refreshed = await token({ ...client, grant_type: 'refresh_token', refresh_token });
      activeToken = refreshed.access_token;
      expiry = Date.now() + (refreshed.expires_in - 60) * 1000;
    }
    const headers = new Headers(init.headers);
    headers.set('Authorization', 'Bearer ' + activeToken);
    const response = await fetch(url, { ...init, headers, redirect: 'manual', signal: AbortSignal.timeout(80_000) });
    if (response.status === 401 && retry) {
      expiry = 0;
      return google(url, init, false);
    }
    return response;
  }
  async function list(resource, params) {
    const response = await google(apiRoot + resource + '?' + new URLSearchParams(params));
    if (!response.ok) throw new Error('No se pudo consultar YouTube. Estado ' + response.status + '.');
    return (await response.json()).items ?? [];
  }
  async function channel() {
    const mine = await list('channels', { part: 'snippet,contentDetails', mine: 'true', maxResults: '2' });
    if (mine.length !== 1) throw new Error('Autoriza el canal concreto de YouTube que usará PlanEstudio.');
    return { id: mine[0].id, name: mine[0].snippet.title, uploads: mine[0].contentDetails.relatedPlaylists.uploads };
  }
  async function findUploaded(job) {
    const current = await channel();
    if (current.id !== job.channelId) throw new Error('El canal autorizado cambió.');
    const recent = await list('playlistItems', { part: 'snippet', playlistId: current.uploads, maxResults: '50' });
    return recent.find(item => item.snippet?.description?.includes(marker(job.id)))?.snippet?.resourceId?.videoId;
  }

  async function upload(job, path, checkpoint, renew) {
    const size = (await stat(path)).size;
    let journal = await readOptional(checkpoint);
    if (journal?.id && videoId(journal.id)) return journal.id;
    if (journal && journal.size !== size) throw new Error('El MP4 cambió después de empezar su carga. Revisa el trabajo en Windows.');
    const recordId = async id => {
      if (!videoId(id)) throw new Error('YouTube no devolvió el identificador del video.');
      await writeJson(checkpoint, { id, size });
      return id;
    };
    const current = await channel();
    if (current.id !== job.channelId) throw new Error('El canal verificado ya no coincide con el de la confirmación.');
    if (!journal?.url) {
      await renew();
      const result = await google(uploadRoot, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Upload-Content-Type': mediaType, 'X-Upload-Content-Length': String(size) },
        body: JSON.stringify({ snippet: { title: job.title, defaultLanguage: 'es',
          description: 'Guía educativa de PlanEstudio. Incluye narración sintetizada con Piper Daniela (es_AR).\n' +
            'Modelo y créditos: https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_AR/daniela/high/MODEL_CARD\n\n' + marker(job.id),
          categoryId: '27' }, status: { privacyStatus: 'public', selfDeclaredMadeForKids: false, embeddable: true } })
      });
      if (!result.ok) throw new Error('YouTube no inició la carga. Estado ' + result.status + '.');
      journal = { url: result.headers.get('Location'), size, finalAttempted: false };
      if (!journal.url) throw new Error('YouTube no devolvió la ubicación de reanudación.');
      await writeJson(checkpoint, journal);
    }
    const destination = new URL(journal.url);
    if (destination.protocol !== 'https:' || !['www.googleapis.com', 'upload.youtube.com'].includes(destination.hostname)
        || !destination.pathname.startsWith('/upload/youtube/')) throw new Error('La ubicación de carga de YouTube es inválida.');
    const proceed = async (result, fallbackOffset = 0) => {
      if (result.ok) return { id: await recordId((await result.json()).id) };
      if (result.status === 308) {
        const confirmed = result.headers.get('Range')?.match(/^bytes=0-(\d+)$/);
        return { offset: confirmed ? Number(confirmed[1]) + 1 : fallbackOffset };
      }
      if (result.status === 404 || result.status === 410) {
        const found = await findUploaded(job);
        if (videoId(found)) return { id: await recordId(found) };
        if (journal.finalAttempted) throw new Error('La carga caducó tras enviar el tramo final. Comprueba el canal antes de reintentar.');
        await writeJson(checkpoint, { size });
        throw new Error('La sesión de carga caducó. Genera de nuevo para reanudar con una sesión nueva.');
      }
      throw new Error('La carga de YouTube se interrumpió. Estado ' + result.status + '.');
    };
    const status = await google(destination, { method: 'PUT', headers: { 'Content-Range': 'bytes */' + size, 'Content-Length': '0' }, body: new Uint8Array() });
    let progress = await proceed(status);
    if (progress.id) return progress.id;
    const input = await open(path, 'r');
    try {
      while (progress.offset < size) {
        await renew();
        const start = progress.offset;
        const count = Math.min(chunkBytes, size - start);
        const buffer = Buffer.allocUnsafe(count);
        const { bytesRead } = await input.read(buffer, 0, count, start);
        if (bytesRead !== count) throw new Error('El archivo final cambió durante la carga.');
        if (start + count === size && !journal.finalAttempted) {
          journal.finalAttempted = true;
          await writeJson(checkpoint, journal);
        }
        const result = await google(destination, { method: 'PUT', headers: { 'Content-Type': mediaType,
          'Content-Length': String(count), 'Content-Range': 'bytes ' + start + '-' + (start + count - 1) + '/' + size }, body: buffer });
        progress = await proceed(result);
        if (progress.id) return progress.id;
        if (progress.offset <= start) throw new Error('YouTube no confirmó el siguiente tramo. La posición queda guardada.');
      }
    } finally { await input.close(); }
    throw new Error('Revisa el procesamiento antes de confirmar la publicación.');
  }
  async function waitUntilEmbeddable(id) {
    for (let attempt = 0; attempt < 120; attempt++) {
      const [video] = await list('videos', { part: 'status,processingDetails', id });
      if (video?.status?.uploadStatus === 'processed' && video.status.privacyStatus === 'public' && video.status.embeddable) return;
      if (['rejected', 'failed', 'deleted'].includes(video?.status?.uploadStatus) || ['failed', 'terminated'].includes(video?.processingDetails?.processingStatus)) {
        throw new Error('YouTube rechazó el video o no pudo procesarlo.');
      }
      await sleep(15_000);
    }
    throw new Error('Comprueba la visibilidad y la opción de inserción en YouTube Studio. La referencia quedó guardada.');
  }
  return { channel, upload, waitUntilEmbeddable };
}
