'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/components/AppProviders';
import {
  type EventRow,
  type Profile,
  type RepeatFreq,
  ROLE_LABEL,
  canEdit as roleCanEdit,
  isAdmin as roleIsAdmin,
} from '@/lib/types';
import {
  occurrencesOn,
  toDateStr,
  toTimeStr,
  todayStr,
  type Occurrence,
  FREQ_LABEL,
} from '@/lib/recurrence';
import { COLORS, colHex, avColor, initials, MONTHS, DOW, DOW_FULL, cap } from '@/lib/ui';

type View = 'month' | 'week' | 'day';

interface EventForm {
  id?: string;
  title: string;
  date: string;
  start: string;
  end: string;
  color: string;
  repeat_freq: RepeatFreq;
  repeat_until: string;
  description: string;
}

type Modal =
  | { kind: 'view'; occ: Occurrence }
  | { kind: 'form'; form: EventForm; isNew: boolean }
  | null;

const DAY_START = 7;
const DAY_END = 21;
const SLOT = 44; // px na uro

function bump(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const nh = (h + 1) % 24;
  return `${String(nh).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function toIso(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}
function weekDays(anchor: Date): Date[] {
  const d = new Date(anchor);
  const offset = (d.getDay() + 6) % 7; // ponedeljek prvi
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return x;
  });
}
function fmtDate(ds: string): string {
  const d = new Date(ds + 'T00:00');
  return cap(`${DOW[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`);
}
function shortDate(ds: string): string {
  const d = new Date(ds + 'T00:00');
  return `${d.getDate()}. ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}
function fromEvent(e: EventRow): EventForm {
  const s = new Date(e.start_at);
  const en = new Date(e.end_at);
  return {
    id: e.id,
    title: e.title,
    date: toDateStr(s),
    start: toTimeStr(s),
    end: toTimeStr(en),
    color: e.color,
    repeat_freq: e.repeat_freq,
    repeat_until: e.repeat_until || '',
    description: e.description,
  };
}

export default function CalendarApp() {
  const profile = useProfile();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const editable = roleCanEdit(profile.role);
  const admin = roleIsAdmin(profile.role);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState<Date>(new Date());
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const loadEvents = useCallback(async () => {
    const { data } = await supabase.from('events').select('*').order('start_at');
    if (data) setEvents(data as EventRow[]);
  }, [supabase]);

  const loadUsers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    if (data) setUsers(data as Profile[]);
  }, [supabase]);

  useEffect(() => {
    loadEvents();
    loadUsers();
    // sinhronizacija v realnem času (če je na tabeli 'events' vklopljen Realtime)
    const channel = supabase
      .channel('events-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        loadEvents();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadEvents, loadUsers]);

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  // ---- CRUD ----
  async function saveEvent(form: EventForm) {
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      start_at: toIso(form.date, form.start),
      end_at: toIso(form.date, form.end),
      color: form.color,
      repeat_freq: form.repeat_freq,
      repeat_until: form.repeat_freq === 'none' ? null : form.repeat_until || null,
    };
    if (form.id) {
      const { error } = await supabase
        .from('events')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', form.id);
      if (error) return flash('Napaka pri shranjevanju.');
      flash('Dogodek posodobljen');
    } else {
      const { error } = await supabase
        .from('events')
        .insert({ ...payload, created_by: profile.id });
      if (error) return flash('Napaka pri shranjevanju.');
      flash('Dogodek dodan');
    }
    setModal(null);
    loadEvents();
  }

  async function deleteEvent(e: EventRow) {
    const wasRep = e.repeat_freq !== 'none';
    const { error } = await supabase.from('events').delete().eq('id', e.id);
    if (error) return flash('Napaka pri brisanju.');
    setModal(null);
    loadEvents();
    flash(wasRep ? 'Serija izbrisana' : 'Dogodek izbrisan');
  }

  // ---- navigacija ----
  function shift(n: number) {
    const d = new Date(cursor);
    if (view === 'month') d.setMonth(d.getMonth() + n);
    else if (view === 'week') d.setDate(d.getDate() + 7 * n);
    else d.setDate(d.getDate() + n);
    setCursor(d);
  }
  function openNew(date: string, time?: string) {
    if (!editable) return;
    setModal({
      kind: 'form',
      isNew: true,
      form: {
        title: '',
        date,
        start: time || '09:00',
        end: time ? bump(time) : '10:00',
        color: 'blue',
        repeat_freq: 'none',
        repeat_until: '',
        description: '',
      },
    });
  }

  // ---- oznaka obdobja ----
  let periodLabel = '';
  if (view === 'month') {
    periodLabel = `${cap(MONTHS[cursor.getMonth()])} ${cursor.getFullYear()}`;
  } else if (view === 'week') {
    const wk = weekDays(cursor);
    const a = wk[0];
    const b = wk[6];
    periodLabel = `${a.getDate()}. ${MONTHS[a.getMonth()].slice(0, 3)} – ${b.getDate()}. ${MONTHS[
      b.getMonth()
    ].slice(0, 3)} ${b.getFullYear()}`;
  } else {
    periodLabel = fmtDate(toDateStr(cursor));
  }

  return (
    <div className="app">
      <div className="topbar">
        <Link href="/" className="brand">
          <span className="logo">📅</span> Koledar
        </Link>
        <div className="nav">
          <button className="icon-btn" onClick={() => shift(-1)} title="Nazaj">
            ‹
          </button>
          <button className="icon-btn" onClick={() => shift(1)} title="Naprej">
            ›
          </button>
          <button className="today-btn" onClick={() => setCursor(new Date())}>
            Danes
          </button>
        </div>
        <div className="period-label">{periodLabel}</div>
        <div className="spacer" />
        <div className="seg">
          {(['month', 'week', 'day'] as View[]).map((v) => (
            <button
              key={v}
              className={view === v ? 'active' : ''}
              onClick={() => setView(v)}
            >
              {v === 'month' ? 'Mesec' : v === 'week' ? 'Teden' : 'Dan'}
            </button>
          ))}
        </div>
        {editable && (
          <button className="btn-primary" onClick={() => openNew(todayStr())}>
            ＋ Dogodek
          </button>
        )}
        {admin && (
          <Link href="/admin" className="btn-ghost">
            Uporabniki
          </Link>
        )}
        <div className="userchip">
          <span
            className="avatar"
            style={{ width: 28, height: 28, fontSize: 12, background: avColor(profile.email) }}
          >
            {initials(profile.full_name || profile.email)}
          </span>
          <span className="name">{profile.full_name || profile.email}</span>
          <span className={`role-chip role-${profile.role}`}>{ROLE_LABEL[profile.role]}</span>
          <button
            className="icon-btn"
            onClick={logout}
            title="Odjava"
            style={{ width: 28, height: 28 }}
          >
            ⎋
          </button>
        </div>
      </div>

      <div className="body">
        <aside className="sidebar">
          <h3>Uporabniki</h3>
          <div>
            {users.map((u) => (
              <div className="userrow" key={u.id}>
                <span
                  className="avatar"
                  style={{ width: 28, height: 28, fontSize: 12, background: avColor(u.email) }}
                >
                  {initials(u.full_name || u.email)}
                </span>
                <span className="who">
                  <b>
                    {u.full_name || u.email}
                    {u.id === profile.id ? ' (jaz)' : ''}
                  </b>
                  <small>{ROLE_LABEL[u.role]}</small>
                </span>
              </div>
            ))}
          </div>
          <div className="mini-note">
            {admin
              ? 'Kot administrator lahko dodajaš uporabnike in jim dodeljuješ vloge ter urejaš koledar.'
              : editable
                ? 'Kot urejevalec lahko dodajaš in spreminjaš dogodke.'
                : 'Kot gledalec lahko koledar samo pregleduješ.'}
          </div>
          <div style={{ marginTop: 14 }}>
            <h3>Legenda</h3>
            <div className="legend">
              <span className="dot" style={{ background: '#2f6bff' }} /> Sestanek
            </div>
            <div className="legend">
              <span className="dot" style={{ background: '#1f9d55' }} /> Dogodek
            </div>
            <div className="legend">
              <span className="dot" style={{ background: '#e0463e' }} /> Rok / pomembno
            </div>
            <div className="legend">
              <span className="dot" style={{ background: '#8a4fdb' }} /> Ostalo
            </div>
          </div>
        </aside>

        <main className="main">
          {view === 'month' ? (
            <MonthView
              cursor={cursor}
              events={events}
              editable={editable}
              onDayClick={openNew}
              onEventClick={(occ) => setModal({ kind: 'view', occ })}
            />
          ) : (
            <TimeGridView
              days={view === 'week' ? weekDays(cursor) : [startOfDay(cursor)]}
              events={events}
              editable={editable}
              onSlotClick={openNew}
              onEventClick={(occ) => setModal({ kind: 'view', occ })}
            />
          )}
        </main>
      </div>

      {modal?.kind === 'view' && (
        <EventViewModal
          occ={modal.occ}
          editable={editable}
          onClose={() => setModal(null)}
          onEdit={() => setModal({ kind: 'form', isNew: false, form: fromEvent(modal.occ.event) })}
          onDelete={() => deleteEvent(modal.occ.event)}
        />
      )}
      {modal?.kind === 'form' && (
        <EventFormModal
          initial={modal.form}
          isNew={modal.isNew}
          onCancel={() => setModal(null)}
          onSave={saveEvent}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// =================== MONTH ===================
function MonthView({
  cursor,
  events,
  editable,
  onDayClick,
  onEventClick,
}: {
  cursor: Date;
  events: EventRow[];
  editable: boolean;
  onDayClick: (date: string) => void;
  onEventClick: (occ: Occurrence) => void;
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const today = todayStr();

  return (
    <div>
      <div className="weekhead">
        {['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="month">
        {cells.map((d, i) => {
          const ds = toDateStr(d);
          const out = d.getMonth() !== cursor.getMonth();
          const occs = occurrencesOn(events, ds);
          return (
            <div
              key={i}
              className={`cell${out ? ' out' : ''}${ds === today ? ' today' : ''}${
                editable ? ' can-add' : ''
              }`}
              onClick={editable ? () => onDayClick(ds) : undefined}
            >
              <div className="dnum">{d.getDate()}</div>
              <div className="evs">
                {occs.slice(0, 3).map((o, j) => (
                  <button
                    key={j}
                    className="ev"
                    style={{ background: colHex(o.event.color) }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(o);
                    }}
                  >
                    <span className="t">{o.start}</span> {o.recurring ? '🔁 ' : ''}
                    {o.event.title}
                  </button>
                ))}
                {occs.length > 3 && <div className="more">+ še {occs.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =================== WEEK / DAY ===================
function TimeGridView({
  days,
  events,
  editable,
  onSlotClick,
  onEventClick,
}: {
  days: Date[];
  events: EventRow[];
  editable: boolean;
  onSlotClick: (date: string, time: string) => void;
  onEventClick: (occ: Occurrence) => void;
}) {
  const today = todayStr();
  const single = days.length === 1;
  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);

  return (
    <div
      className="grid-time"
      style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
    >
      <div className="corner" />
      {days.map((d, i) => (
        <div key={i} className={`wday${toDateStr(d) === today ? ' today' : ''}`}>
          <small>{single ? DOW_FULL[d.getDay()] : DOW[d.getDay()]}</small>
          <b>
            {d.getDate()}. {MONTHS[d.getMonth()].slice(0, 3)}
          </b>
        </div>
      ))}

      <div className="times">
        {hours.map((h) => (
          <div key={h} className="slot">
            {h}:00
          </div>
        ))}
      </div>

      {days.map((d, i) => {
        const ds = toDateStr(d);
        const occs = occurrencesOn(events, ds);
        return (
          <div key={i} className={`col${editable ? ' can-add' : ''}`}>
            {hours.map((h) => (
              <div
                key={h}
                className="slot"
                onClick={
                  editable
                    ? () => onSlotClick(ds, `${String(h).padStart(2, '0')}:00`)
                    : undefined
                }
              />
            ))}
            {occs.map((o, j) => {
              const [sh, sm] = o.start.split(':').map(Number);
              const [eh, em] = o.end.split(':').map(Number);
              const top = (sh + sm / 60 - DAY_START) * SLOT;
              const height = Math.max(20, (eh + em / 60 - (sh + sm / 60)) * SLOT);
              return (
                <button
                  key={j}
                  className="wev"
                  style={{ top, height, background: colHex(o.event.color) }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(o);
                  }}
                >
                  <b>
                    {o.recurring ? '🔁 ' : ''}
                    {o.event.title}
                  </b>
                  {o.start}–{o.end}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// =================== VIEW MODAL ===================
function EventViewModal({
  occ,
  editable,
  onClose,
  onEdit,
  onDelete,
}: {
  occ: Occurrence;
  editable: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const e = occ.event;
  const repLabel =
    occ.recurring &&
    `Ponavlja se ${FREQ_LABEL[e.repeat_freq]}${
      e.repeat_until ? ' do ' + shortDate(e.repeat_until) : ''
    }`;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(ev) => ev.stopPropagation()}>
        <h2 style={{ borderLeft: `4px solid ${colHex(e.color)}`, paddingLeft: 10 }}>{e.title}</h2>
        {!editable && (
          <div className="banner banner-info">👁 Samo za ogled — nimaš pravice urejanja.</div>
        )}
        <div className="ev-view-row">
          <span className="ic">📅</span>
          <span>{fmtDate(occ.date)}</span>
        </div>
        <div className="ev-view-row">
          <span className="ic">🕒</span>
          <span>
            {occ.start} – {occ.end}
          </span>
        </div>
        {repLabel && (
          <div className="ev-view-row">
            <span className="ic">🔁</span>
            <span>{repLabel}</span>
          </div>
        )}
        {e.description && (
          <div className="ev-view-row">
            <span className="ic">📝</span>
            <span>{e.description}</span>
          </div>
        )}
        {editable && occ.recurring && (
          <div className="banner banner-warn">
            🔁 Ponavljajoč se dogodek — urejanje ali brisanje velja za celotno serijo.
          </div>
        )}
        <div className="modal-actions">
          <div>
            {editable && (
              <button
                className="btn-ghost"
                style={{ color: 'var(--danger)', borderColor: '#f2c8c5' }}
                onClick={onDelete}
              >
                Izbriši{occ.recurring ? ' serijo' : ''}
              </button>
            )}
          </div>
          <div className="right">
            <button className="btn-ghost" onClick={onClose}>
              Zapri
            </button>
            {editable && (
              <button className="btn-primary" onClick={onEdit}>
                Uredi
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =================== FORM MODAL ===================
function EventFormModal({
  initial,
  isNew,
  onCancel,
  onSave,
}: {
  initial: EventForm;
  isNew: boolean;
  onCancel: () => void;
  onSave: (f: EventForm) => void;
}) {
  const [f, setF] = useState<EventForm>(initial);
  const set = (patch: Partial<EventForm>) => setF((prev) => ({ ...prev, ...patch }));

  function submit() {
    if (!f.title.trim()) return;
    onSave(f);
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal" onClick={(ev) => ev.stopPropagation()}>
        <h2>{isNew ? 'Nov dogodek' : 'Uredi dogodek'}</h2>
        <div className="field">
          <label>Naslov</label>
          <input
            value={f.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="npr. Sestanek ekipe"
            autoFocus
          />
        </div>
        <div className="field">
          <label>Datum</label>
          <input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
        </div>
        <div className="row2">
          <div className="field">
            <label>Začetek</label>
            <input type="time" value={f.start} onChange={(e) => set({ start: e.target.value })} />
          </div>
          <div className="field">
            <label>Konec</label>
            <input type="time" value={f.end} onChange={(e) => set({ end: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Barva</label>
          <div className="swatches">
            {COLORS.map((c) => (
              <span
                key={c.id}
                className={`swatch${f.color === c.id ? ' sel' : ''}`}
                style={{ background: c.hex }}
                onClick={() => set({ color: c.id })}
              />
            ))}
          </div>
        </div>
        <div className="row2">
          <div className="field">
            <label>Ponavljanje</label>
            <select
              value={f.repeat_freq}
              onChange={(e) => set({ repeat_freq: e.target.value as RepeatFreq })}
            >
              <option value="none">Se ne ponavlja</option>
              <option value="daily">Vsak dan</option>
              <option value="weekly">Vsak teden</option>
              <option value="monthly">Vsak mesec</option>
            </select>
          </div>
          {f.repeat_freq !== 'none' && (
            <div className="field">
              <label>Ponavljaj do (neobvezno)</label>
              <input
                type="date"
                value={f.repeat_until}
                onChange={(e) => set({ repeat_until: e.target.value })}
              />
            </div>
          )}
        </div>
        <div className="field">
          <label>Opis (neobvezno)</label>
          <textarea
            rows={2}
            value={f.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="Podrobnosti…"
          />
        </div>
        <div className="modal-actions">
          <div />
          <div className="right">
            <button className="btn-ghost" onClick={onCancel}>
              Prekliči
            </button>
            <button className="btn-primary" onClick={submit}>
              Shrani
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
