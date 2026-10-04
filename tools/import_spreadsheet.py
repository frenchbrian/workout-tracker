"""One-time import of the workout spreadsheet into Supabase.

Usage: python tools/import_spreadsheet.py <workbook.xlsx> <output.sql>

Produces a single SQL script to paste into the Supabase SQL Editor. The output
contains personal workout data: never commit it. Rules follow
docs/import/exercise-mapping.md.
"""
import collections
import datetime
import sys

import openpyxl

CUTOFF = datetime.date(2025, 4, 1)

# sheet -> (workout, name col, weight col, reps col, new-weight/notes col, position col), 1-based
SHEETS = {
    'Chest n Back (2)': ('Chest n Back', 1, 2, 3, 5, 6),
    'Chest n Back': ('Chest n Back', 1, 2, 3, 5, 6),
    'Chest n Back 2': ('Chest n Back', 1, 2, 3, 5, 6),
    'Upper Body': ('Upper Body', 2, 3, 4, 6, 7),
    'Legs': ('Legs', 1, 2, 3, 5, 6),
    'Shoulders n Arms': ('Shoulders n Arms', 1, 2, 3, 5, 6),
    'Kettlebell 20 min': ('Kettlebell', 2, 3, 4, 7, None),
}
SHEET_PRIORITY = list(SHEETS)  # earlier sheet wins when two sheets disagree about a date
WORKOUT_ORDER = ['Chest n Back', 'Upper Body', 'Shoulders n Arms', 'Legs', 'Kettlebell']

# Catalog: name -> (pushup_name, load rule, duration_seconds)
# Load rules: chest, bands, free, machine, mixed (<10 machine else free), vest, body, situps, abroller
CATALOG = {
    'Bench Press': ('Pushup', 'chest', None),
    'Military Press': ('Military Pushup', 'chest', None),
    'Bench Press (Wide)': ('Wide Pushup', 'chest', None),
    'Close-Grip Press': ('Diamond Pushup', 'chest', None),
    'Decline Press': ('Decline Pushup', 'chest', None),
    'Incline Press': ('Incline Pushup', 'chest', None),
    'Side to Side Pushup': (None, 'body', None),
    'Under the Rope Pushup': (None, 'body', None),
    'Wide Pull Up': (None, 'bands', None),
    'Reverse Grip Pull Down': (None, 'bands', None),
    'Narrow Pull Down': (None, 'bands', None),
    'Seated Lat Row': (None, 'bands', None),
    'Shoulder Press': (None, 'free', None),
    'Lateral Shoulder Raise': (None, 'mixed', None),
    'Standing Biceps Curl': (None, 'mixed', None),
    'In and Out Curls': (None, 'free', None),
    'Forearm Curl': (None, 'free', None),
    'Reverse Forearm Curl': (None, 'free', None),
    'Shoulder Shrug': (None, 'mixed', None),
    'Shoulder Shrug (Bar)': (None, 'machine', None),
    'Triceps Extension': (None, 'mixed', None),
    'Overhead Triceps Extension': (None, 'machine', None),
    'Triceps Pushdown': (None, 'machine', None),
    'Squat': (None, 'machine', None),
    'Leg Extension': (None, 'machine', None),
    'Leg Curl': (None, 'machine', None),
    'Leg Pull Back': (None, 'machine', None),
    'Internal Leg': (None, 'machine', None),
    'External Leg': (None, 'machine', None),
    'Lunges': (None, 'vest', None),
    'Calf Raises': (None, 'vest', None),
    'Situps': (None, 'situps', None),
    'Ab Roller': (None, 'abroller', None),
    'Jumps': (None, 'body', None),
    'Kettlebell Swing': (None, 'free', 40),
    'Kettlebell Squat': (None, 'free', 40),
    'Single Leg RDL': (None, 'free', 40),
    'Kettlebell Shoulder Press': (None, 'free', 40),
    'Ballistic Row': (None, 'free', 40),
    'Kettlebell Curl': (None, 'free', 40),
    'Kettlebell Triceps Extension': (None, 'free', 40),
}

# spreadsheet name -> (catalog name, side). Kettlebell names are looked up first.
KETTLEBELL_NAMES = {
    'Swing': 'Kettlebell Swing', 'Squat': 'Kettlebell Squat', 'Single Leg RDL': 'Single Leg RDL',
    'Shoulder Press': 'Kettlebell Shoulder Press', 'Ballistic Rows': 'Ballistic Row',
    'Pushups': 'Bench Press', 'Curls': 'Kettlebell Curl', 'Triceps Extension': 'Kettlebell Triceps Extension',
}
NAMES = {
    'Pushups': 'Bench Press', 'Pushups w/bar': 'Bench Press', 'Military Pushup': 'Military Press',
    'Diamond Pushup': 'Close-Grip Press', 'Incline Pushup': 'Incline Press',
    'Shoulder Shrug w/bar': 'Shoulder Shrug (Bar)', 'Intermnal Leg': 'Internal Leg',
    'Lunge with Weight Vest': 'Lunges', 'Situp': 'Situps', 'Ab Rolls': 'Ab Roller', 'abroller': 'Ab Roller',
}


def catalog_name(workout, raw):
    side = None
    if workout == 'Kettlebell':
        if raw[-2:] in (' L', ' R'):
            raw, side = raw[:-2], raw[-1]
        name = KETTLEBELL_NAMES[raw]
    else:
        name = NAMES.get(raw, raw)
    if name not in CATALOG:
        raise SystemExit(f'Unmapped exercise: {raw!r} in {workout}')
    return name, side


def num(v):
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        try:
            return float(v.strip())
        except ValueError:
            return None
    return None


def load_for(rule, raw_w, workout):
    """-> (load_type, value, form, note). form is None unless the Exercise has Forms."""
    v = num(raw_w)
    note = raw_w.strip() if isinstance(raw_w, str) and v is None and raw_w.strip() else None
    if v == 0:
        v = None
    if rule == 'chest':
        if workout == 'Kettlebell' or v is None:
            return 'body', None, 'pushup', note
        if v >= 20:
            return 'weight_vest', v, 'pushup', note
        return 'machine', v, 'press', note
    if rule == 'bands':
        return 'bands', v, None, note
    if rule == 'free':
        return 'free_weight', v, None, note
    if rule == 'machine':
        return 'machine', v, None, note
    if rule == 'mixed':
        return ('machine' if v is not None and v < 10 else 'free_weight'), v, None, note
    if rule == 'vest':
        return ('body', None, None, note) if v is None else ('weight_vest', v, None, note)
    if rule == 'situps':
        return 'free_weight', 26.0, None, None
    if rule in ('abroller', 'body'):
        return 'body', None, None, note
    raise ValueError(rule)


def read_blocks(wb):
    blocks = []
    for sheet, (workout, nc, wc, rc, ec, pc) in SHEETS.items():
        ws = wb[sheet]
        sheet_blocks, cur = [], None
        for r in ws.iter_rows():
            vals = {c.column: c.value for c in r}
            d = next((v.date() for v in vals.values() if isinstance(v, datetime.datetime)), None)
            if d:
                cur = {'sheet': sheet, 'workout': workout, 'date': d, 'row': r[0].row, 'rows': []}
                sheet_blocks.append(cur)
            if cur is None:
                continue
            nm = vals.get(nc)
            if not isinstance(nm, str) or not nm.strip() or nm.strip() in ('Exercise', 'Date'):
                continue
            cur['rows'].append({'name': nm.strip(), 'w': vals.get(wc), 'reps': vals.get(rc),
                                'e': vals.get(ec), 'p': vals.get(pc) if pc else None})
        # Wrong years: walking backwards, a date later than any following date loses a year.
        earliest = None
        for b in reversed(sheet_blocks):
            if earliest and b['date'] > earliest:
                b['date'] = b['date'].replace(year=b['date'].year - 1)
            earliest = b['date'] if earliest is None else min(earliest, b['date'])
        blocks += [b for b in sheet_blocks if b['date'] >= CUTOFF]
    return blocks


def signature(b):
    return [(x['name'], x['w'], x['reps']) for x in b['rows']]


def select_sessions(blocks):
    """Drop empty blocks, copies across sheets, and near-identical same-day copies."""
    blocks = [b for b in blocks if any(num(x['reps']) is not None for x in b['rows'])]
    blocks.sort(key=lambda b: (SHEET_PRIORITY.index(b['sheet']), b['row']))
    kept = []
    for b in blocks:
        same_day = [k for k in kept if k['workout'] == b['workout'] and k['date'] == b['date']]
        if any(signature(k) == signature(b) for k in same_day):
            continue  # identical copy (e.g. Chest n Back vs Chest n Back (2))
        if any(k['sheet'] != b['sheet'] for k in same_day):
            continue  # another sheet already has this date; the higher-priority sheet wins
        near = [k for k in same_day if len(signature(k)) == len(signature(b)) and
                sum(a == c for a, c in zip(signature(k), signature(b))) >= 0.9 * len(signature(b))]
        if near:
            continue  # accidental copy within a sheet (2025-11-20)
        kept.append(b)
    kept.sort(key=lambda b: (b['date'], SHEET_PRIORITY.index(b['sheet']), b['row']))
    return kept


def build(sessions):
    exercises = {name: i + 1 for i, name in enumerate(CATALOG)}
    workouts = {name: i + 1 for i, name in enumerate(WORKOUT_ORDER)}
    entries = {}            # (workout, exercise, side, warmup, occurrence) -> entry id
    entry_rows = []         # [id, workout_id, exercise_id, sort_order, side, warmup, archived]
    session_rows, se_rows, set_rows = [], [], []
    per_day = collections.Counter()
    for b in sessions:
        wk = b['workout']
        per_day[(wk, b['date'])] += 1
        sid = len(session_rows) + 1
        created = datetime.datetime.combine(b['date'], datetime.time(12)) + datetime.timedelta(minutes=per_day[(wk, b['date'])])
        session_rows.append((sid, workouts[wk], b['date'], created))
        b['entry_keys'] = []
        occurrences = collections.Counter()
        for sort_order, x in enumerate(b['rows'], 1):
            name, side = catalog_name(wk, x['name'])
            warmup = isinstance(x['w'], str) and x['w'].strip().lower() == 'warmup'
            raw_w = None if warmup else x['w']
            occurrences[(name, side, warmup)] += 1
            key = (wk, name, side, warmup, occurrences[(name, side, warmup)])
            if key not in entries:
                entries[key] = len(entry_rows) + 1
                entry_rows.append([entries[key], workouts[wk], exercises[name], sort_order, side, warmup, True])
            b['entry_keys'].append(key)
            ltype, lval, form, note = load_for(CATALOG[name][1], raw_w, wk)
            if CATALOG[name][0] is None:
                form = None
            notes = [n for n in (note, x['e'] if isinstance(x['e'], str) else None,
                                 x['p'] if isinstance(x['p'], str) else None) if n and str(n).strip()]
            position = int(num(x['p'])) if num(x['p']) is not None else None
            seid = len(se_rows) + 1
            se_rows.append((seid, sid, entries[key], exercises[name], sort_order, side, warmup, form))
            reps = num(x['reps'])
            if reps is not None:
                set_rows.append((seid, ltype, lval, position, int(round(reps)), '; '.join(str(n).strip() for n in notes) or None, created))
    # The latest Session of each Workout defines its current list and order.
    latest = {}
    for b in sessions:
        latest[b['workout']] = b
    for wk, b in latest.items():
        for sort_order, key in enumerate(b['entry_keys'], 1):
            row = entry_rows[entries[key] - 1]
            row[3], row[6] = sort_order, False
    return exercises, workouts, entry_rows, session_rows, se_rows, set_rows


def lit(v):
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return repr(v) if not float(v).is_integer() else str(int(v))
    if isinstance(v, datetime.datetime):
        return f"'{v.isoformat()}'"
    if isinstance(v, datetime.date):
        return f"'{v.isoformat()}'"
    return "'" + str(v).replace("'", "''") + "'"


def values(rows):
    return ',\n'.join('(' + ','.join(lit(v) for v in r) + ')' for r in rows)


def write_sql(path, exercises, workouts, entry_rows, session_rows, se_rows, set_rows):
    ex_rows = [(i, name, CATALOG[name][0], CATALOG[name][2]) for name, i in exercises.items()]
    wk_rows = [(i, name) for name, i in workouts.items()]
    sql = f"""-- Generated by tools/import_spreadsheet.py. Contains personal data: do not commit.
begin;
create temporary table import_owner on commit drop as select id from auth.users;
do $$ begin
  if (select count(*) from import_owner) <> 1 then
    raise exception 'Expected exactly one user, found %', (select count(*) from import_owner);
  end if;
  if exists (select 1 from public.exercise) or exists (select 1 from public.session) then
    raise exception 'Data already exists; the import only runs on an empty database';
  end if;
end $$;

insert into public.exercise (id, user_id, name, pushup_name, duration_seconds) overriding system value
select v.id, o.id, v.name, v.pushup_name, v.duration::smallint from import_owner o, (values
{values(ex_rows)}
) v(id, name, pushup_name, duration);

insert into public.workout (id, user_id, name) overriding system value
select v.id, o.id, v.name from import_owner o, (values
{values(wk_rows)}
) v(id, name);

insert into public.workout_entry (id, user_id, workout_id, exercise_id, sort_order, side, is_warmup, archived_at) overriding system value
select v.id, o.id, v.workout_id, v.exercise_id, v.sort_order, v.side::side, v.is_warmup,
       case when v.archived then now() end
from import_owner o, (values
{values(entry_rows)}
) v(id, workout_id, exercise_id, sort_order, side, is_warmup, archived);

insert into public.session (id, user_id, workout_id, performed_on, created_at) overriding system value
select v.id, o.id, v.workout_id, v.performed_on::date, v.created_at::timestamptz from import_owner o, (values
{values(session_rows)}
) v(id, workout_id, performed_on, created_at);

insert into public.session_entry (id, user_id, session_id, workout_entry_id, exercise_id, sort_order, side, is_warmup, form) overriding system value
select v.id, o.id, v.session_id, v.workout_entry_id, v.exercise_id, v.sort_order, v.side::side, v.is_warmup, v.form::form
from import_owner o, (values
{values(se_rows)}
) v(id, session_id, workout_entry_id, exercise_id, sort_order, side, is_warmup, form);

insert into public.set (user_id, session_entry_id, load_type, load_value, position, reps, note, logged_at)
select o.id, v.session_entry_id, v.load_type::load_type, v.load_value::numeric, v.position::smallint, v.reps::smallint, v.note, v.logged_at::timestamptz
from import_owner o, (values
{values(set_rows)}
) v(session_entry_id, load_type, load_value, position, reps, note, logged_at);

select setval(pg_get_serial_sequence('public.exercise', 'id'), (select max(id) from public.exercise));
select setval(pg_get_serial_sequence('public.workout', 'id'), (select max(id) from public.workout));
select setval(pg_get_serial_sequence('public.workout_entry', 'id'), (select max(id) from public.workout_entry));
select setval(pg_get_serial_sequence('public.session', 'id'), (select max(id) from public.session));
select setval(pg_get_serial_sequence('public.session_entry', 'id'), (select max(id) from public.session_entry));

commit;

select (select count(*) from public.workout) as workouts,
       (select count(*) from public.exercise) as exercises,
       (select count(*) from public.session) as sessions,
       (select count(*) from public.set) as sets;
"""
    with open(path, 'w', encoding='utf-8') as f:
        f.write(sql)


def main():
    wb = openpyxl.load_workbook(sys.argv[1])
    sessions = select_sessions(read_blocks(wb))
    data = build(sessions)
    write_sql(sys.argv[2], *data)
    _, _, entry_rows, session_rows, se_rows, set_rows = data
    by_wk = collections.Counter(b['workout'] for b in sessions)
    print(f'{len(session_rows)} sessions, {len(set_rows)} sets, {len(entry_rows)} list entries '
          f'({sum(not r[6] for r in entry_rows)} current)')
    for wk in WORKOUT_ORDER:
        dates = [b['date'] for b in sessions if b['workout'] == wk]
        print(f'  {wk}: {by_wk[wk]} sessions, {min(dates)} to {max(dates)}')


if __name__ == '__main__':
    main()
