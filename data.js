import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
import { today } from './ui.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// Supabase returns at most 1000 rows per request; page through larger tables.
async function selectAll(build) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const page = check(await build().range(from, from + 999));
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

export async function listWorkouts() {
  const workouts = check(await supabase.from('workout').select('id, name').is('archived_at', null).order('id'));
  const sessions = await selectAll(() =>
    supabase.from('session').select('id, workout_id, performed_on').order('performed_on', { ascending: false }).order('created_at', { ascending: false }));
  for (const w of workouts) {
    const mine = sessions.filter((s) => s.workout_id === w.id);
    w.lastDone = mine[0]?.performed_on ?? null;
    w.todaySession = mine.find((s) => s.performed_on === today())?.id ?? null;
  }
  return workouts;
}

export async function listExercises() {
  return check(await supabase.from('exercise').select('*').order('name'));
}

async function lastUsed() {
  return check(await supabase.from('exercise_last_used').select('*'));
}

// Most recent Form used per Exercise that has Forms.
function lastForms(rows) {
  const best = new Map();
  for (const r of rows) {
    if (!r.form) continue;
    const cur = best.get(r.exercise_id);
    if (!cur || r.performed_on > cur.performed_on) best.set(r.exercise_id, r);
  }
  return new Map([...best].map(([k, v]) => [k, v.form]));
}

export async function startSession(workoutId) {
  const [entries, exercises, used] = await Promise.all([
    supabase.from('workout_entry').select('*').eq('workout_id', workoutId).is('archived_at', null).order('sort_order').then(check),
    listExercises(),
    lastUsed(),
  ]);
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const forms = lastForms(used);
  const session = check(await supabase.from('session').insert({ workout_id: workoutId, performed_on: today() }).select().single());
  const rows = entries.map((e) => ({
    session_id: session.id,
    workout_entry_id: e.id,
    exercise_id: e.exercise_id,
    sort_order: e.sort_order,
    side: e.side,
    is_warmup: e.is_warmup,
    form: exById.get(e.exercise_id).pushup_name ? (forms.get(e.exercise_id) ?? 'press') : null,
  }));
  if (rows.length) check(await supabase.from('session_entry').insert(rows));
  return session.id;
}

export async function loadSession(sessionId) {
  const session = check(await supabase.from('session').select('*').eq('id', sessionId).single());
  const [workout, entries, exercises, used, previous] = await Promise.all([
    supabase.from('workout').select('*').eq('id', session.workout_id).single().then(check),
    supabase.from('session_entry').select('*').eq('session_id', sessionId).order('sort_order').then(check),
    listExercises(),
    lastUsed(),
    loadPrevious(sessionId),
  ]);
  const sets = entries.length
    ? check(await supabase.from('set').select('*').in('session_entry_id', entries.map((e) => e.id)))
    : [];
  const setByEntry = new Map(sets.map((s) => [s.session_entry_id, s]));
  for (const e of entries) e.set = setByEntry.get(e.id) ?? null;
  return { session, workout, entries, exercises, used, previous };
}

export async function loadPrevious(sessionId) {
  const rows = check(await supabase.rpc('previous_reps', { p_session_id: sessionId }));
  return new Map(rows.map((r) => [r.session_entry_id, r]));
}

export async function saveSet(entryId, fields) {
  return check(await supabase.from('set')
    .upsert({ session_entry_id: entryId, ...fields, logged_at: new Date().toISOString() }, { onConflict: 'session_entry_id' })
    .select().single());
}

export async function deleteSet(entryId) {
  check(await supabase.from('set').delete().eq('session_entry_id', entryId));
}

export async function updateEntry(entryId, fields) {
  check(await supabase.from('session_entry').update(fields).eq('id', entryId));
}

export async function removeEntry(entryId) {
  check(await supabase.from('session_entry').delete().eq('id', entryId));
}

export async function addEntry(fields) {
  return check(await supabase.from('session_entry').insert(fields).select().single());
}

export async function setNextLoad(exerciseId, type, value) {
  check(await supabase.from('exercise').update({ next_load_type: type, next_load_value: value }).eq('id', exerciseId));
}

export async function updateSession(sessionId, fields) {
  check(await supabase.from('session').update(fields).eq('id', sessionId));
}

export async function deleteSession(sessionId) {
  check(await supabase.from('session').delete().eq('id', sessionId));
}

export async function exportRows() {
  const [workouts, exercises, sessions, entries, sets] = await Promise.all([
    supabase.from('workout').select('id, name').then(check),
    listExercises(),
    selectAll(() => supabase.from('session').select('id, workout_id, performed_on, note').order('id')),
    selectAll(() => supabase.from('session_entry').select('id, session_id, exercise_id, sort_order, side, is_warmup, form').order('id')),
    selectAll(() => supabase.from('set').select('session_entry_id, load_type, load_value, position, reps, note').order('id')),
  ]);
  const byId = (rows) => new Map(rows.map((r) => [r.id, r]));
  const W = byId(workouts), E = byId(exercises), S = byId(sessions), SE = byId(entries);
  return sets.map((st) => {
    const se = SE.get(st.session_entry_id);
    const s = S.get(se.session_id);
    const ex = E.get(se.exercise_id);
    return {
      date: s.performed_on,
      workout: W.get(s.workout_id)?.name,
      order: se.sort_order,
      exercise: se.form === 'pushup' ? ex.pushup_name : ex.name,
      side: se.side ?? '',
      warmup: se.is_warmup ? 'yes' : '',
      load_type: st.load_type,
      load: st.load_value ?? '',
      position: st.position ?? '',
      reps: st.reps ?? '',
      note: st.note ?? '',
      session_note: s.note ?? '',
    };
  }).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order));
}
