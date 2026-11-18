import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, copyFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { setTimeout as pause } from 'node:timers/promises';
import { chromium } from '@playwright/test';
import { makeSrt, scenes, totalSeconds } from './scenes.mjs';

const require = createRequire(import.meta.url);
const exec = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const project = dirname(here);
const options = { windowsHide: true, maxBuffer: 8 * 1024 * 1024 };
const exists = path => access(path).then(() => true, () => false);
const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const jsonFile = async path => JSON.parse(await readFile(path, 'utf8'));
export async function writeJson(path, value) {
  const tmp = path + '.new';
  await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await rename(tmp, path);
}
export async function readOptional(path) {
  try { return await jsonFile(path); } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
}

function hyperframesEntry() {
  const folder = join(project, 'node_modules', 'hyperframes');
  const metadata = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'));
  return join(folder, typeof metadata.bin === 'string' ? metadata.bin : metadata.bin.hyperframes);
}

export async function probe(config, file, expected) {
  if (!await exists(file)) return false;
  try {
    const { stdout } = await exec(config.ffprobe, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', file], options);
    const info = JSON.parse(stdout);
    return Math.abs(Number(info.format.duration) - expected) <= 0.07 &&
      ['audio', 'video'].every(type => info.streams.some(stream => stream.codec_type === type));
  } catch { return false; }
}

async function diagrams(definitions) {
  const browser = await chromium.launch(process.platform === 'win32' ? { channel: 'msedge' } : {});
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ path: join(project, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js') });
    return await page.evaluate(async sources => {
      const mermaid = window.mermaid;
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', flowchart: { htmlLabels: false }, theme: 'base',
        themeVariables: { fontFamily: 'Arial, sans-serif', fontSize: '20px', primaryColor: '#d9ebff', primaryTextColor: '#143162', primaryBorderColor: '#5a95e3' } });
      const images = [];
      for (const [index, source] of sources.entries()) {
        const { svg } = await mermaid.render('diagram-' + index, source);
        images.push(svg);
      }
      return images;
    }, definitions);
  } finally { await browser.close(); }
}

function exampleDiagram(guide) {
  const first = guide.example.split(/(?<=[.!?])\s+|;/)[0].trim().slice(0, 112).replace(/["{}<>]/g, '');
  return 'flowchart LR\n  A["Datos del ejemplo"] --> B["' + first + '"] --> C["Comprobación"]';
}

export async function renderWindows(config, folder, job, guide, report) {
  await mkdir(folder, { recursive: true });
  const planned = scenes(guide);
  const input = join(folder, 'scenes.json');
  const readyAudio = planned.map(scene => join(folder, scene.id, 'captions.json'));
  if (!(await Promise.all(readyAudio.map(exists))).every(Boolean)) {
    await writeJson(input, planned);
    await exec(config.python, [join(here, 'synthesize.py'), config.voice, input, config.ffmpeg], options);
  }
  const html = await readFile(join(here, 'composition.html'), 'utf8');
  const svg = await diagrams([guide.diagram, exampleDiagram(guide)]);
  const fileNames = [];
  const allCaptions = [];
  let offset = 0;
  for (const scene of planned) {
    const sceneFolder = join(folder, scene.id);
    const captions = await jsonFile(join(sceneFolder, 'captions.json'));
    for (const caption of captions) allCaptions.push({ ...caption, start: caption.start + offset, end: caption.end + offset });
    offset += scene.seconds;
    const output = join(folder, 'escena-' + scene.id + '.mp4');
    fileNames.push(basename(output));
    if (await probe(config, output, scene.seconds)) continue;
    const clipCaptions = captions.map((caption, index) => '<div id="caption-' + index + '" class="clip caption" data-start="' + caption.start +
      '" data-duration="' + (caption.end - caption.start).toFixed(3) + '" data-track-index="3">' + escapeHtml(caption.text) + '</div>').join('\n');
    const art = scene.id === '02' ? svg[0] : scene.id === '03' ? svg[1] : '<div class="note">' + escapeHtml(scene.art) + '</div>';
    const content = html.replaceAll('@@SECONDS@@', String(scene.seconds)).replace('@@ROUTE@@', job.track === 'ia' ? 'IA Y DEEP LEARNING' : 'FULL STACK')
      .replace('@@TITLE@@', escapeHtml(job.title.split(' · ').at(-1))).replace('@@SLIDE@@', escapeHtml(scene.title))
      .replace('@@ART@@', () => art).replace('@@CAPTIONS@@', () => clipCaptions);
    await copyFile(require.resolve('gsap/dist/gsap.min.js'), join(sceneFolder, 'gsap.min.js'));
    await writeFile(join(sceneFolder, 'index.html'), content, 'utf8');
    await report({ status: 'rendering', detail: 'HyperFrames · Escena ' + scene.id + ' de ' + planned.length });
    await exec(process.execPath, [hyperframesEntry(), 'render', sceneFolder, '--output', output, '--fps', '30', '--quality', 'looks'], options);
    if (!await probe(config, output, scene.seconds)) throw new Error('La escena no contiene voz y video con la duración prevista.');
  }
  await writeFile(join(folder, 'subtitulos-es.srt'), makeSrt(allCaptions), 'utf8');
  return fileNames;
}

export async function premiere(config, folder, job, files, report) {
  const output = join(folder, 'PlanEstudio-final.mp4');
  if (await probe(config, output, totalSeconds)) return output;
  const input = join(folder, 'premiere.json');
  const errorFile = join(folder, 'premiere-error.json');
  const existing = await readOptional(input);
  const attempts = (existing?.attempt ?? 0) + (await exists(errorFile) || !existing ? 1 : 0);
  await writeJson(input, { id: job.id, attempt: attempts, clips: files });
  await report({ status: 'composition', detail: 'Abre el panel PlanEstudio de Adobe Premiere en Windows.' });
  for (;;) {
    const failure = await readOptional(errorFile);
    if (failure?.attempt === attempts) throw new Error('Premiere no pudo exportar el montaje. Revisa el panel de Premiere.');
    if (await probe(config, output, totalSeconds)) {
      const first = await stat(output);
      await pause(3500);
      if ((await stat(output)).size === first.size) return output;
    }
    await pause(4500);
  }
}

export function jobFolder(root, id) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Identificador inválido del trabajo.');
  const absolute = resolve(root, id);
  if (!absolute.startsWith(resolve(root) + sep)) throw new Error('Carpeta inválida del trabajo.');
  return absolute;
}
