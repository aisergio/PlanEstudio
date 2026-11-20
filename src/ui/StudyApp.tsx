import { useCallback, useEffect, useState } from 'react';
import type { SubmitEvent, ReactNode } from 'react';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, ChartNoAxesCombined, ChevronLeft,
  ChevronRight, CircleHelp, ClipboardList, Clock3, ExternalLink, GraduationCap, House, Layers3, Link2, ListChecks,
  LogOut, Menu, Pencil, Plus, Route as RouteIcon, Search, Settings2, Sparkles, Target, X } from 'lucide-react';
import { activityStatus, completion, formatDay, formatRange, monday, shiftDay, todayBogota, trackWeek, upcoming, weekStart, weeklyProgress } from '../core/calendar.ts';
import type { Book, Day, NextStep, Resource, Session, StudyState, Template } from '../core/calendar.ts';
import { roadmap, trackIds, tracks, weekKey } from '../core/curriculum.ts';
import type { RouteFilter, Track, Week } from '../core/curriculum.ts';
import { ApiError, base, finishLogin, messageOf, request, signIn } from './client.ts';
import type { LoginConfig } from './client.ts';
import { Badge, Checkbox, Empty, RouteSelect, TrackIcon } from './components.tsx';
import ProgressChart from './ProgressChart.tsx';
import WeekDetail from './WeekDetail.tsx';
import type { Register } from './WeekDetail.tsx';
import { NextForm, ResourceForm, SessionForm, SettingsForm, TemplateForm, masteryLabels } from './StudyForms.tsx';
import type { Save } from './StudyForms.tsx';

type Bootstrap = { state: StudyState; books: Book[]; guides: string[]; tutor: boolean; video: boolean };
type Panel = { kind: 'session'; editing?: Session; track?: Track; week?: number; minutes?: number } |
  { kind: 'settings' } | { kind: 'resource'; item?: Resource } | { kind: 'template'; item?: Template } | { kind: 'next'; item?: NextStep };
const items = [
  { id: 'inicio', title: 'Inicio', icon: House },
  { id: 'rutas', title: 'Rutas de estudio', icon: Layers3 },
  { id: 'calendario', title: 'Calendario', icon: CalendarDays },
  { id: 'progreso', title: 'Progreso', icon: ChartNoAxesCombined },
  { id: 'biblioteca', title: 'Biblioteca', icon: BookOpen },
  { id: 'recursos-adicionales', title: 'Recursos adicionales', icon: Link2 },
  { id: 'tutor', title: 'Tutor IA', icon: Sparkles }
];
const titles: Record<string, [string, string]> = {
  inicio: ['Tu semana de estudio', 'Organiza tus sesiones y sigue el avance de tus dos rutas.'],
  rutas: ['Rutas de estudio', 'Explora el itinerario, sus actividades y el entregable de cada semana.'],
  calendario: ['Calendario', 'Planifica tus bloques y revisa las sesiones que ya registraste.'],
  progreso: ['Progreso', 'Compara los minutos estudiados con el objetivo y revisa tus actividades completadas.'],
  biblioteca: ['Biblioteca', 'Consulta los libros que tienes disponibles para estudiar.'],
  'recursos-adicionales': ['Recursos adicionales', 'Guarda los enlaces que quieras reutilizar en tu plan de estudio.'],
  tutor: ['Tutor IA', 'Repasa la guía semanal y aclara dudas con Amazon Nova 2 Lite.']
};
const link = (view: string) => base + (view === 'inicio' ? '' : view + '/');
const weekLink = (track: Track, week: number) => link('rutas') + '?' + new URLSearchParams({ ruta: track, semana: String(week) });
const clean = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function Brand() {
  return <a className="brand" href={base}><span className="brand-mark"><GraduationCap size={25} strokeWidth={1.9} /></span><span>PlanEstudio<small>ESPACIO PERSONAL</small></span></a>;
}

function RouteCard({ track, state, date }: { track: Track; state: StudyState; date: Day }) {
  const route = tracks[track];
  const progress = completion(state, track);
  const current = trackWeek(state.settings.start, date, track);
  const week = roadmap[track][(current ?? (date < state.settings.start ? 1 : route.weeks)) - 1];
  return <a className={'card route-card ' + track} href={weekLink(track, week.number)}>
    <header><TrackIcon track={track} /><div><h3>{route.name}</h3><span>{route.months} meses · {route.weeks} semanas</span></div><ArrowUpRight className="route-arrow" size={19} /></header>
    <div className="route-focus"><span>{current ? 'Semana ' + week.number : date < state.settings.start ? 'Primera semana' : 'Última semana'}</span><strong>{week.title}</strong></div>
    <div className="track-meter" role="progressbar" aria-label={'Actividades de ' + route.name} aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.completed}><span style={{ width: progress.percent + '%' }} /></div>
    <div className="route-meta"><span>{progress.completed} de {progress.total} actividades</span><strong>{progress.percent} %</strong></div>
  </a>;
}

function UpcomingCard({ state, date, register }: { state: StudyState; date: Day; register: Register }) {
  const entries = upcoming(state, date, 'all', 3).filter(item => item.date >= date).slice(0, 4);
  return <section className="card upcoming-card">
    <header className="card-header"><div className="section-identity"><span className="section-icon"><CalendarDays size={21} /></span><div><h2>Próximas sesiones</h2><p>Tu agenda de estudio</p></div></div></header>
    {entries.length ? <ul className="agenda">{entries.map(entry => <li key={entry.track + entry.week + entry.block.id}>
      <TrackIcon track={entry.track} size={17} /><div><strong>{entry.block.title}</strong><small>{formatDay(entry.date, true)} · {tracks[entry.track].short}</small></div>
      <button className="agenda-minutes" title="Registrar esta sesión" onClick={() => register(entry.track, entry.week, entry.block.minutes)}>{entry.block.minutes} min</button>
    </li>)}</ul> : <Empty title="Sin sesiones próximas">Puedes ajustar las fechas desde el calendario.</Empty>}
    <a className="text-link" href={link('calendario')}>Ver calendario <ArrowRight size={15} /></a>
  </section>;
}

function NextCard({ state, panel, save }: { state: StudyState; panel: (panel: Panel) => void; save: Save }) {
  const [error, setError] = useState('');
  const ordered = [...state.next].sort((a, b) => Number(a.done) - Number(b.done));
  return <section className="card next-card">
    <header className="card-header"><div className="section-identity"><span className="section-icon"><ListChecks size={22} /></span><div><h2>Próximos pasos</h2><p>Tareas que quieres retomar</p></div></div>
      <button className="button secondary" onClick={() => panel({ kind: 'next' })}><Plus size={16} /> Agregar</button></header>
    {ordered.length ? <ul className="entry-list">{ordered.map(item => <li key={item.id}>
      <Checkbox label={item.title} checked={item.done} onChange={done => void save('next', 'PUT', { ...item, done }).catch(failure => setError(messageOf(failure)))} />
      {item.track && <Badge tone="blue">{tracks[item.track].short}</Badge>}
      <button className="icon-button" aria-label={'Editar ' + item.title} onClick={() => panel({ kind: 'next', item })}><Pencil size={16} /></button>
    </li>)}</ul> : <Empty title="Sin próximos pasos">Agrega una tarea para retomar en tu próxima sesión.</Empty>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}

function Dashboard({ state, date, register, panel, save }: { state: StudyState; date: Day; register: Register; panel: (panel: Panel) => void; save: Save }) {
  const [point] = weeklyProgress(state, 'all', 1, date);
  const firstActive = trackIds.find(track => trackWeek(state.settings.start, date, track));
  const week = firstActive ? trackWeek(state.settings.start, date, firstActive)! : date < state.settings.start ? 1 : 78;
  return <>
    <section className="week-banner">
      <div className="hero-orbit" aria-hidden="true" />
      <div className="hero-content">
        <span className="hero-date"><span /> {formatRange(point.start, point.end).toUpperCase()}</span>
        <h2>Semana {week} <span>/ 78</span></h2>
        <p>{point.goal === 600 ? 'Dos rutas · Diez horas de estudio' : point.goal === 300 ? 'IA y Deep Learning · Cinco horas de estudio' : 'Consulta las fechas de tu calendario'}</p>
        <a className="hero-link" href={weekLink(firstActive ?? 'ia', week)}>Abrir plan semanal <ArrowRight size={16} /></a>
      </div>
      <div className="hero-stats"><div><span><Clock3 size={17} /> Estudiado</span><strong>{point.minutes ?? 0}<small> min</small></strong></div>
        <div><span><Target size={17} /> Objetivo</span><strong>{point.goal}<small> min</small></strong></div></div>
    </section>
    <div className="dashboard-routes">{trackIds.map(track => <RouteCard key={track} track={track} state={state} date={date} />)}</div>
    <div className="dashboard-bottom"><ProgressChart state={state} today={date} /><UpcomingCard state={state} date={date} register={register} /></div>
    <NextCard state={state} panel={panel} save={save} />
  </>;
}

function RoadmapView({ state, date, guides, register, save }: { state: StudyState; date: Day; guides: string[]; register: Register; save: Save }) {
  const query = new URLSearchParams(location.search);
  const initial = query.get('ruta') === 'fullstack' ? 'fullstack' : 'ia';
  const [track, setTrack] = useState<Track>(initial);
  const [week, setWeek] = useState(roadmap[initial][Number(query.get('semana')) - 1] ?? roadmap[initial][(trackWeek(state.settings.start, date, initial) ?? 1) - 1]);
  const [module, setModule] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [openMonth, setOpenMonth] = useState(week.month);
  const modules = [...new Set(roadmap[track].map(item => item.module))];
  const visible = roadmap[track].filter(item => {
    const start = weekStart(state.settings.start, item.number);
    return (!module || item.module === module) && (!status || activityStatus(state, track, item.number) === status)
      && (!from || shiftDay(start, 6) >= from) && (!to || start <= to);
  });
  function choose(item: Week) {
    setWeek(item); setOpenMonth(item.month);
    history.replaceState(null, '', weekLink(item.track, item.number));
  }
  return <>
    <div className="tabs" aria-label="Ruta de estudio">{trackIds.map(id => <button key={id} aria-pressed={track === id} onClick={() => {
      setTrack(id); setModule(''); setStatus(''); choose(roadmap[id][(trackWeek(state.settings.start, date, id) ?? 1) - 1]);
    }}><TrackIcon track={id} size={17} />{tracks[id].name}<span>{tracks[id].weeks} sem</span></button>)}</div>
    <div className="roadmap-grid">
      <section className="card roadmap-list"><header className="card-header"><div><h2>Itinerario</h2><p>{tracks[track].caption}</p></div></header>
        <div className="filters two"><label>Módulo<select value={module} onChange={event => setModule(event.target.value)}><option value="">Todos</option>{modules.map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Estado<select value={status} onChange={event => setStatus(event.target.value)}><option value="">Todos</option><option value="pending">Pendiente</option><option value="active">En curso</option><option value="completed">Completada</option></select></label>
          <label>Desde<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label>Hasta<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div>
        {!visible.length && <Empty title="Ninguna semana coincide">Cambia alguno de los filtros.</Empty>}
        <div className="months">{[...new Set(visible.map(item => item.month))].map(month => {
          const group = visible.filter(item => item.month === month);
          const show = openMonth === month || Boolean(module || status || from || to);
          return <div className="month" key={month}>
            <button className="month-title" aria-expanded={show} onClick={() => setOpenMonth(openMonth === month ? 0 : month)}>
              <span>Mes {month}</span><small>{group.length} sem</small><ChevronRight size={17} className={show ? 'expanded' : ''} /></button>
            {show && group.map(item => <button className={'road-week ' + (item.number === week.number ? 'current' : '')} key={item.number}
              aria-current={item.number === week.number ? 'true' : undefined} onClick={() => choose(item)}>
              <span className={'week-number ' + activityStatus(state, track, item.number)}>{String(item.number).padStart(2, '0')}</span><span>{item.title}
                <small>{item.module}{guides.includes(weekKey(track, item.number)) ? ' · Guía' : ''}</small></span></button>)}
          </div>;
        })}</div>
      </section>
      <WeekDetail key={weekKey(week.track, week.number)} week={week} state={state} register={register} save={save} choose={choose} />
    </div>
  </>;
}

function CalendarView({ state, date, panel, register }: { state: StudyState; date: Day; panel: (panel: Panel) => void; register: Register }) {
  const [selected, setSelected] = useState(monday(date));
  const [filter, setFilter] = useState<RouteFilter>('all');
  const [module, setModule] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const eligible = (item: { track: Track; week: number }) => (filter === 'all' || item.track === filter)
    && (!module || roadmap[item.track][item.week - 1]?.module === module);
  const scheduled = upcoming(state, selected, filter, 1).filter(eligible);
  const history = state.sessions.filter(item => eligible(item) && (!from || item.date >= from) && (!to || item.date <= to));
  const modules = [...new Set((filter === 'all' ? trackIds.flatMap(item => roadmap[item]) : roadmap[filter]).map(item => item.module))];
  const [planned] = weeklyProgress(state, filter, 'custom', date, selected, selected);
  return <>
    <section className="card calendar-card">
      <header className="card-header"><div className="section-identity"><span className="section-icon"><CalendarDays size={22} /></span>
        <div><h2>Semana del {formatRange(selected, shiftDay(selected, 6))}</h2><p>{planned.goal} min planificados · Inicio {formatDay(state.settings.start)}</p></div></div>
        <button className="button secondary" onClick={() => panel({ kind: 'settings' })}><Settings2 size={16} /> Editar calendario</button></header>
      <div className="calendar-controls"><div className="button-group">
        <button className="icon-button" aria-label="Calendario semana anterior" onClick={() => setSelected(shiftDay(selected, -7))}><ChevronLeft size={19} /></button>
        <button className="button quiet" onClick={() => setSelected(monday(date))}>Esta semana</button>
        <button className="icon-button" aria-label="Calendario semana siguiente" onClick={() => setSelected(shiftDay(selected, 7))}><ChevronRight size={19} /></button></div>
        <RouteSelect label="Ruta del calendario" value={filter} set={value => { setFilter(value); setModule(''); }} />
        <select aria-label="Módulo del calendario" value={module} onChange={event => setModule(event.target.value)}><option value="">Todos los módulos</option>{modules.map(item => <option key={item}>{item}</option>)}</select>
      </div>
      {scheduled.length ? <ul className="entry-list">{scheduled.map(item => <li key={item.track + item.block.id}>
        <TrackIcon track={item.track} size={17} /><div className="entry-main"><strong>{item.block.title}</strong><small>{formatDay(item.date)} · {item.title}</small></div>
        <Badge>{item.block.minutes} min</Badge><button className="button secondary" onClick={() => register(item.track, item.week, item.block.minutes)}>Registrar</button>
      </li>)}</ul> : <Empty title="Sin actividades pendientes para esta semana" />}
    </section>
    <section className="card calendar-card">
      <header className="card-header"><div className="section-identity"><span className="section-icon"><ClipboardList size={21} /></span><div><h2>Sesiones registradas</h2><p>{history.length} registros</p></div></div>
        <button className="button secondary" onClick={() => register()}><Plus size={16} /> Registrar</button></header>
      <div className="calendar-controls"><label>Desde<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
        <label>Hasta<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div>
      {history.length ? <ul className="entry-list">{history.map(item => <li key={item.id}>
        <TrackIcon track={item.track} size={17} /><div className="entry-main"><strong>{roadmap[item.track][item.week - 1]?.title}</strong>
          <small>{formatDay(item.date)} · Dominio {item.mastery}/4 · {masteryLabels[item.mastery]}</small>
          {item.notes && <p>{item.notes}</p>}{item.questions && <p><strong>Dudas</strong> {item.questions}</p>}
          {item.evidence && <p><strong>Evidencia</strong> {item.evidence}</p>}</div>
        <Badge tone="blue">{item.minutes} min</Badge><button className="icon-button" aria-label="Editar sesión" onClick={() => panel({ kind: 'session', editing: item })}><Pencil size={17} /></button>
      </li>)}</ul> : <Empty title="Sin sesiones para estos filtros">Registra tus minutos y el nivel de dominio al terminar una sesión.</Empty>}
    </section>
    <section className="card calendar-card">
      <header className="card-header"><div><h2>Plantillas de sesión</h2><p>Reutiliza duraciones y listas de comprobación.</p></div>
        <button className="button secondary" onClick={() => panel({ kind: 'template' })}><Plus size={16} /> Nueva plantilla</button></header>
      <ul className="entry-list">{state.templates.map(item => <li key={item.id}><ListChecks size={19} /><div className="entry-main"><strong>{item.title}</strong>
        <small>{item.minutes} min · {item.checklist.length} comprobaciones</small></div>
        {item.id.length === 36 && <button className="icon-button" aria-label={'Editar ' + item.title} onClick={() => panel({ kind: 'template', item })}><Pencil size={17} /></button>}</li>)}</ul>
    </section>
  </>;
}

function LibraryView({ books }: { books: Book[] }) {
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('');
  const results = books.filter(book => (!topic || topic === book.topic) && clean(Object.values(book).join(' ')).includes(clean(search.trim())));
  return <section className="card library-card"><header className="card-header"><div className="section-identity"><span className="section-icon"><BookOpen size={22} /></span>
    <div><h2>Mis libros</h2><p>{books.length} registros de tu biblioteca de Amazon</p></div></div><Badge tone="blue">{results.length} visibles</Badge></header>
    <div className="filters"><label className="search-box"><Search size={18} /><input aria-label="Buscar libros" placeholder="Buscar título, autor o tema" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <select aria-label="Tema de los libros" value={topic} onChange={event => setTopic(event.target.value)}><option value="">Todos los temas</option>
        {[...new Set(books.map(book => book.topic).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')).map(item => <option key={item}>{item}</option>)}</select></div>
    {results.length ? <div className="table-scroll"><table><thead><tr><th>Título</th><th>Autor</th><th>Tema</th></tr></thead>
      <tbody>{results.map((book, index) => <tr key={book.title + index}><td><strong>{book.title}</strong>{(book.series || book.note) && <small>{[book.series, book.note].filter(Boolean).join(' · ')}</small>}</td><td>{book.author}</td><td>{book.topic && <Badge>{book.topic}</Badge>}</td></tr>)}</tbody></table></div> :
      <Empty title={books.length ? 'Ningún libro coincide' : 'Biblioteca pendiente de importación'} />}
  </section>;
}

function ResourcesView({ state, panel }: { state: StudyState; panel: (panel: Panel) => void }) {
  const [route, setRoute] = useState<RouteFilter>('all');
  const [search, setSearch] = useState('');
  const matches = state.resources.filter(item => (route === 'all' || !item.track || item.track === route)
    && clean([item.title, item.module, item.note].join(' ')).includes(clean(search.trim())));
  return <section className="card library-card"><header className="card-header"><div className="section-identity"><span className="section-icon"><Link2 size={21} /></span>
    <div><h2>Enlaces guardados</h2><p>{state.resources.length} recursos en tu colección</p></div></div>
    <button className="button primary" onClick={() => panel({ kind: 'resource' })}><Plus size={17} /> Agregar recurso</button></header>
    {state.resources.length > 0 && <div className="filters"><label className="search-box"><Search size={18} /><input aria-label="Buscar recursos" placeholder="Buscar recursos" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <RouteSelect value={route} set={setRoute} /></div>}
    {matches.length ? <ul className="entry-list">{matches.map(item => <li key={item.id}><Link2 size={20} /><div className="entry-main">
      <a href={item.url} target="_blank" rel="noreferrer"><strong>{item.title}</strong> <ExternalLink size={14} /></a>
      <small>{[item.track && tracks[item.track].short, item.module, item.note].filter(Boolean).join(' · ')}</small></div>
      <button className="icon-button" aria-label={'Editar ' + item.title} onClick={() => panel({ kind: 'resource', item })}><Pencil size={17} /></button></li>)}</ul> :
      <Empty title={state.resources.length ? 'Ningún recurso coincide' : 'Aquí puedes guardar tus enlaces'}>Añade un curso, video o referencia y asígnale un módulo si aplica.</Empty>}
  </section>;
}

function TutorView({ ready, guideKeys, state, date }: { ready: boolean; guideKeys: string[]; state: StudyState; date: Day }) {
  const [track, setTrack] = useState<Track>('ia');
  const initial = trackWeek(state.settings.start, date, 'ia') ?? 1;
  const [week, setWeek] = useState(guideKeys.includes(weekKey('ia', initial)) ? initial : 1);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Array<{ subject: string; question: string; answer: string }>>([]);
  const [left, setLeft] = useState<number>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || !question.trim()) return;
    setBusy(true); setError('');
    try {
      const result = await request<{ answer: string; remaining: number }>('tutor', 'POST', { track, week, question });
      setMessages(items => [...items, { question, subject: roadmap[track][week - 1].title, answer: result.answer }]);
      setLeft(result.remaining); setQuestion('');
    } catch (failure) { setError(messageOf(failure)); } finally { setBusy(false); }
  }
  return <section className="card tutor-card">
    <header className="card-header"><div className="section-identity"><span className="section-icon"><Sparkles size={22} /></span><div><h2>Tutor de la semana</h2>
      <p>Amazon Nova 2 Lite · Amazon Bedrock</p></div></div><Badge tone={ready ? 'green' : 'neutral'}>{ready ? 'Disponible' : 'Pendiente de conexión'}</Badge></header>
    <form className="study-form" onSubmit={event => void submit(event)}>
      <div className="field-row"><label>Ruta<RouteSelect value={track} all={false} set={value => { setTrack(value as Track); setWeek(1); }} /></label>
        <label>Guía<select value={week} onChange={event => setWeek(Number(event.target.value))}>{roadmap[track].filter(item => guideKeys.includes(weekKey(track, item.number)))
          .map(item => <option value={item.number} key={item.number}>Semana {item.number} · {item.title}</option>)}</select></label></div>
      {!ready && <p className="hint"><CircleHelp size={18} /> El tutor se habilita al conectar Bedrock.</p>}
      <div className="chat-log" aria-live="polite">{messages.map((pair, index) => <div key={index}><p className="bubble question">{pair.question}</p><div className="bubble answer"><strong>{pair.subject}</strong><p>{pair.answer}</p></div></div>)}</div>
      <label>Tu consulta<textarea maxLength={850} value={question} onChange={event => setQuestion(event.target.value)} rows={4}
        placeholder="Explícame el ejemplo de la guía o hazme una pregunta de repaso." required disabled={!ready || busy} /></label>
      {left !== undefined && <small>{left} turnos restantes este mes.</small>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button type="submit" className="button primary" disabled={!ready || busy}><Sparkles size={17} /> {busy ? 'Consultando…' : 'Preguntar'}</button></div>
    </form>
    <a className="text-link" href="https://console.aws.amazon.com/bedrock/home?region=us-east-1" target="_blank" rel="noreferrer">Abrir entorno de experimentación de Bedrock <ArrowUpRight size={15} /></a>
  </section>;
}

function Access({ config, error, loading, callback }: { config?: LoginConfig; error: string; loading: boolean; callback: boolean }) {
  const [loginError, setLoginError] = useState('');
  const pending = config?.mode === 'pending';
  return <main className="access"><div className="access-card"><Brand /><h1>{loading ? 'Abriendo PlanEstudio' : 'Tu espacio de estudio'}</h1>
    <p>{loading ? 'Un momento…' : pending ? 'El acceso con Google está pendiente de configuración.' : 'Accede con tu cuenta de Google autorizada.'}</p>
    {(error || loginError) && <p className="form-error" role="alert">{error || loginError}</p>}
    {!loading && config?.mode === 'google' && !callback && <button className="button primary" onClick={() => signIn(config).catch(failure => setLoginError(messageOf(failure)))}>Entrar con Google <ArrowRight size={17} /></button>}
    {!loading && (callback || (!pending && config?.mode !== 'google')) && <a className="text-link" href={base}>Volver al inicio <ArrowRight size={17} /></a>}
  </div></main>;
}

export default function StudyApp({ view }: { view: string }) {
  const [bootstrap, setBootstrap] = useState<Bootstrap>();
  const [config, setConfig] = useState<LoginConfig>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayBogota());
  const [panel, setPanel] = useState<Panel>();
  const [drawer, setDrawer] = useState(false);
  const [notice, setNotice] = useState('');
  const callback = view === 'auth/callback';
  useEffect(() => {
    if (callback) {
      void finishLogin().catch(failure => { setError(messageOf(failure)); setLoading(false); }); return;
    }
    let active = true;
    async function load() {
      try {
        const login = await request<LoginConfig>('auth/config');
        if (active) setConfig(login);
        if (login.mode === 'pending') return;
        const data = await request<Bootstrap>('bootstrap');
        if (active) setBootstrap(data);
      } catch (failure) {
        if (active && (!(failure instanceof ApiError) || failure.status !== 401)) setError(messageOf(failure));
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [callback]);
  const sync = useCallback(async () => {
    try {
      const state = await request<StudyState>('state');
      setBootstrap(data => data ? { ...data, state } : data);
      setDate(todayBogota());
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) setBootstrap(undefined);
      throw failure;
    }
  }, []);
  useEffect(() => {
    if (!bootstrap) return;
    const refresh = () => { if (!document.hidden) void sync().catch(() => {}); };
    window.addEventListener('focus', refresh);
    const timer = setInterval(refresh, 90_000);
    return () => { window.removeEventListener('focus', refresh); clearInterval(timer); };
  }, [Boolean(bootstrap), sync]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 3600);
    return () => clearTimeout(timer);
  }, [notice]);

  const save: Save = async (path, method, body) => {
    await request(path, method, body); await sync();
    setNotice(method === 'DELETE' ? 'Registro eliminado' : 'Cambios guardados');
  };
  const register: Register = (track, week, minutes) => setPanel({ kind: 'session', track, week, minutes });
  if (!bootstrap) return <Access config={config} error={error} loading={loading} callback={callback} />;
  const { state, books, guides, tutor } = bootstrap;
  const [title, subtitle] = titles[view] ?? titles.inicio;
  const today = formatDay(date);
  let current: ReactNode;
  switch (view) {
    case 'rutas': current = <RoadmapView state={state} date={date} guides={guides} register={register} save={save} />; break;
    case 'calendario': current = <CalendarView state={state} date={date} panel={setPanel} register={register} />; break;
    case 'progreso': current = <><ProgressChart state={state} today={date} full /><div className="dashboard-routes">{trackIds.map(track => <RouteCard track={track} state={state} date={date} key={track} />)}</div></>; break;
    case 'biblioteca': current = <LibraryView books={books} />; break;
    case 'recursos-adicionales': current = <ResourcesView state={state} panel={setPanel} />; break;
    case 'tutor': current = <TutorView ready={tutor} guideKeys={guides} state={state} date={date} />; break;
    default: current = <Dashboard state={state} date={date} register={register} panel={setPanel} save={save} />;
  }
  return <div className="app">
    <a href="#contenido" className="skip-link">Ir al contenido</a>
    {drawer && <button aria-label="Cerrar navegación" className="nav-overlay" onClick={() => setDrawer(false)} />}
    <aside className={'sidebar ' + (drawer ? 'open' : '')}>
      <div className="sidebar-brand"><Brand /><button className="icon-button mobile-close" aria-label="Cerrar menú" onClick={() => setDrawer(false)}><X size={22} /></button></div>
      <nav aria-label="Navegación principal">
        {items.map(({ id, title, icon: Icon }) => <a key={id} href={link(id)} aria-current={id === view ? 'page' : undefined}>
          <Icon size={19} strokeWidth={1.9} /><span>{title}</span>{id === view && <span className="nav-indicator" />}</a>)}
      </nav>
      <div className="sidebar-footer"><div className="avatar">PE</div><div><strong>Mi cuenta</strong><small>{config?.mode === 'local' ? 'Sesión local' : 'Cuenta personal'}</small></div>
        {config?.mode === 'google' && <button className="icon-button" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={() => {
          void request('auth/logout', 'POST').then(() => { setBootstrap(undefined); }).catch(failure => setNotice(messageOf(failure)));
        }}><LogOut size={17} /></button>}</div>
    </aside>
    <div className="main-shell">
      <div className="topbar"><div className="top-left"><button className="icon-button top-menu" aria-label="Abrir menú" aria-expanded={drawer} onClick={() => setDrawer(true)}><Menu size={23} /></button>
        <span className="top-crumb"><Activity size={17} /> Mi espacio <ChevronRight size={14} /> <strong>{items.find(item => item.id === view)?.title ?? 'Inicio'}</strong></span>
        <a href={base} className="mobile-brand">PlanEstudio</a></div>
        <span className="top-date"><CalendarDays size={16} /> {today}</span></div>
      <main id="contenido" className="main-content">
        <header className="page-header"><div><h1>{title}</h1><p>{subtitle}</p></div>
          <button className="button primary register-button" onClick={() => register()}><Plus size={19} /> Registrar sesión</button></header>
        <div className="view-stack">{current}</div>
        <footer className="page-footer"><RouteIcon size={15} /> PlanEstudio <span /> Calendario de Bogotá</footer>
      </main>
    </div>
    {panel?.kind === 'session' && <SessionForm state={state} editing={panel.editing} startTrack={panel.track} startWeek={panel.week} startMinutes={panel.minutes} close={() => setPanel(undefined)} save={save} />}
    {panel?.kind === 'settings' && <SettingsForm current={state.settings} close={() => setPanel(undefined)} save={save} />}
    {panel?.kind === 'resource' && <ResourceForm item={panel.item} close={() => setPanel(undefined)} save={save} />}
    {panel?.kind === 'template' && <TemplateForm item={panel.item} close={() => setPanel(undefined)} save={save} />}
    {panel?.kind === 'next' && <NextForm item={panel.item} close={() => setPanel(undefined)} save={save} />}
    {notice && <div className="toast" role="status"><ArrowDownRight size={17} /> {notice}</div>}
  </div>;
}
