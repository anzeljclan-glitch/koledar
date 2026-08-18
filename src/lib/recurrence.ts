import type { EventRow, RepeatFreq } from './types';

// --- osnovni pretvorniki (lokalni čas) ---
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function toTimeStr(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function todayStr(): string {
  return toDateStr(new Date());
}
export function daysBetween(aStr: string, bStr: string): number {
  const a = new Date(aStr + 'T00:00');
  const b = new Date(bStr + 'T00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// Ali se dogodek (glede na svoj vzorec) pojavi na dani dan?
export function occursOn(
  baseDate: string,
  freq: RepeatFreq,
  until: string | null,
  target: string,
): boolean {
  if (target < baseDate) return false;
  if (until && target > until) return false;
  if (freq === 'none') return target === baseDate;
  if (freq === 'daily') return true;
  if (freq === 'weekly') return daysBetween(baseDate, target) % 7 === 0;
  if (freq === 'monthly')
    return new Date(baseDate + 'T00:00').getDate() === new Date(target + 'T00:00').getDate();
  return target === baseDate;
}

export interface Occurrence {
  event: EventRow;
  date: string;   // dan pojavitve (YYYY-MM-DD, lokalno)
  start: string;  // HH:MM
  end: string;    // HH:MM
  recurring: boolean;
}

// Vsi dogodki, ki se pojavijo na dani dan (razširjeni iz ponavljajočih se serij).
export function occurrencesOn(events: EventRow[], dateStr: string): Occurrence[] {
  const out: Occurrence[] = [];
  for (const e of events) {
    const s = new Date(e.start_at);
    const en = new Date(e.end_at);
    const baseDate = toDateStr(s);
    if (occursOn(baseDate, e.repeat_freq, e.repeat_until, dateStr)) {
      out.push({
        event: e,
        date: dateStr,
        start: toTimeStr(s),
        end: toTimeStr(en),
        recurring: e.repeat_freq !== 'none',
      });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

export const FREQ_LABEL: Record<RepeatFreq, string> = {
  none: 'Se ne ponavlja',
  daily: 'vsak dan',
  weekly: 'vsak teden',
  monthly: 'vsak mesec',
};
