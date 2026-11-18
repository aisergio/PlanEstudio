import { useState } from 'react';
import type { SubmitEvent, ReactNode } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { defaults, todayBogota, trackWeek } from '../core/calendar.ts';
import type { NextStep, Resource, Session, Settings, StudyState, Template } from '../core/calendar.ts';
import { blockTypes, roadmap, trackIds, tracks } from '../core/curriculum.ts';
import type { Track } from '../core/curriculum.ts';
import { Checkbox, Modal, RouteSelect } from './components.tsx';
import { messageOf, request } from './client.ts';

export type Save = (path: string, method: string, body?: unknown) => Promise<void>;
export const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const masteryLabels = ['Por explorar', 'Reconozco los conceptos', 'Aplico con ayuda', 'Aplico sin ayuda', 'Puedo enseñarlo'];

function Form({ onSubmit, onDelete, children, button = 'Guardar' }: { onSubmit: (data: FormData) => Promise<void>; onDelete?: () => Promise<void>; children: ReactNode; button?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(work: () => Promise<void>) {
    setBusy(true); setError('');
    try { await work(); } catch (failure) { setError(messageOf(failure)); setBusy(false); }
  }
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    void run(() => onSubmit(fields));
  };
  return <form className="study-form" onSubmit={submit}>
    {children}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions">
      {onDelete && <button type="button" className="button danger" disabled={busy} onClick={() => {
        if (window.confirm('¿Eliminar este registro?')) void run(onDelete);
      }}><Trash2 size={16} /> Eliminar</button>}
      <button className="button primary" type="submit" disabled={busy}><Save size={16} />{busy ? 'Guardando…' : button}</button>
    </div>
  </form>;
}

export function SessionForm({ state, editing, startTrack = 'ia', startWeek, startMinutes, close, save }: {
  state: StudyState; editing?: Session; startTrack?: Track; startWeek?: number; startMinutes?: number; close: () => void; save: Save;
}) {
  const today = todayBogota();
  const [id] = useState(() => editing?.id ?? crypto.randomUUID());
  const [track, setTrack] = useState(editing?.track ?? startTrack);
  const [week, setWeek] = useState(editing?.week ?? startWeek ?? trackWeek(state.settings.start, today, track) ?? 1);
  const [minutes, setMinutes] = useState(editing?.minutes ?? startMinutes ?? 60);
  const [templateId, setTemplate] = useState(editing?.templateId ?? '');
  const [checks, setChecks] = useState(editing?.checklist ?? []);
  const template = state.templates.find(item => item.id === templateId);
  return <Modal title={editing ? 'Editar sesión' : 'Registrar sesión'} close={close}>
    <Form onSubmit={async fields => {
      const item: Session = {
        id, track, week, minutes, date: String(fields.get('date')),
        mastery: Number(fields.get('mastery')), notes: String(fields.get('notes')), questions: String(fields.get('questions')),
        evidence: String(fields.get('evidence')), templateId, checklist: checks
      };
      await save('sessions', 'PUT', item); close();
    }} onDelete={editing && (async () => { await save('sessions/' + editing.id, 'DELETE'); close(); })} button="Guardar sesión">
      <div className="field-row">
        <label>Ruta<RouteSelect all={false} value={track} set={value => {
          const next = value as Track; setTrack(next); setWeek(trackWeek(state.settings.start, today, next) ?? 1);
        }} /></label>
        <label>Semana<select aria-label="Semana de la sesión" value={week} onChange={event => setWeek(Number(event.target.value))}>
          {roadmap[track].map(item => <option key={item.number} value={item.number}>{item.number} · {item.title}</option>)}
        </select></label>
      </div>
      <label>Plantilla de sesión<select value={templateId} onChange={event => {
        setTemplate(event.target.value); setChecks([]);
        const selected = state.templates.find(item => item.id === event.target.value);
        if (selected) setMinutes(selected.minutes);
      }}><option value="">Sin plantilla</option>{state.templates.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      {template && <fieldset className="form-checks"><legend>Checklist</legend>{template.checklist.map(label =>
        <Checkbox key={label} label={label} checked={checks.includes(label)} onChange={done => setChecks(items => done ? [...items, label] : items.filter(item => item !== label))} />)}</fieldset>}
      <div className="field-row">
        <label>Fecha<input name="date" type="date" max={today} defaultValue={editing?.date ?? today} required /></label>
        <label>Minutos estudiados<input name="minutes" type="number" min={1} max={1440} value={minutes || ''} onChange={event => setMinutes(Number(event.target.value))} required /></label>
      </div>
      <label>Nivel de dominio<select name="mastery" defaultValue={editing?.mastery ?? 0}>{masteryLabels.map((title, index) => <option key={title} value={index}>{index} · {title}</option>)}</select></label>
      <label>Evidencia<input name="evidence" maxLength={500} defaultValue={editing?.evidence} placeholder="Enlace, archivo o resultado" /></label>
      <label>Notas<textarea name="notes" maxLength={2000} defaultValue={editing?.notes} rows={2} /></label>
      <label>Dudas<textarea name="questions" maxLength={1600} defaultValue={editing?.questions} rows={2} /></label>
    </Form>
  </Modal>;
}

export function SettingsForm({ current, close, save }: { current: Settings; close: () => void; save: Save }) {
  return <Modal title="Editar calendario" close={close}>
    <Form button="Guardar calendario" onSubmit={async fields => {
      const days = defaults().days;
      for (const track of trackIds) for (const block of blockTypes) days[track][block.id] = Number(fields.get(track + '-' + block.id));
      await save('settings', 'PUT', { start: fields.get('start'), days }); close();
    }}>
      <label>Fecha de inicio<input name="start" type="date" min="2000-01-01" max="2099-12-31" required defaultValue={current.start} /></label>
      <small>La primera semana del plan empieza el lunes de la fecha elegida.</small>
      {trackIds.map(track => <fieldset className="form-checks" key={track}><legend>{tracks[track].name} · 5 h a la semana</legend><div className="field-row">
        {blockTypes.map(block => <label key={block.id}>{block.title} · {block.minutes} min
          <select name={track + '-' + block.id} defaultValue={current.days[track][block.id]}>{dayNames.map((day, index) => <option key={day} value={index}>{day}</option>)}</select>
        </label>)}
      </div></fieldset>)}
    </Form>
  </Modal>;
}

export function ResourceForm({ item, close, save }: { item?: Resource; close: () => void; save: Save }) {
  const [id] = useState(() => item?.id ?? crypto.randomUUID());
  const [track, setTrack] = useState<Track | 'all'>(item?.track ?? 'all');
  const modules = [...new Set((track === 'all' ? trackIds.flatMap(id => roadmap[id]) : roadmap[track]).map(week => week.module))];
  return <Modal title={item ? 'Editar recurso' : 'Agregar recurso'} close={close}>
    <Form button="Guardar recurso" onSubmit={async fields => {
      await save('resources', 'PUT', { id, title: fields.get('title'), url: fields.get('url'),
        track: track === 'all' ? undefined : track, module: fields.get('module') || undefined, note: fields.get('note') || undefined });
      close();
    }} onDelete={item && (async () => { await save('resources/' + item.id, 'DELETE'); close(); })}>
      <label>Título<input name="title" required maxLength={200} defaultValue={item?.title} /></label>
      <label>URL<input name="url" type="url" required maxLength={1800} defaultValue={item?.url} placeholder="https://" /></label>
      <div className="field-row"><label>Ruta opcional<RouteSelect value={track} set={setTrack} /></label>
        <label>Módulo opcional<select key={track} name="module" defaultValue={modules.includes(item?.module ?? '') ? item?.module : ''}>
          <option value="">Sin módulo</option>{modules.map(module => <option key={module}>{module}</option>)}</select></label></div>
      <label>Nota<textarea name="note" rows={3} maxLength={600} defaultValue={item?.note} /></label>
    </Form>
  </Modal>;
}

export function TemplateForm({ item, close, save }: { item?: Template; close: () => void; save: Save }) {
  const [id] = useState(() => item?.id ?? crypto.randomUUID());
  return <Modal title={item ? 'Editar plantilla' : 'Nueva plantilla de sesión'} close={close}>
    <Form onSubmit={async fields => {
      const checklist = [...new Set(String(fields.get('checklist')).split('\n').map(line => line.trim()).filter(Boolean))];
      await save('templates', 'PUT', { id, title: fields.get('title'), minutes: Number(fields.get('minutes')), checklist }); close();
    }} onDelete={item && (async () => { await save('templates/' + item.id, 'DELETE'); close(); })}>
      <label>Título<input name="title" required maxLength={100} defaultValue={item?.title} /></label>
      <label>Duración en minutos<input name="minutes" type="number" min={1} max={1440} defaultValue={item?.minutes ?? 60} required /></label>
      <label>Checklist, una tarea por línea<textarea name="checklist" rows={5} maxLength={2000} defaultValue={item?.checklist.join('\n')} /></label>
    </Form>
  </Modal>;
}

export function NextForm({ item, close, save }: { item?: NextStep; close: () => void; save: Save }) {
  const [id] = useState(() => item?.id ?? crypto.randomUUID());
  const [track, setTrack] = useState<Track | 'all'>(item?.track ?? 'all');
  return <Modal title={item ? 'Editar próximo paso' : 'Agregar próximo paso'} close={close}>
    <Form onSubmit={async fields => {
      await save('next', 'PUT', { id, title: fields.get('title'), track: track === 'all' ? undefined : track, done: item?.done ?? false }); close();
    }} onDelete={item && (async () => { await save('next/' + item.id, 'DELETE'); close(); })}>
      <label>Próximo paso<input name="title" maxLength={200} defaultValue={item?.title} required /></label>
      <label>Ruta opcional<RouteSelect value={track} set={setTrack} /></label>
    </Form>
  </Modal>;
}

export function VideoConfirmation({ title, channel, track, week, close, update }: {
  title: string; channel: { id: string; name: string }; track: Track; week: number; close: () => void; update: () => void;
}) {
  return <Modal title="Confirmar publicación en YouTube" close={close}>
    <Form button="Confirmar y generar" onSubmit={async () => {
      await request('videos', 'POST', { track, week, channelId: channel.id, confirmed: true }); update(); close();
    }}>
      <dl className="publish-details"><dt>Título</dt><dd>{title}</dd><dt>Canal</dt><dd>{channel.name}</dd><dt>Visibilidad</dt><dd>Público</dd><dt>Duración</dt><dd>10:00</dd></dl>
      <p>El PC generará el video y lo publicará en este canal al terminar.</p>
    </Form>
  </Modal>;
}
