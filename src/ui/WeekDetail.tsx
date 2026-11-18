import { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, CheckCircle2, ChevronDown, Clock3, Download, FileText, Network, Plus, RefreshCw, Video } from 'lucide-react';
import { activityStatus, formatRange, shiftDay, weekStart } from '../core/calendar.ts';
import type { StudyState } from '../core/calendar.ts';
import { activityKey, blockTypes, roadmap, tracks, weekKey } from '../core/curriculum.ts';
import type { Track, Week } from '../core/curriculum.ts';
import type { Guide } from '../core/guides.ts';
import type { Suggestion } from '../core/resources.ts';
import { Badge, Checkbox, TrackIcon } from './components.tsx';
import { renderDiagram } from './diagram.ts';
import { downloadGuide } from './pdf.ts';
import { messageOf, request } from './client.ts';
import { VideoConfirmation } from './StudyForms.tsx';
import type { Save } from './StudyForms.tsx';

type Media = { job: { status: string; detail: string; videoId?: string } | null; channel: { id: string; name: string } | null };
type WeekData = { guide: Guide | null; suggestions: Suggestion[]; video: Media | null };
export type Register = (track?: Track, week?: number, minutes?: number) => void;
const videoStates: Record<string, string> = { queued: 'En cola', rendering: 'Renderizando', composition: 'En composición', uploading: 'Subiendo a YouTube', processing: 'Procesando en YouTube', ready: 'Disponible', error: 'Requiere atención' };

function GuideContent({ guide, svg }: { guide: Guide; svg: string }) {
  return <details className="guide-content">
    <summary><BookOpen size={18} /> Leer guía semanal <ChevronDown size={16} /></summary>
    <div className="guide-body">
      <h3>Conceptos</h3>{guide.theory.map(([title, text]) => <div key={title}><h4>{title}</h4><p>{text}</p></div>)}
      {svg && <div className="mermaid-diagram" role="img" aria-label="Diagrama del tema de esta semana" dangerouslySetInnerHTML={{ __html: svg }} />}
      <h3>Ejemplo trabajado</h3><p>{guide.example}</p>{guide.code && <pre><code>{guide.code}</code></pre>}
      <h3>Laboratorio y proyecto</h3><ol>{guide.lab.map(item => <li key={item}>{item}</li>)}</ol>
      <h3>Modo celular</h3><p>{guide.mobile}</p>
      <h3>Autoevaluación</h3>{guide.quiz.map(([question, answer]) => <details className="quiz" key={question}><summary>{question}</summary><p>{answer}</p></details>)}
      <h3>Criterio de avance</h3><p>{guide.exit}</p>
    </div>
  </details>;
}

export default function WeekDetail({ week, state, register, save, choose }: {
  week: Week; state: StudyState; register: Register; save: Save; choose: (week: Week) => void;
}) {
  const [data, setData] = useState<WeekData>();
  const [error, setError] = useState('');
  const [diagram, setDiagram] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [profile, setProfile] = useState<'mobile' | 'a4'>('mobile');
  const [confirm, setConfirm] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const key = 'weeks/' + week.track + '/' + week.number;
  const date = weekStart(state.settings.start, week.number);
  const title = tracks[week.track].name + ' · Semana ' + week.number + ' · ' + week.title;
  const guide = data?.guide;
  const channel = data?.video?.channel;
  const job = data?.video?.job;
  const status = activityStatus(state, week.track, week.number);
  const refresh = () => request<WeekData>(key).then(setData).catch(failure => setError(messageOf(failure)));
  useEffect(() => {
    let alive = true;
    request<WeekData>(key).then(value => { if (alive) setData(value); }).catch(failure => { if (alive) setError(messageOf(failure)); });
    return () => { alive = false; };
  }, [key, state.resources]);
  useEffect(() => {
    if (!guide) return;
    let alive = true;
    renderDiagram(guide.diagram).then(value => { if (alive) setDiagram(value); }).catch(failure => { if (alive) setError(messageOf(failure)); });
    return () => { alive = false; };
  }, [guide?.diagram]);
  useEffect(() => {
    if (!guide || job?.status === 'ready') return;
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 45_000);
    return () => clearInterval(timer);
  }, [key, Boolean(guide), job?.status]);

  async function pdf() {
    if (!guide || !data) return;
    setPdfBusy(true); setError('');
    try { await downloadGuide(week, guide, diagram || await renderDiagram(guide.diagram), data.suggestions, profile); }
    catch (failure) { setError('No se pudo generar el PDF. ' + messageOf(failure)); }
    finally { setPdfBusy(false); }
  }

  function exportDiagram() {
    if (!guide) return;
    const url = URL.createObjectURL(new Blob([guide.diagram + '\n'], { type: 'text/plain' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'PlanEstudio-' + weekKey(week.track, week.number) + '.mmd';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="card week-detail">
    <header className="week-title"><TrackIcon track={week.track} /><div><p>{tracks[week.track].name} · Semana {week.number} · Mes {week.month}</p><h2>{week.title}</h2></div></header>
    <div className="week-tags"><Badge tone="blue">{formatRange(date, shiftDay(date, 6))}</Badge><Badge><Clock3 size={13} /> 5 h</Badge>
      <Badge tone={status === 'completed' ? 'green' : 'neutral'}>{status === 'completed' ? 'Completada' : status === 'active' ? 'En curso' : 'Pendiente'}</Badge></div>
    <p className="week-outcome">{guide?.outcome ?? week.deliverable}</p>
    <div className="deliverable"><CheckCircle2 size={18} /><div><strong>Entregable</strong><p>{week.deliverable}</p></div></div>
    {week.prerequisites.length > 0 && <div className="prereqs"><h3>Prerrequisitos</h3>{week.prerequisites.map(number => {
      const previous = roadmap[week.track][number - 1];
      return <button className="button quiet" onClick={() => choose(previous)} key={number}><Network size={15} /> {previous.title}
        {activityStatus(state, week.track, number) === 'completed' && <CheckCircle2 size={15} />}</button>;
    })}</div>}
    <h3>Actividades de la semana</h3>
    <div className="week-checks">{blockTypes.map(block => <div key={block.id}><Checkbox label={block.title} checked={state.completions.includes(activityKey(week.track, week.number, block.id))}
      onChange={done => void save('completions', 'PUT', { track: week.track, week: week.number, block: block.id, done }).catch(failure => setError(messageOf(failure)))} />
      <small>{block.check}</small><span>{block.minutes} min</span></div>)}</div>
    <button className="button secondary" onClick={() => register(week.track, week.number)}><Plus size={17} /> Registrar tiempo</button>
    <div className="week-material">
      <h3>Guía y video</h3>
      {guide ? <>
        <div className="guide-actions"><select aria-label="Formato PDF" value={profile} onChange={event => setProfile(event.target.value as typeof profile)}>
          <option value="mobile">Móvil · {week.track === 'ia' ? '108 × 234' : '90 × 195'} mm</option><option value="a4">Escritorio · A4</option></select>
          <button className="button primary" type="button" disabled={pdfBusy} onClick={() => void pdf()}><FileText size={17} />{pdfBusy ? 'Generando…' : 'Generar PDF'}</button></div>
        <GuideContent guide={guide} svg={diagram} />
        <div className="diagram-actions"><button className="button quiet" onClick={exportDiagram}><Download size={16} /> Mermaid</button>
          <a href="https://mermaid.ai/" target="_blank" rel="noreferrer">Abrir Mermaid Chart <ArrowUpRight size={14} /></a></div>
        <div className="video-panel"><Video size={19} /><div><strong>Video · 10:00</strong>
          <p>{job ? videoStates[job.status] : channel ? 'Listo para generar en Windows' : 'Esperando conexión con el PC y YouTube'}</p>
          {job?.detail && <small>{job.detail}</small>}</div>
          {job?.status === 'ready' && job.videoId ? <button className="button secondary" onClick={() => setShowVideo(value => !value)}>{showVideo ? 'Cerrar video' : 'Reproducir'}</button> :
            <button className="button secondary" disabled={!channel || Boolean(job && job.status !== 'error')} onClick={() => setConfirm(true)}><Video size={16} /> Generar video</button>}
          {job?.status !== 'ready' && <button className="icon-button" aria-label="Actualizar estado del video" onClick={() => void refresh()}><RefreshCw size={17} /></button>}
        </div>
        {showVideo && job?.videoId && <iframe className="video-frame" title={title} src={'https://www.youtube-nocookie.com/embed/' + job.videoId} allow="picture-in-picture; fullscreen" allowFullScreen />}
      </> : <p className="muted">{data ? 'El PDF y el video se habilitarán cuando se publique la guía revisada.' : 'Cargando materiales…'}</p>}
    </div>
    {!!data?.suggestions.length && <div className="week-material"><h3>Lecturas, cursos y videos</h3><ul className="suggestions">{data.suggestions.map(item =>
      <li key={item.title}><Badge tone="blue">{item.kind}</Badge><strong>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.title} <ArrowUpRight size={14} /></a> : item.title}</strong><small>{item.why}</small></li>)}</ul></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {confirm && channel && <VideoConfirmation channel={channel} title={title} track={week.track} week={week.number} close={() => setConfirm(false)} update={() => void refresh()} />}
  </section>;
}
