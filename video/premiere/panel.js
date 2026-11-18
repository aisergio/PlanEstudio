const premiere = require('premierepro');
const fs = require('uxp').storage.localFileSystem;
const $ = id => document.getElementById(id);
let active = false;
let busy = false;
let root;
let preset;

const status = message => { $('status').textContent = message; };
async function optional(folder, name) {
  try { return await folder.getEntry(name); } catch (_) { return null; }
}
async function restore(name) {
  const token = localStorage.getItem('planestudio-' + name);
  if (!token) return undefined;
  try { return await fs.getEntryForPersistentToken(token); } catch (_) { return undefined; }
}
async function chooseLocal(name) {
  const entry = name === 'folder' ? await fs.getFolder() : await fs.getFileForOpening({ types: ['epr'] });
  if (!entry) return;
  if (name === 'folder') root = entry; else preset = entry;
  localStorage.setItem('planestudio-' + name, await fs.createPersistentToken(entry));
  status('Selección guardada.');
}

async function compose(folder, job) {
  if (job.id !== folder.name || !/^[a-f0-9-]{36}$/.test(job.id) || !Number.isInteger(job.attempt)
      || JSON.stringify(job.clips) !== JSON.stringify(['escena-01.mp4', 'escena-02.mp4', 'escena-03.mp4', 'escena-04.mp4', 'escena-05.mp4', 'escena-06.mp4'])) {
    throw new Error('Trabajo inválido.');
  }
  const projectName = 'PlanEstudio.prproj';
  const projectPath = folder.nativePath + '\\' + projectName;
  const activeProject = await premiere.Project.getActiveProject();
  const project = activeProject?.path === projectPath ? activeProject :
    await (await optional(folder, projectName) ? premiere.Project.openProject(projectPath) : premiere.Project.createProject(projectPath));
  const bin = await project.getRootItem();
  let sequence = (await project.getSequences()).find(item => item.name === 'Guía PlanEstudio');
  if (!sequence) {
    const paths = [];
    const existing = await bin.getItems();
    for (const name of job.clips) if (!existing.some(item => item.name === name)) paths.push((await folder.getEntry(name)).nativePath);
    if (paths.length && !await project.importFiles(paths, true, bin, false)) throw new Error('No se importaron las escenas.');
    const items = await bin.getItems();
    const ordered = job.clips.map(name => {
      const item = items.find(candidate => candidate.name === name);
      if (!item) throw new Error('Falta la escena ' + name);
      return premiere.ClipProjectItem.cast(item);
    });
    sequence = await project.createSequenceFromMedia('Guía PlanEstudio', ordered, bin);
    await project.save();
  }
  const extension = await premiere.EncoderManager.getExportFileExtension(sequence, preset.nativePath);
  if (extension.replace(/^\./, '').toLowerCase() !== 'mp4') throw new Error('El ajuste debe exportar MP4 H.264.');
  const output = folder.nativePath + '\\PlanEstudio-final.mp4';
  const manager = premiere.EncoderManager.getManager();
  const success = await manager.exportSequence(sequence, premiere.Constants.ExportType.IMMEDIATELY, output, preset.nativePath, true);
  if (!success) throw new Error('Premiere no pudo exportar la secuencia.');
}

async function tick() {
  if (!active || busy || !root || !preset) return;
  busy = true;
  try {
    for (const folder of await root.getEntries()) {
      if (!active || !folder.isFolder) continue;
      const request = await optional(folder, 'premiere.json');
      if (!request) continue;
      const job = JSON.parse(await request.read());
      const done = await optional(folder, 'premiere-done.json');
      if (done && JSON.parse(await done.read()).attempt === job.attempt && await optional(folder, 'PlanEstudio-final.mp4')) continue;
      const previous = await optional(folder, 'premiere-error.json');
      if (previous && JSON.parse(await previous.read()).attempt === job.attempt) continue;
      status('Montando la guía en Premiere…');
      try {
        await compose(folder, job);
        const result = await folder.createFile('premiere-done.json', { overwrite: true });
        await result.write(JSON.stringify({ attempt: job.attempt }));
        status('Montaje exportado. PlanEstudio verificará el MP4.');
      } catch (error) {
        const result = await folder.createFile('premiere-error.json', { overwrite: true });
        await result.write(JSON.stringify({ attempt: job.attempt }));
        status(error.message || 'Error al exportar');
      }
      break;
    }
  } finally { busy = false; }
}

$('folder').onclick = () => { void chooseLocal('folder').catch(error => status(error.message)); };
$('preset').onclick = () => { void chooseLocal('preset').catch(error => status(error.message)); };
$('start').onclick = async () => {
  if (active) { active = false; $('start').textContent = 'Iniciar revisión de la cola'; status('Revisión pausada.'); return; }
  root ||= await restore('folder');
  preset ||= await restore('preset');
  if (!root || !preset) { status('Selecciona primero la carpeta y el ajuste de exportación.'); return; }
  active = true;
  $('start').textContent = 'Pausar revisión de la cola';
  status('Esperando trabajos de PlanEstudio.');
};
setInterval(() => { void tick().catch(error => status(error.message)); }, 4500);
