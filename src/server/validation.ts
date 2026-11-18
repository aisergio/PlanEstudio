import { z } from 'zod';
import { validDay } from '../core/calendar.ts';
import { blockTypes, tracks } from '../core/curriculum.ts';

const track = z.enum(['ia', 'fullstack']);
const string = (max: number) => z.string().trim().max(max);
const nonempty = (max: number) => string(max).min(1);
const day = z.string().refine(validDay);
const minutes = z.number().int().min(1).max(1440);
const checklist = z.array(nonempty(150)).max(16);
const week = z.number().int().min(1).max(78);
const id = z.uuid();
const safeUrl = z.url({ protocol: /^https?$/ }).max(1800).refine(url => {
  const parsed = new URL(url);
  return !parsed.username && !parsed.password;
});
const days = z.object({ theory: z.number().int().min(0).max(6), lab: z.number().int().min(0).max(6),
  project: z.number().int().min(0).max(6), review: z.number().int().min(0).max(6) });

export const settingsSchema = z.object({ start: day, days: z.object({ ia: days, fullstack: days }) });
export const sessionSchema = z.object({
  id, track, week, date: day, minutes, mastery: z.number().int().min(0).max(4), notes: string(2000), questions: string(1600),
  evidence: string(500), templateId: string(64), checklist
}).refine(session => session.week <= tracks[session.track].weeks);
export const templateSchema = z.object({ id, title: nonempty(100), minutes, checklist });
export const resourceSchema = z.object({ id, title: nonempty(200), url: safeUrl, track: track.optional(), module: string(100).optional(), note: string(600).optional() });
export const nextSchema = z.object({ id, title: nonempty(200), track: track.optional(), done: z.boolean() });
export const completionSchema = z.object({ track, week, block: z.enum(blockTypes.map(block => block.id)), done: z.boolean() })
  .refine(value => value.week <= tracks[value.track].weeks);
export const tutorSchema = z.object({ track, week, question: nonempty(850) }).refine(value => value.week <= tracks[value.track].weeks);
export const jobSchema = z.object({ track, week, channelId: z.string().regex(/^UC[A-Za-z0-9_-]{22}$/), confirmed: z.literal(true) });
export const workerSchema = z.object({ name: nonempty(64), key: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/), channelId: z.string().regex(/^UC[A-Za-z0-9_-]{22}$/), channel: nonempty(150) });
export const workerUpdateSchema = z.object({
  status: z.enum(['rendering', 'composition', 'uploading', 'processing', 'ready', 'error']),
  detail: string(240), videoId: z.string().regex(/^[a-zA-Z0-9_-]{11}$/).optional()
});
