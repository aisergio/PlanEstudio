import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { BookOpen, BrainCircuit, Check, Code2, X } from 'lucide-react';
import { tracks } from '../core/curriculum.ts';
import type { RouteFilter, Track } from '../core/curriculum.ts';

export const routeOptions = [{ value: 'all', title: 'Ambas rutas' }, { value: 'ia', title: tracks.ia.name }, { value: 'fullstack', title: 'Full Stack' }] as const;
export function RouteSelect({ value, set, label = 'Ruta', all = true }: { value: RouteFilter; set: (route: RouteFilter) => void; label?: string; all?: boolean }) {
  return <select aria-label={label} value={value} onChange={event => set(event.target.value as RouteFilter)}>
    {routeOptions.filter(item => all || item.value !== 'all').map(item => <option key={item.value} value={item.value}>{item.title}</option>)}
  </select>;
}

export function TrackIcon({ track, size = 22 }: { track: Track; size?: number }) {
  const Icon = track === 'ia' ? BrainCircuit : Code2;
  return <span className={'track-icon ' + track}><Icon size={size} /></span>;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={'badge ' + tone}>{children}</span>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><BookOpen size={24} /><strong>{title}</strong>{children && <p>{children}</p>}</div>;
}

export function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="modal" onCancel={event => { event.preventDefault(); close(); }} aria-labelledby="modal-title">
    <header><h2 id="modal-title">{title}</h2><button className="icon-button" type="button" aria-label="Cerrar" onClick={close}><X size={20} /></button></header>
    <div className="modal-content">{children}</div>
  </dialog>;
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (done: boolean) => void }) {
  return <label className="check-row"><span className="check-box"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><Check size={14} /></span><span>{label}</span></label>;
}
