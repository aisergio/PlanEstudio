import { useId, useState } from 'react';
import { ChartNoAxesCombined, ChevronLeft, ChevronRight, Clock3, Info, Target } from 'lucide-react';
import { formatRange, validDay, weeklyProgress, weekOffset, monday, shiftDay } from '../core/calendar.ts';
import type { Day, Period, StudyState, WeeklyPoint } from '../core/calendar.ts';
import type { RouteFilter } from '../core/curriculum.ts';
import { Badge, RouteSelect } from './components.tsx';

const periods = [{ value: 1, label: '1 sem' }, { value: 4, label: '4 sem' }, { value: 13, label: '13 sem' },
  { value: 26, label: '26 sem' }, { value: 52, label: '52 sem' }, { value: 'ytd', label: 'Este año' }, { value: 'custom', label: 'Personalizado' }] as const;
const dateLabel = new Intl.DateTimeFormat('es-CO', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const xLabel = (day: Day) => dateLabel.format(new Date(day + 'T00:00:00Z'));

function Plot({ points, selected, choose }: { points: WeeklyPoint[]; selected: number; choose: (index: number) => void }) {
  const color = useId();
  const width = 780, height = 236, startX = 52, endX = 750, top = 17, bottom = 187;
  const peak = Math.max(120, ...points.map(point => Math.max(point.minutes ?? 0, point.goal)));
  const step = Math.max(30, Math.ceil(peak / 4 / 30) * 30);
  const scale = step * 4;
  const x = (index: number) => points.length === 1 ? (startX + endX) / 2 : startX + (endX - startX) * index / (points.length - 1);
  const y = (minutes: number) => bottom - (bottom - top) * minutes / scale;
  const chunks: Array<Array<[number, number]>> = [];
  points.forEach((point, index) => {
    if (point.minutes === null) return;
    if (index === 0 || points[index - 1].minutes === null) chunks.push([]);
    chunks.at(-1)!.push([x(index), y(point.minutes)]);
  });
  const goals = points.length === 1 ? startX + ',' + y(points[0].goal) + ' ' + endX + ',' + y(points[0].goal) :
    points.map((point, index) => x(index) + ',' + y(point.goal)).join(' ');
  const skip = Math.max(1, Math.ceil(points.length / 5));
  const focus = points[selected];
  return <svg className="plot" viewBox={'0 0 ' + width + ' ' + height} role="group" aria-label="Gráfica de minutos estudiados por semana">
    <defs><linearGradient id={color} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#73a8ff" stopOpacity=".5" /><stop offset="100%" stopColor="#c9e1ff" stopOpacity=".22" /></linearGradient></defs>
    {[4, 3, 2, 1, 0].map(tick => <g key={tick}><line x1={startX} x2={endX} y1={y(tick * step)} y2={y(tick * step)} className="gridline" />
      <text x={startX - 11} y={y(tick * step) + 4} textAnchor="end">{tick * step}</text></g>)}
    {chunks.map((segment, index) => <g key={index}>
      {segment.length > 1 && <polygon fill={'url(#' + color + ')'} points={[[segment[0][0], bottom], ...segment, [segment.at(-1)![0], bottom]].map(pair => pair.join(',')).join(' ')} />}
      <polyline fill="none" className="actual-line" points={segment.map(pair => pair.join(',')).join(' ')} />
    </g>)}
    <polyline fill="none" points={goals} className="goal-line" />
    {focus && <line x1={x(selected)} x2={x(selected)} y1={top} y2={bottom} className="focus-line" />}
    {points.map((point, index) => <g key={point.start}>
      {point.minutes !== null && <circle cx={x(index)} cy={y(point.minutes)} r={index === selected ? 6 : 3.5} className="plot-dot" />}
      {index === selected && point.minutes === null && <circle cx={x(index)} cy={y(point.goal)} r="5" className="goal-dot" />}
      {(index % skip === 0 || (index === points.length - 1 && index % skip > 1)) &&
        <text x={x(index)} y={bottom + 23} textAnchor={index === 0 && points.length > 1 ? 'start' : index === points.length - 1 && points.length > 1 ? 'end' : 'middle'}>{xLabel(point.start)}</text>}
      <rect className="hit" x={points.length === 1 ? startX : Math.max(startX - 4, x(index) - (endX - startX) / (points.length - 1) / 2)}
        y={top} width={points.length === 1 ? endX - startX : (endX - startX) / (points.length - 1)} height={bottom - top}
        tabIndex={index === selected ? 0 : -1} role="button" aria-label={formatRange(point.start, point.end) + ', ' + (point.minutes === null ? 'Sin registros' : point.minutes + ' minutos')}
        aria-pressed={index === selected} onClick={() => choose(index)} onKeyDown={event => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            const next = Math.max(0, Math.min(points.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)));
            choose(next);
            const targets = event.currentTarget.ownerSVGElement?.querySelectorAll<SVGRectElement>('.hit');
            targets?.[next]?.focus();
          } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(index); }
        }} />
    </g>)}
  </svg>;
}

export default function ProgressChart({ state, today, full = false }: { state: StudyState; today: Day; full?: boolean }) {
  const [period, setPeriod] = useState<Period>(13);
  const [route, setRoute] = useState<RouteFilter>('all');
  const [from, setFrom] = useState(shiftDay(today, -84));
  const [to, setTo] = useState(today);
  const [focused, setFocused] = useState<Day>();
  const valid = period !== 'custom' || (validDay(from) && validDay(to) && from <= to && weekOffset(from, to) <= 104);
  const points = valid ? weeklyProgress(state, route, period, today, from, to) : [];
  const selectedIndex = focused && points.some(point => point.start === focused) ? points.findIndex(point => point.start === focused) : points.length - 1;
  const selected = points[selectedIndex];
  const goal = points.reduce((total, point) => total + point.goal, 0);
  const actual = points.filter(point => point.minutes !== null).reduce((total, point) => total + point.minutes!, 0);
  const withRecords = points.filter(point => point.minutes !== null).length;
  function choose(index: number) { if (points[index]) setFocused(points[index].start); }
  return <section className="card chart-card">
    <header className="card-header">
      <div className="section-identity"><span className="section-icon"><ChartNoAxesCombined size={21} /></span><div><h2>Actividad de estudio</h2><p>Minutos registrados por semana</p></div></div>
      <RouteSelect label="Ruta de la gráfica" value={route} set={setRoute} />
    </header>
    <div className="periods" role="group" aria-label="Período de la gráfica">
      {periods.map(item => <button type="button" key={item.value} className={period === item.value ? 'selected' : ''} aria-pressed={period === item.value}
        onClick={() => { setPeriod(item.value); setFocused(undefined); }}>{item.label}</button>)}
    </div>
    {period === 'custom' && <div className="custom-period"><label>Desde<input aria-label="Desde" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
      <label>Hasta<input aria-label="Hasta" type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div>}
    {selected ? <>
      <div className="chart-selection">
        <div aria-live="polite"><strong>{selected.minutes === null ? 'Sin registros' : selected.minutes.toLocaleString('es-CO') + ' min'}</strong>
          <span>{formatRange(selected.start, selected.end)} · Objetivo {selected.goal} min</span></div>
        <div className="chart-controls">
          {selected.partial && <Badge tone="blue">Semana parcial</Badge>}
          <button className="icon-button" aria-label="Semana anterior" disabled={selectedIndex === 0} onClick={() => choose(selectedIndex - 1)}><ChevronLeft size={18} /></button>
          <button className="icon-button" aria-label="Semana siguiente" disabled={selectedIndex >= points.length - 1} onClick={() => choose(selectedIndex + 1)}><ChevronRight size={18} /></button>
        </div>
      </div>
      <Plot points={points} selected={selectedIndex} choose={choose} />
      <div className="chart-legend"><span><i /> Registrado</span><span><i /> Objetivo</span><span className="chart-zone">Lun–dom · Bogotá</span></div>
    </> : <p className="hint"><Info size={18} /> Elige un rango de hasta 105 semanas con fechas válidas.</p>}
    {full && <div className="comparison">
      <div><Clock3 size={17} /><span>Minutos registrados<strong>{withRecords ? actual.toLocaleString('es-CO') : 'Sin registros'}</strong></span></div>
      <div><Target size={17} /><span>Minutos planificados<strong>{goal.toLocaleString('es-CO')}</strong></span></div>
      <div><ChartNoAxesCombined size={17} /><span>Cumplimiento por tiempo<strong>{withRecords && goal ? Math.round(100 * actual / goal) + ' %' : '—'}</strong></span></div>
    </div>}
    {full && selected && <details className="chart-data"><summary>Ver datos semanales</summary><div className="table-scroll"><table><thead><tr><th>Semana</th><th>Registrados</th><th>Objetivo</th></tr></thead>
      <tbody>{[...points].reverse().map(point => <tr key={point.start}><td>{formatRange(point.start, point.end)}{point.partial && point.start === monday(today) ? ' · Parcial' : ''}</td><td>{point.minutes ?? 'Sin registros'}</td><td>{point.goal} min</td></tr>)}</tbody></table></div></details>}
  </section>;
}
