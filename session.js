import * as db from './data.js';
import { h, shortDate, fmtNum, LOAD_TYPES, beep, primeAudio } from './ui.js';

// The Session page: one row per list entry, saved as you go.
export async function renderSession(root, sessionId, { toast, go }) {
  root.replaceChildren(h('p', { class: 'muted' }, 'Loading…'));
  const state = await db.loadSession(sessionId);
  const { session, workout } = state;
  const exById = new Map(state.exercises.map((e) => [e.id, e]));
  const lastUsed = new Map(state.used.map((u) => [`${u.exercise_id}|${u.form ?? ''}`, u]));
  let entries = state.entries;
  let previous = state.previous;

  const run = (fn) => async (...args) => {
    try { await fn(...args); } catch (err) { toast(`Couldn't save: ${err.message}`, true); }
  };

  const name = (e) => {
    const ex = exById.get(e.exercise_id);
    return e.form === 'pushup' ? ex.pushup_name : ex.name;
  };
  const allowedTypes = (e) =>
    e.form === 'press' ? ['machine'] : e.form === 'pushup' ? ['body', 'weight_vest'] : Object.keys(LOAD_TYPES);

  // What to show in an entry's load fields before a Set is logged.
  function prefill(e) {
    if (e.set) return { load_type: e.set.load_type, load_value: e.set.load_value, position: e.set.position, reps: e.set.reps, note: e.set.note ?? '' };
    const ex = exById.get(e.exercise_id);
    const allowed = allowedTypes(e);
    const earlier = entries.filter((o) => o.sort_order < e.sort_order && o.exercise_id === e.exercise_id && o.form === e.form && o.set)
      .sort((a, b) => b.sort_order - a.sort_order)[0]?.set;
    const last = lastUsed.get(`${e.exercise_id}|${e.form ?? ''}`);
    const source = earlier || last;
    let load_type = source?.load_type ?? (e.form ? allowed[0] : 'free_weight');
    let load_value = source?.load_value ?? null;
    let position = source?.position ?? null;
    if (ex.next_load_type && allowed.includes(ex.next_load_type)) {
      load_type = ex.next_load_type;
      load_value = ex.next_load_value;
    }
    if (!allowed.includes(load_type)) { load_type = allowed[0]; load_value = null; }
    if (load_type === 'body') load_value = null;
    if (load_type !== 'machine') position = null; // Position is a machine setting
    return { load_type, load_value, position, reps: null, note: '' };
  }

  const drafts = new Map(entries.map((e) => [e.id, prefill(e)]));

  async function persist(e) {
    const d = drafts.get(e.id);
    const reps = d.reps === null || d.reps === '' ? null : Number(d.reps);
    const note = (d.note ?? '').trim() || null;
    if (reps === null && !note) {
      if (e.set) { await db.deleteSet(e.id); e.set = null; }
    } else {
      e.set = await db.saveSet(e.id, {
        load_type: d.load_type,
        load_value: d.load_type === 'body' || d.load_value === '' || d.load_value === null ? null : Number(d.load_value),
        position: d.load_type !== 'machine' || d.position === '' || d.position === null ? null : Number(d.position),
        reps,
        note,
      });
      await consumeNextLoad(e);
    }
    toast('Saved');
    refreshRow(e);
  }

  // A Next Load is used up once a Set is logged at that Load.
  async function consumeNextLoad(e) {
    const ex = exById.get(e.exercise_id);
    if (!ex.next_load_type || !e.set || e.set.reps === null) return;
    if (e.set.load_type === ex.next_load_type && Number(e.set.load_value) === Number(ex.next_load_value)) {
      await db.setNextLoad(ex.id, null, null);
      ex.next_load_type = ex.next_load_value = null;
      refreshExercise(ex.id, e.id);
    }
  }

  function refreshExercise(exerciseId, exceptId) {
    for (const o of entries) {
      if (o.exercise_id !== exerciseId || o.id === exceptId) continue;
      if (!o.set) drafts.set(o.id, prefill(o));
      refreshRow(o);
    }
  }

  const rowNodes = new Map();
  // Redraw a row, unless you're typing in it: then only update what can change underneath you.
  function refreshRow(e, force = false) {
    const old = rowNodes.get(e.id);
    if (!force && old?.contains(document.activeElement)) {
      old.classList.toggle('done', !!(e.set && e.set.reps !== null));
      const next = old.querySelector('.next input');
      const ex = exById.get(e.exercise_id);
      // Leave it alone only if you've started typing a new value into it.
      if (next && (next !== document.activeElement || next.value === next.dataset.shown)) {
        next.value = next.dataset.shown = fmtNum(ex.next_load_value);
      }
      return;
    }
    const fresh = renderRow(e);
    rowNodes.set(e.id, fresh);
    if (old?.isConnected) old.replaceWith(fresh);
  }

  function renderRow(e) {
    const ex = exById.get(e.exercise_id);
    const d = drafts.get(e.id);
    const prev = previous.get(e.id);
    const done = e.set && e.set.reps !== null;
    const allowed = allowedTypes(e);

    const repsInput = h('input', {
      type: 'number', inputmode: 'numeric', min: 0, class: 'reps', value: d.reps ?? '', 'aria-label': `Reps for ${name(e)}`,
      onchange: run(async (ev) => { d.reps = ev.target.value; await persist(e); }),
    });
    const onLoadChange = run(async () => { if (e.set) await persist(e); });

    const typeSelect = allowed.length > 1
      ? h('select', {
        'aria-label': 'Load type',
        onchange: async (ev) => {
          d.load_type = ev.target.value;
          if (d.load_type === 'body') d.load_value = null;
          refreshRow(e, true);
          await onLoadChange();
        },
      }, allowed.map((t) => h('option', { value: t, selected: t === d.load_type }, LOAD_TYPES[t])))
      : h('span', { class: 'load-type' }, LOAD_TYPES[allowed[0]]);

    const valueInput = d.load_type === 'body' ? null : h('input', {
      type: 'number', step: 'any', inputmode: 'decimal', class: 'load', value: fmtNum(d.load_value), 'aria-label': 'Load',
      onchange: async (ev) => { d.load_value = ev.target.value; await onLoadChange(); },
    });
    const posInput = d.load_type !== 'machine' ? null : h('label', { class: 'pos' }, 'Pos ', h('input', {
      type: 'number', inputmode: 'numeric', value: d.position ?? '', 'aria-label': 'Machine position',
      onchange: async (ev) => { d.position = ev.target.value; await onLoadChange(); },
    }));

    const nextInput = d.load_type === 'body' && !ex.next_load_type ? null : h('label', { class: 'next' }, 'Next time ', h('input', {
      type: 'number', step: 'any', inputmode: 'decimal', value: fmtNum(ex.next_load_value),
      'data-shown': fmtNum(ex.next_load_value), placeholder: '—', 'aria-label': `Next load for ${ex.name}`,
      onchange: run(async (ev) => {
        const v = ev.target.value;
        ev.target.dataset.shown = v;
        const type = d.load_type === 'body' ? (allowed.includes('weight_vest') ? 'weight_vest' : null) : d.load_type;
        if (v === '' || !type) { await db.setNextLoad(ex.id, null, null); ex.next_load_type = ex.next_load_value = null; }
        else { await db.setNextLoad(ex.id, type, Number(v)); ex.next_load_type = type; ex.next_load_value = Number(v); }
        toast(v === '' ? 'Next load cleared' : `Next time: ${v}`);
        refreshExercise(ex.id, e.id);
      }),
    }));

    const formToggle = ex.pushup_name ? h('div', { class: 'forms', role: 'group', 'aria-label': 'Form' },
      ['press', 'pushup'].map((f) => h('button', {
        type: 'button', class: f === e.form ? 'chip on' : 'chip', disabled: !!e.set,
        title: e.set ? 'Clear the reps to switch' : '',
        onclick: run(async () => { await setForm([e], f); }),
      }, f === 'press' ? 'Press' : 'Pushup'))) : null;

    const timer = ex.duration_seconds ? timerButton(ex.duration_seconds) : null;

    const noteInput = h('input', {
      type: 'text', class: 'note', value: d.note ?? '', placeholder: 'Note', 'aria-label': `Note for ${name(e)}`,
      onchange: run(async (ev) => { d.note = ev.target.value; await persist(e); }),
    });

    const idx = entries.indexOf(e);
    const tools = h('div', { class: 'tools' },
      h('button', { type: 'button', class: 'icon', title: 'Move up', 'aria-label': 'Move up', disabled: idx === 0, onclick: run(() => move(e, -1)) }, '↑'),
      h('button', { type: 'button', class: 'icon', title: 'Move down', 'aria-label': 'Move down', disabled: idx === entries.length - 1, onclick: run(() => move(e, 1)) }, '↓'),
      h('button', { type: 'button', class: 'icon', title: 'Remove from today', 'aria-label': 'Remove from today', onclick: run(() => remove(e)) }, '✕'));

    return h('li', { class: done ? 'entry done' : 'entry' },
      h('div', { class: 'head' },
        h('span', { class: 'num' }, idx + 1),
        h('span', { class: 'name' }, name(e)),
        e.side && h('span', { class: 'badge' }, e.side === 'L' ? 'Left' : 'Right'),
        e.is_warmup && h('span', { class: 'badge' }, 'Warmup'),
        h('span', { class: prev ? 'beat' : 'beat none' }, prev ? `Beat ${prev.reps}` : 'No previous', prev && h('small', {}, ` · ${shortDate(prev.performed_on)}`)),
        tools),
      h('div', { class: 'fields' },
        formToggle,
        h('div', { class: 'load-group' }, typeSelect, valueInput, posInput),
        h('label', { class: 'reps-label' }, 'Reps ', repsInput),
        timer,
        nextInput,
        noteInput));
  }

  function timerButton(seconds) {
    let left = 0, handle = null;
    const btn = h('button', { type: 'button', class: 'timer' }, `▶ ${seconds}s`);
    btn.addEventListener('click', () => {
      primeAudio();
      if (handle) { clearInterval(handle); handle = null; btn.textContent = `▶ ${seconds}s`; btn.classList.remove('running'); return; }
      left = seconds;
      btn.classList.add('running');
      btn.textContent = `${left}s`;
      handle = setInterval(() => {
        left -= 1;
        if (left > 0) { btn.textContent = `${left}s`; return; }
        clearInterval(handle); handle = null;
        btn.classList.remove('running');
        btn.textContent = 'Time ✓';
        beep();
      }, 1000);
    });
    return btn;
  }

  async function setForm(list, form) {
    const targets = list.filter((e) => !e.set && e.form && e.form !== form);
    await Promise.all(targets.map((e) => db.updateEntry(e.id, { form })));
    for (const e of targets) e.form = form;
    previous = await db.loadPrevious(session.id);
    for (const e of targets) drafts.set(e.id, prefill(e));
    renderList();
  }

  async function move(e, dir) {
    const i = entries.indexOf(e);
    const other = entries[i + dir];
    const a = e.sort_order, b = other.sort_order;
    await Promise.all([db.updateEntry(e.id, { sort_order: b }), db.updateEntry(other.id, { sort_order: a })]);
    e.sort_order = b; other.sort_order = a;
    entries.sort((x, y) => x.sort_order - y.sort_order);
    renderList();
  }

  async function remove(e) {
    if (!confirm(`Remove ${name(e)} from today's workout? (Your saved workout list isn't changed.)`)) return;
    await db.removeEntry(e.id);
    entries = entries.filter((o) => o !== e);
    renderList();
  }

  async function add(exerciseId) {
    const ex = exById.get(exerciseId);
    const sort_order = Math.max(0, ...entries.map((e) => e.sort_order)) + 1;
    const row = await db.addEntry({ session_id: session.id, exercise_id: ex.id, sort_order, form: ex.pushup_name ? 'press' : null });
    row.set = null;
    entries.push(row);
    drafts.set(row.id, prefill(row));
    renderList();
  }

  const list = h('ol', { class: 'entries' });
  function renderList() {
    list.replaceChildren(...entries.map((e) => { const n = renderRow(e); rowNodes.set(e.id, n); return n; }));
  }
  renderList();

  const hasForms = entries.some((e) => e.form);
  const switchAll = hasForms ? h('div', { class: 'switch-all' }, 'All chest exercises: ',
    h('button', { type: 'button', class: 'chip', onclick: run(() => setForm(entries, 'press')) }, 'Press (machine)'),
    h('button', { type: 'button', class: 'chip', onclick: run(() => setForm(entries, 'pushup')) }, 'Pushup (body)')) : null;

  const addSelect = h('select', { 'aria-label': 'Exercise to add' },
    h('option', { value: '' }, 'Add an exercise for today…'),
    state.exercises.map((ex) => h('option', { value: ex.id }, ex.pushup_name ? `${ex.name} / ${ex.pushup_name}` : ex.name)));
  addSelect.addEventListener('change', run(async () => {
    if (!addSelect.value) return;
    await add(Number(addSelect.value));
    addSelect.value = '';
  }));

  const dateInput = h('input', {
    type: 'date', value: session.performed_on, 'aria-label': 'Workout date',
    onchange: run(async (ev) => { await db.updateSession(session.id, { performed_on: ev.target.value }); session.performed_on = ev.target.value; toast('Date saved'); }),
  });
  const sessionNote = h('textarea', {
    rows: 2, placeholder: 'Note for this workout', value: session.note ?? '',
    onchange: run(async (ev) => { await db.updateSession(session.id, { note: ev.target.value.trim() || null }); toast('Saved'); }),
  });

  root.replaceChildren(...[
    h('div', { class: 'session-head' },
      h('a', { href: '#/', class: 'back' }, '← Workouts'),
      h('h2', {}, workout.name),
      h('label', { class: 'date' }, 'Date ', dateInput)),
    h('p', { class: 'muted hint' }, 'Type your reps as you go — each one saves automatically. Leave anything you skip blank.'),
    switchAll,
    list,
    h('div', { class: 'add' }, addSelect),
    sessionNote,
    h('div', { class: 'session-actions' },
      h('button', { type: 'button', onclick: () => go('#/') }, 'Finish'),
      h('button', {
        type: 'button', class: 'danger',
        onclick: run(async () => {
          if (!confirm('Delete this whole workout session and everything logged in it?')) return;
          await db.deleteSession(session.id);
          go('#/');
        }),
      }, 'Delete this session')),
  ].filter(Boolean));
}
