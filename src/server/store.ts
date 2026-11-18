import { defaults, sessionTemplates } from '../core/calendar.ts';
import type { StudyState } from '../core/calendar.ts';

export type Item = { key: string; revision: string; value: unknown };
export interface Store {
  get(key: string): Promise<Item | undefined>;
  list(prefix: string): Promise<Item[]>;
  put(key: string, value: unknown, expected?: string | null): Promise<boolean>;
  remove(key: string, expected?: string): Promise<boolean>;
}

export async function loadState(store: Store): Promise<StudyState> {
  const items = await store.list('study/');
  let settings = items.find(item => item.key === 'study/settings');
  if (!settings) {
    await store.put('study/settings', defaults(), null);
    settings = await store.get('study/settings');
  }
  if (!settings) throw new Error('No se pudo inicializar el calendario.');
  const values = <K extends keyof StudyState>(category: string) => items
    .filter(item => item.key.startsWith('study/' + category + '/')).map(item => item.value) as StudyState[K];
  const templates = values<'templates'>('templates');
  return {
    settings: settings.value as StudyState['settings'],
    sessions: values<'sessions'>('sessions').sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)),
    completions: values<'completions'>('completions'),
    resources: values<'resources'>('resources'),
    templates: [...sessionTemplates, ...templates],
    next: values<'next'>('next')
  };
}
