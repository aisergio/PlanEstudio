import assert from 'node:assert/strict';
import test from 'node:test';
import { activityKey, blockTypes, roadmap, trackIds, tracks, weekKey } from '../src/core/curriculum.ts';
import { completion, defaults, periodBounds, todayBogota, trackWeek, validDay, weekStart, weeklyProgress } from '../src/core/calendar.ts';
import { guides } from '../src/core/guides.ts';
import { api } from '../src/server/api.ts';
import { devAuth, ownerTrigger } from '../src/server/auth.ts';
import { LocalStore } from '../src/server/local-store.ts';
import { loadState } from '../src/server/store.ts';
import { reserveTurn } from '../src/server/tutor.ts';
import { claim, enqueue, updateJob, videoStatus } from '../src/server/video-queue.ts';
import { makeSrt, scenes, totalSeconds } from '../video/scenes.mjs';

const session = (track, date, minutes) => ({ id: crypto.randomUUID(), track, date, minutes, week: 1, mastery: 2, notes: '', questions: '', evidence: '', templateId: '', checklist: [] });
const app = 'http://127.0.0.1:4321';
const blank = start => ({ settings: defaults(start), sessions: [], completions: [], resources: [], next: [], templates: [] });

test('las rutas suman 130 semanas y 650 horas, con dependencias anteriores', () => {
  for (const track of trackIds) {
    assert.equal(roadmap[track].length, tracks[track].weeks);
    assert.equal(roadmap[track].at(-1).month, tracks[track].months);
    for (const week of roadmap[track]) {
      assert.ok(week.title && week.deliverable);
      assert.ok(week.prerequisites.every(prerequisite => prerequisite > 0 && prerequisite < week.number));
    }
  }
  assert.deepEqual(roadmap.fullstack.filter((week, idx, all) => all[idx + 1]?.month !== week.month).map(week => week.number),
    [4, 8, 13, 16, 20, 26, 30, 35, 39, 45, 49, 52]);
  const state = blank('2026-01-05');
  const end = weekStart(state.settings.start, 78);
  const points = weeklyProgress(state, 'all', 'custom', end, state.settings.start, end);
  assert.equal(points.filter(point => point.goal === 600).length, 52);
  assert.equal(points.filter(point => point.goal === 300).length, 26);
  assert.equal(points.reduce((minutes, point) => minutes + point.goal, 0), 650 * 60);
  assert.equal(trackWeek(state.settings.start, end, 'fullstack'), null);
});

test('calendario de Bogotá, fechas válidas y semanas sin registros', () => {
  assert.equal(todayBogota(new Date('2026-11-23T04:59:59Z')), '2026-11-22');
  assert.equal(todayBogota(new Date('2026-11-23T05:00:00Z')), '2026-11-23');
  assert.equal(validDay('2026-02-30'), false);
  assert.equal(validDay('2028-02-29'), true);
  const state = blank('2026-11-09');
  state.sessions.push(session('ia', '2026-11-15', 49), session('fullstack', '2026-11-16', 60), session('ia', '2026-11-22', 11));
  const points = weeklyProgress(state, 'all', 4, '2026-11-22');
  assert.deepEqual(points.map(point => point.minutes), [null, null, 49, 71]);
  assert.deepEqual(points.map(point => point.goal), [0, 0, 600, 600]);
  assert.equal(points.at(-1).partial, true);
  assert.deepEqual(weeklyProgress(state, 'ia', 1, '2026-11-22').map(point => point.minutes), [11]);
  assert.equal(weeklyProgress(state, 'ia', 13, '2026-11-23').length, 13);
  assert.throws(() => periodBounds('custom', '2026-11-22', '2026-02-30', '2026-11-22'), RangeError);
});

test('las ocho guías incluyen caso trabajado, laboratorio, evaluación y origen Mermaid', () => {
  assert.equal(Object.keys(guides).length, 8);
  for (const track of trackIds) for (const week of [1, 2, 3, 4]) {
    const guide = guides[weekKey(track, week)];
    assert.ok(guide.theory.length >= 4 && guide.example && guide.code && guide.exit && guide.mobile && guide.lab.length >= 3 && guide.quiz.length >= 2);
    assert.match(guide.diagram, /^(flowchart|sequenceDiagram)/);
  }
  const state = blank('2026-11-16');
  state.sessions.push(session('ia', state.settings.start, 60));
  assert.equal(completion(state, 'ia').completed, 0);
  state.completions = blockTypes.map(block => activityKey('ia', 1, block.id));
  assert.equal(completion(state, 'ia').completed, 4);
});

test('API de estudio y MCP comparten minutos y las herramientas son de solo lectura', async () => {
  const store = new LocalStore();
  const run = api({ auth: devAuth(app), store, library: async () => [
    { title: 'Mathematics for Machine Learning', author: 'Autor de prueba', topic: 'Matemáticas', series: '', note: '' }
  ] });
  const [today, entry] = [todayBogota(), session('ia', todayBogota(), 81)];
  const put = path => run(new Request(app + '/PlanEstudio/api/sessions', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: path }, body: JSON.stringify(entry)
  }));
  assert.equal((await put('https://other.test')).status, 403);
  assert.equal((await put(app)).status, 200);
  assert.equal((await put(app)).status, 200);
  const state = await loadState(store);
  assert.equal(state.sessions.length, 1);
  const body = (method, params = {}, id = 1) => ({ jsonrpc: '2.0', id, method, params });
  const mcp = (payload, authorized = true) => run(new Request(app + '/PlanEstudio/mcp', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
      ...(authorized ? { Authorization: 'Bearer planestudio-local' } : {}) }, body: JSON.stringify(payload)
  }));
  assert.equal((await mcp(body('tools/list'), false)).status, 401);
  const response = await mcp(body('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).result.serverInfo.name, 'planestudio');
  const listed = (await (await mcp(body('tools/list'))).json()).result.tools;
  assert.equal(listed.length, 3);
  assert.ok(listed.every(tool => tool.annotations.readOnlyHint));
  const progress = (await (await mcp(body('tools/call', { name: 'progreso_semanal', arguments: { ruta: 'ia', periodo: 1 } }))).json()).result.structuredContent;
  assert.deepEqual(progress.semanas, weeklyProgress(state, 'ia', 1, today));
  const current = (await (await mcp(body('tools/call', { name: 'semana_en_curso', arguments: {} }))).json()).result.structuredContent;
  assert.equal(current.rutas[0].semana, 1);
  const material = (await (await mcp(body('tools/call', { name: 'material_sugerido', arguments: { ruta: 'ia' } }))).json()).result.structuredContent;
  assert.equal(material.sugerencias.length, 3);
  assert.ok(material.sugerencias.every(item => item.why));
});

test('la identidad requiere la cuenta de Google verificada', () => {
  const data = { triggerSource: 'TokenGeneration_HostedAuth', userName: 'Google_test', request: { userAttributes: {
    email: 'owner@example.com', email_verified: 'true', sub: 'uid' } }, response: {} };
  assert.equal(ownerTrigger(data, 'owner@example.com').response.claimsAndScopeOverrideDetails.accessTokenGeneration.claimsToAddOrOverride.planestudio_owner, 'true');
  assert.throws(() => ownerTrigger({ ...data, userName: 'test' }, 'owner@example.com'));
  assert.throws(() => ownerTrigger(data, 'someone@example.com'));
  assert.throws(() => ownerTrigger({ ...data, request: { userAttributes: { ...data.request.userAttributes, email_verified: 'false' } } }, 'owner@example.com'));
});

test('el tutor limita las reservas simultáneas y renueva el cupo al cambiar de mes', async () => {
  const store = new LocalStore();
  await store.put('budget/2026-11', 499);
  const two = await Promise.allSettled([reserveTurn(store, '2026-11-20'), reserveTurn(store, '2026-11-20')]);
  assert.equal(two.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(two.find(item => item.status === 'rejected').reason.status, 429);
  assert.equal(await reserveTurn(store, '2026-12-01'), 499);
});

test('la cola de video valida canal y evita dos ejecuciones simultáneas', async () => {
  const store = new LocalStore();
  const channelId = 'UC' + 'A'.repeat(22);
  const spec = { track: 'ia', week: 1, version: '1.0', title: 'Video de prueba', channelId };
  const worker = { key: 'pc', name: 'Prueba', channelId, channel: 'Canal de prueba' };
  await assert.rejects(() => enqueue(store, spec), { status: 409 });
  await claim(store, worker);
  await enqueue(store, spec);
  await enqueue(store, spec);
  const jobs = await Promise.all([claim(store, worker), claim(store, { ...worker, key: 'otro' })]);
  const job = jobs.find(Boolean);
  assert.equal(jobs.filter(Boolean).length, 1);
  await updateJob(store, job.key, job.lease, { status: 'ready', videoId: 'abcdefghijk', detail: '' });
  assert.equal((await videoStatus(store, 'ia', 1, '1.0')).job.videoId, 'abcdefghijk');
  assert.equal(await claim(store, worker), null);
});

test('la composición semanal define diez minutos y un archivo de subtítulos con tiempos', () => {
  for (const guide of Object.values(guides)) {
    const timeline = scenes(guide);
    assert.equal(timeline.length, 6);
    assert.equal(timeline.reduce((seconds, item) => seconds + item.seconds, 0), totalSeconds);
    assert.equal(totalSeconds, 600);
    assert.ok(timeline.every(item => item.lines.length > 2 && item.lines.every(line => line.length <= 105)));
  }
  assert.match(makeSrt([{ start: 24.5, end: 28, text: 'Practica el ejemplo' }]), /00:00:24,500 --> 00:00:28,000/);
});
