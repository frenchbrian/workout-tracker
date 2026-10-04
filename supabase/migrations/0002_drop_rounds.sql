-- Workouts are written out in full (repeats included), so there are no Rounds:
-- each list entry in a Session has at most one Set. See CONTEXT.md.

drop view exercise_last_used;
drop function previous_reps(bigint);

alter table workout drop column rounds;

alter table set drop constraint set_session_entry_id_round_key;
alter table set drop column round;
alter table set add constraint set_session_entry_id_key unique (session_entry_id);

-- Previous Reps for every list entry in a Session: same workout entry, same Form,
-- from the most recent earlier Session of the same Workout in which that entry was done.
create function previous_reps(p_session_id bigint)
returns table (session_entry_id bigint, reps smallint, performed_on date)
language sql stable security invoker as $$
  select se.id, prev.reps, prev.performed_on
  from session_entry se
  join session s on s.id = se.session_id
  cross join lateral (
    select st.reps, ps.performed_on
    from session_entry pse
    join session ps on ps.id = pse.session_id
    join set st on st.session_entry_id = pse.id
    where pse.workout_entry_id = se.workout_entry_id
      and pse.form is not distinct from se.form
      and st.reps is not null
      and (ps.performed_on, ps.created_at) < (s.performed_on, s.created_at)
    order by ps.performed_on desc, ps.created_at desc
    limit 1
  ) prev
  where se.session_id = p_session_id and se.workout_entry_id is not null
$$;

create view exercise_last_used with (security_invoker = true) as
select distinct on (se.exercise_id, se.form)
  se.exercise_id, se.form, st.load_type, st.load_value, st.position, s.performed_on
from set st
join session_entry se on se.id = st.session_entry_id
join session s on s.id = se.session_id
order by se.exercise_id, se.form, s.performed_on desc, s.created_at desc, se.sort_order desc;
