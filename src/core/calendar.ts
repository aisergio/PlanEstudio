import { activityKey, blockTypes, minutesPerTrack, roadmap, trackIds, tracks } from './curriculum.ts';
import type { Block, RouteFilter, Track } from './curriculum.ts';

export type Day = string;
export type Period = 1 | 4 | 13 | 26 | 52 | 'ytd' | 'custom';
export type Settings = { start: Day; days: Record<Track, Record<Block, number>> };
export type Session = {
  id: string; track: Track; week: number; date: Day; minutes: number; mastery: number;
  notes: string; questions: string; evidence: string; templateId: string; checklist: string[];
};
export type Resource = { id: string; title: string; url: string; track?: Track; module?: string; note?: string };
export type Template = { id: string; title: string; minutes: number; checklist: string[] };
export type NextStep = { id: string; title: string; track?: Track; done: boolean };
export type Book = { title: string; author: string; topic: string; series: string; note: string };
export type StudyState = {
  settings: Settings;
  sessions: Session[];
  completions: string[];
  resources: Resource[];
  templates: Template[];
  next: NextStep[];
};

const bogota = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' });
const dayMillis = 86_400_000;
export const todayBogota = (now = new Date()): Day => bogota.format(now);
const toDate = (day: Day) => new Date(day + 'T00:00:00Z');
const iso = (date: Date): Day => date.toISOString().slice(0, 10);
export function validDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(+toDate(day)) && iso(toDate(day)) === day && day >= '2000-01-01' && day <= '2099-12-31';
}
export const shiftDay = (day: Day, distance: number): Day => iso(new Date(+toDate(day) + distance * dayMillis));
export const monday = (day: Day) => shiftDay(day, -((toDate(day).getUTCDay() + 6) % 7));
export const weekOffset = (start: Day, day: Day): number => Math.round((+toDate(monday(day)) - +toDate(monday(start))) / (7 * dayMillis));
export const weekStart = (start: Day, week: number) => shiftDay(monday(start), (week - 1) * 7);
export const trackWeek = (start: Day, date: Day, track: Track) => {
  const week = weekOffset(start, date) + 1;
  return week >= 1 && week <= tracks[track].weeks ? week : null;
};

export function defaults(today = todayBogota()): Settings {
  return { start: monday(today), days: {
    ia: { theory: 0, lab: 2, project: 4, review: 6 },
    fullstack: { theory: 1, lab: 3, project: 5, review: 6 }
  } };
}

export const sessionTemplates: Template[] = [
  { id: 'teoria', title: 'Lectura activa', minutes: 90, checklist: ['Escribir tres ideas con mis palabras', 'Verificar un ejemplo a mano', 'Anotar una duda concreta'] },
  { id: 'laboratorio', title: 'Laboratorio reproducible', minutes: 120, checklist: ['Preparar el entorno y los datos', 'Ejecutar la hipótesis con un control', 'Guardar resultados y comandos'] },
  { id: 'proyecto', title: 'Iteración del proyecto', minutes: 60, checklist: ['Elegir un entregable pequeño', 'Validar el cambio', 'Guardar la evidencia'] },
  { id: 'repaso', title: 'Repaso espaciado', minutes: 30, checklist: ['Responder sin mirar notas', 'Corregir una explicación', 'Agendar el próximo repaso'] }
];

export function periodBounds(period: Period, today: Day, from?: Day, to?: Day): [Day, Day] {
  if (period === 'ytd') return [monday(today.slice(0, 4) + '-01-01'), monday(today)];
  if (period === 'custom') {
    if (!from || !to || !validDay(from) || !validDay(to) || from > to || weekOffset(from, to) > 104) throw new RangeError('El rango debe tener fechas válidas y abarcar como máximo 105 semanas.');
    return [monday(from), monday(to)];
  }
  return [shiftDay(monday(today), -(period - 1) * 7), monday(today)];
}

export type WeeklyPoint = { start: Day; end: Day; minutes: number | null; goal: number; partial: boolean };
export function weeklyProgress(state: StudyState, filter: RouteFilter, period: Period, today = todayBogota(), from?: Day, to?: Day): WeeklyPoint[] {
  const [start, end] = periodBounds(period, today, from, to);
  const totals = new Map<Day, number>();
  for (const session of state.sessions) {
    if (session.date > today || (filter !== 'all' && session.track !== filter)) continue;
    const date = monday(session.date);
    totals.set(date, (totals.get(date) ?? 0) + session.minutes);
  }
  const selected = filter === 'all' ? trackIds : [filter];
  return Array.from({ length: weekOffset(start, end) + 1 }, (_, index) => {
    const date = shiftDay(start, index * 7);
    const goal = selected.filter(track => trackWeek(state.settings.start, date, track) !== null).length * minutesPerTrack;
    return { start: date, end: shiftDay(date, 6), minutes: totals.get(date) ?? null, goal, partial: date === monday(today) };
  });
}

export function completion(state: StudyState, track: Track) {
  const completed = new Set(state.completions);
  const count = roadmap[track].reduce((total, item) => total + blockTypes.filter(block => completed.has(activityKey(track, item.number, block.id))).length, 0);
  const total = tracks[track].weeks * blockTypes.length;
  return { completed: count, total, percent: Math.round(count * 100 / total) };
}

export function activityStatus(state: StudyState, track: Track, week: number) {
  const completed = blockTypes.filter(block => state.completions.includes(activityKey(track, week, block.id))).length;
  if (completed === blockTypes.length) return 'completed';
  return completed || state.sessions.some(session => session.track === track && session.week === week) ? 'active' : 'pending';
}

export function pendingBlocks(state: StudyState, track: Track, week: number) {
  return blockTypes.filter(block => !state.completions.includes(activityKey(track, week, block.id)));
}

export function upcoming(state: StudyState, day: Day, filter: RouteFilter = 'all', weeks = 2) {
  return Array.from({ length: weeks }, (_, index) => shiftDay(monday(day), index * 7))
    .flatMap(date => (filter === 'all' ? trackIds : [filter]).flatMap(track => {
      const week = trackWeek(state.settings.start, date, track);
      if (!week) return [];
      return pendingBlocks(state, track, week).map(block => ({
        date: shiftDay(date, state.settings.days[track][block.id]), track, week, block, title: roadmap[track][week - 1].title
      }));
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

const long = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'long' });
const short = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'short' });
export const formatDay = (day: Day, abbreviated = false) => (abbreviated ? short : long).format(toDate(day));
export const formatRange = (start: Day, end: Day) => short.formatRange(toDate(start), toDate(end));
