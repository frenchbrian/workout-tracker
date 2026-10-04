-- Workout Tracker schema. Terms follow CONTEXT.md.
-- Single user: every row carries user_id, row-level security limits it to auth.uid(),
-- and foreign keys include user_id so a row can only point at the same user's rows.

create type load_type as enum ('bands', 'free_weight', 'machine', 'weight_vest', 'body');
create type form as enum ('press', 'pushup');
create type side as enum ('L', 'R');

-- Plans ---------------------------------------------------------------------

create table exercise (
  id               bigint generated always as identity primary key,
  user_id          uuid not null default auth.uid() references auth.users on delete cascade,
  name             text not null,            -- the Press Form name when the Exercise has Forms
  pushup_name      text,                     -- set only for chest Exercises that have two Forms
  duration_seconds smallint check (duration_seconds > 0),
  next_load_type   load_type,                -- pending Next Load; cleared once used
  next_load_value  numeric(6,2),
  created_at       timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id),
  check (case when next_load_type is null or next_load_type = 'body' then next_load_value is null
              else next_load_value is not null end)
);

create table workout (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  rounds      smallint not null default 2 check (rounds between 1 and 5),
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

-- One entry in a Workout's ordered list. Entries are archived, not deleted,
-- so Sessions that used them keep their Previous Reps lineage.
create table workout_entry (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  workout_id  bigint not null,
  exercise_id bigint not null,
  sort_order  smallint not null,
  side        side,
  is_warmup   boolean not null default false,
  archived_at timestamptz,
  unique (id, user_id),
  foreign key (workout_id, user_id) references workout (id, user_id) on delete cascade,
  foreign key (exercise_id, user_id) references exercise (id, user_id)
);
create index on workout_entry (workout_id, sort_order) where archived_at is null;

-- Logging -------------------------------------------------------------------

create table session (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  workout_id   bigint not null,
  performed_on date not null default current_date,
  note         text,
  created_at   timestamptz not null default now(),
  unique (id, user_id),
  foreign key (workout_id, user_id) references workout (id, user_id)
);
create index on session (workout_id, performed_on desc, created_at desc);

-- The Session's own copy of the list, so reordering, adding or dropping
-- applies to this Session only. workout_entry_id is null for an ad-hoc addition.
create table session_entry (
  id               bigint generated always as identity primary key,
  user_id          uuid not null default auth.uid() references auth.users on delete cascade,
  session_id       bigint not null,
  workout_entry_id bigint,
  exercise_id      bigint not null,
  sort_order       smallint not null,
  side             side,
  is_warmup        boolean not null default false,
  form             form,                     -- null unless the Exercise has Forms
  unique (session_id, workout_entry_id),
  unique (id, user_id),
  foreign key (session_id, user_id) references session (id, user_id) on delete cascade,
  foreign key (workout_entry_id, user_id) references workout_entry (id, user_id),
  foreign key (exercise_id, user_id) references exercise (id, user_id)
);
create index on session_entry (workout_entry_id);
create index on session_entry (exercise_id);

create table set (
  id               bigint generated always as identity primary key,
  user_id          uuid not null default auth.uid() references auth.users on delete cascade,
  session_entry_id bigint not null,
  round            smallint not null check (round between 1 and 5),
  load_type        load_type not null,
  load_value       numeric(6,2),             -- always null for Body; may be unknown for others
  position         smallint,                 -- machine Position
  reps             smallint check (reps >= 0),
  note             text,
  logged_at        timestamptz not null default now(),
  unique (session_entry_id, round),
  foreign key (session_entry_id, user_id) references session_entry (id, user_id) on delete cascade,
  check (load_type <> 'body' or load_value is null)
);

-- Derived values --------------------------------------------------------------

-- Previous Reps for every Set slot in a Session: same workout entry, same Round,
-- same Form, from the most recent earlier Session of the same Workout in which
-- that Round was done for that entry.
create function previous_reps(p_session_id bigint)
returns table (session_entry_id bigint, round smallint, reps smallint, performed_on date)
language sql stable security invoker as $$
  with cur as (
    select se.id, se.workout_entry_id, se.form, s.workout_id, s.performed_on, s.created_at
    from session_entry se join session s on s.id = se.session_id
    where se.session_id = p_session_id and se.workout_entry_id is not null
  ), rounds as (
    select generate_series(1, w.rounds)::smallint as round
    from workout w where w.id = (select workout_id from session where id = p_session_id)
  )
  select cur.id, r.round, prev.reps, prev.performed_on
  from cur cross join rounds r
  cross join lateral (
    select st.reps, ps.performed_on
    from session_entry pse
    join session ps on ps.id = pse.session_id
    join set st on st.session_entry_id = pse.id and st.round = r.round
    where pse.workout_entry_id = cur.workout_entry_id
      and pse.form is not distinct from cur.form
      and st.reps is not null
      and (ps.performed_on, ps.created_at) < (cur.performed_on, cur.created_at)
    order by ps.performed_on desc, ps.created_at desc
    limit 1
  ) prev
$$;

-- Last Form, Load and Position used per Exercise (and Form), for prefilling a new Session.
create view exercise_last_used with (security_invoker = true) as
select distinct on (se.exercise_id, se.form)
  se.exercise_id, se.form, st.load_type, st.load_value, st.position, s.performed_on
from set st
join session_entry se on se.id = st.session_entry_id
join session s on s.id = se.session_id
order by se.exercise_id, se.form, s.performed_on desc, s.created_at desc, st.round desc;

-- Row-level security -----------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['exercise','workout','workout_entry','session','session_entry','set'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy owner_all on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
