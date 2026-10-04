// In-memory stand-in for data.js so the UI can be exercised without signing in.
// Loaded by dev/index.html through an import map. Made-up numbers only.
import { today } from '../ui.js';

const db = {
  exercise: [
    { id: 1, name: 'Bench Press', pushup_name: 'Pushup', duration_seconds: null, next_load_type: null, next_load_value: null },
    { id: 2, name: 'Seated Lat Row', pushup_name: null, duration_seconds: null, next_load_type: null, next_load_value: null },
    { id: 3, name: 'Kettlebell Swing', pushup_name: null, duration_seconds: 5, next_load_type: null, next_load_value: null },
    { id: 4, name: 'Single Leg RDL', pushup_name: null, duration_seconds: 5, next_load_type: null, next_load_value: null },
  ],
  workout: [{ id: 1, name: 'Chest n Back', archived_at: null }, { id: 2, name: 'Kettlebell', archived_at: null }],
  workout_entry: [
    { id: 1, workout_id: 1, exercise_id: 1, sort_order: 1, side: null, is_warmup: false, archived_at: null },
    { id: 2, workout_id: 1, exercise_id: 2, sort_order: 2, side: null, is_warmup: false, archived_at: null },
    { id: 3, workout_id: 1, exercise_id: 1, sort_order: 3, side: null, is_warmup: false, archived_at: null },
    { id: 4, workout_id: 1, exercise_id: 2, sort_order: 4, side: null, is_warmup: false, archived_at: null },
    { id: 5, workout_id: 2, exercise_id: 3, sort_order: 1, side: null, is_warmup: false, archived_at: null },
    { id: 6, workout_id: 2, exercise_id: 4, sort_order: 2, side: 'L', is_warmup: false, archived_at: null },
    { id: 7, workout_id: 2, exercise_id: 4, sort_order: 3, side: 'R', is_warmup: false, archived_at: null },
  ],
  session: [
    { id: 1, workout_id: 1, performed_on: '2026-09-01', created_at: '2026-09-01T12:00:00Z', note: null },
    { id: 2, workout_id: 1, performed_on: '2026-09-08', created_at: '2026-09-08T12:00:00Z', note: null },
  ],
  session_entry: [
    { id: 1, session_id: 1, workout_entry_id: 1, exercise_id: 1, sort_order: 1, side: null, is_warmup: false, form: 'press' },
    { id: 2, session_id: 1, workout_entry_id: 2, exercise_id: 2, sort_order: 2, side: null, is_warmup: false, form: null },
    { id: 3, session_id: 1, workout_entry_id: 3, exercise_id: 1, sort_order: 3, side: null, is_warmup: false, form: 'press' },
    { id: 4, session_id: 1, workout_entry_id: 4, exercise_id: 2, sort_order: 4, side: null, is_warmup: false, form: null },
    { id: 5, session_id: 2, workout_entry_id: 1, exercise_id: 1, sort_order: 1, side: null, is_warmup: false, form: 'pushup' },
    { id: 6, session_id: 2, workout_entry_id: 2, exercise_id: 2, sort_order: 2, side: null, is_warmup: false, form: null },
  ],
  set: [
    { id: 1, session_entry_id: 1, load_type: 'machine', load_value: 6, position: 4, reps: 10, note: null },
    { id: 2, session_entry_id: 2, load_type: 'bands', load_value: 230, position: null, reps: 11, note: null },
    { id: 3, session_entry_id: 3, load_type: 'machine', load_value: 6, position: 4, reps: 8, note: null },
    { id: 4, session_entry_id: 4, load_type: 'bands', load_value: 230, position: null, reps: 9, note: null },
    { id: 5, session_entry_id: 5, load_type: 'body', load_value: null, position: null, reps: 20, note: null },
    { id: 6, session_entry_id: 6, load_type: 'bands', load_value: 230, position: null, reps: 13, note: null },
  ],
};
window.fakeDb = db;
const nextId = (t) => Math.max(0, ...db[t].map((r) => r.id)) + 1;
const clone = (x) => structuredClone(x);
const wait = () => new Promise((r) => setTimeout(r, 300));

export const supabase = {
  auth: {
    onAuthStateChange(cb) { setTimeout(() => cb('INITIAL_SESSION', { user: { email: 'test@example.com' } })); },
    signOut() { location.reload(); },
    signInWithOAuth() { return { error: null }; },
  },
};

function lastUsedRows() {
  const out = new Map();
  const rows = db.set.map((st) => {
    const se = db.session_entry.find((e) => e.id === st.session_entry_id);
    const s = db.session.find((x) => x.id === se.session_id);
    return { st, se, s };
  }).sort((a, b) => (b.s.performed_on.localeCompare(a.s.performed_on)) || b.s.created_at.localeCompare(a.s.created_at) || b.se.sort_order - a.se.sort_order);
  for (const { st, se, s } of rows) {
    const k = `${se.exercise_id}|${se.form}`;
    if (!out.has(k)) out.set(k, { exercise_id: se.exercise_id, form: se.form, load_type: st.load_type, load_value: st.load_value, position: st.position, performed_on: s.performed_on });
  }
  return [...out.values()];
}

export async function listWorkouts() {
  await wait();
  return db.workout.map((w) => {
    const mine = db.session.filter((s) => s.workout_id === w.id).sort((a, b) => b.performed_on.localeCompare(a.performed_on));
    return { id: w.id, name: w.name, lastDone: mine[0]?.performed_on ?? null, todaySession: mine.find((s) => s.performed_on === today())?.id ?? null };
  });
}

export async function listExercises() { return clone(db.exercise); }

export async function startSession(workoutId) {
  await wait();
  const used = lastUsedRows();
  const id = nextId('session');
  db.session.push({ id, workout_id: workoutId, performed_on: today(), created_at: new Date().toISOString(), note: null });
  for (const we of db.workout_entry.filter((e) => e.workout_id === workoutId && !e.archived_at)) {
    const ex = db.exercise.find((x) => x.id === we.exercise_id);
    const forms = used.filter((u) => u.exercise_id === ex.id && u.form).sort((a, b) => b.performed_on.localeCompare(a.performed_on));
    db.session_entry.push({ id: nextId('session_entry'), session_id: id, workout_entry_id: we.id, exercise_id: we.exercise_id,
      sort_order: we.sort_order, side: we.side, is_warmup: we.is_warmup, form: ex.pushup_name ? (forms[0]?.form ?? 'press') : null });
  }
  return id;
}

export async function loadPrevious(sessionId) {
  const s = db.session.find((x) => x.id === sessionId);
  const out = new Map();
  for (const se of db.session_entry.filter((e) => e.session_id === sessionId && e.workout_entry_id)) {
    const cands = db.session_entry.filter((p) => p.workout_entry_id === se.workout_entry_id && p.form === se.form).map((p) => ({
      p, ps: db.session.find((x) => x.id === p.session_id), st: db.set.find((x) => x.session_entry_id === p.id),
    })).filter(({ ps, st }) => st && st.reps !== null && (ps.performed_on < s.performed_on || (ps.performed_on === s.performed_on && ps.created_at < s.created_at)))
      .sort((a, b) => b.ps.performed_on.localeCompare(a.ps.performed_on));
    if (cands[0]) out.set(se.id, { session_entry_id: se.id, reps: cands[0].st.reps, performed_on: cands[0].ps.performed_on });
  }
  return out;
}

export async function loadSession(sessionId) {
  await wait();
  const session = clone(db.session.find((s) => s.id === sessionId));
  const entries = clone(db.session_entry.filter((e) => e.session_id === sessionId).sort((a, b) => a.sort_order - b.sort_order));
  for (const e of entries) e.set = clone(db.set.find((s) => s.session_entry_id === e.id) ?? null);
  return {
    session, workout: clone(db.workout.find((w) => w.id === session.workout_id)), entries,
    exercises: clone(db.exercise), used: lastUsedRows(), previous: await loadPrevious(sessionId),
  };
}

export async function saveSet(entryId, fields) {
  await wait();
  let row = db.set.find((s) => s.session_entry_id === entryId);
  if (!row) { row = { id: nextId('set'), session_entry_id: entryId }; db.set.push(row); }
  Object.assign(row, fields);
  return clone(row);
}
export async function deleteSet(entryId) { db.set = db.set.filter((s) => s.session_entry_id !== entryId); }
export async function updateEntry(id, fields) { Object.assign(db.session_entry.find((e) => e.id === id), fields); }
export async function removeEntry(id) { db.session_entry = db.session_entry.filter((e) => e.id !== id); db.set = db.set.filter((s) => s.session_entry_id !== id); }
export async function addEntry(fields) {
  const row = { id: nextId('session_entry'), workout_entry_id: null, side: null, is_warmup: false, ...fields };
  db.session_entry.push(row);
  return clone(row);
}
export async function setNextLoad(id, type, value) { Object.assign(db.exercise.find((e) => e.id === id), { next_load_type: type, next_load_value: value }); }
export async function updateSession(id, fields) { Object.assign(db.session.find((s) => s.id === id), fields); }
export async function deleteSession(id) {
  const ids = db.session_entry.filter((e) => e.session_id === id).map((e) => e.id);
  db.set = db.set.filter((s) => !ids.includes(s.session_entry_id));
  db.session_entry = db.session_entry.filter((e) => e.session_id !== id);
  db.session = db.session.filter((s) => s.id !== id);
}
export async function exportRows() {
  return db.set.map((st) => ({ date: '2026-09-01', exercise: 'x', reps: st.reps, note: 'a, "quoted" note' }));
}
