-- Run against a scratch Postgres after auth_stub.sql and all migrations.
\set ON_ERROR_STOP 1
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into exercise (name, pushup_name) values ('Bench Press (Wide)', 'Wide Pushup');
insert into exercise (name) values ('Seated Lat Row');
insert into workout (name) values ('Chest n Back');
-- list written in full: bench, row, bench (second pass), row (second pass)
insert into workout_entry (workout_id, exercise_id, sort_order) values (1,1,1),(1,2,2),(1,1,3),(1,2,4);
-- S1 (Sep 1): press, all four entries done
insert into session (workout_id, performed_on) values (1,'2026-09-01');
insert into session_entry (session_id, workout_entry_id, exercise_id, sort_order, form) values
 (1,1,1,1,'press'),(1,2,2,2,null),(1,3,1,3,'press'),(1,4,2,4,null);
insert into set (session_entry_id, load_type, load_value, position, reps) values
 (1,'machine',6,4,10),(2,'bands',230,null,11),(3,'machine',6,4,8),(4,'bands',230,null,9);
-- S2 (Sep 8): pushup, second pass skipped
insert into session (workout_id, performed_on) values (1,'2026-09-08');
insert into session_entry (session_id, workout_entry_id, exercise_id, sort_order, form) values
 (2,1,1,1,'pushup'),(2,2,2,2,null),(2,3,1,3,'pushup'),(2,4,2,4,null);
insert into set (session_entry_id, load_type, load_value, reps) values (5,'body',null,20),(6,'bands',230,13);
-- S3 (Sep 15): press again, rows moved first
insert into session (workout_id, performed_on) values (1,'2026-09-15');
insert into session_entry (session_id, workout_entry_id, exercise_id, sort_order, form) values
 (3,1,1,3,'press'),(3,2,2,1,null),(3,3,1,4,'press'),(3,4,2,2,null);
\echo 'Expect entry1=10 (9/1, skips pushup 9/8), entry2=13 (9/8), entry3=8 (9/1), entry4=9 (9/1, 9/8 skipped it)'
select se.workout_entry_id, pr.reps, pr.performed_on from previous_reps(3) pr join session_entry se on se.id=pr.session_entry_id order by 1;
\echo 'Last used:'
select * from exercise_last_used;
\set ON_ERROR_STOP 0
\echo 'Expect check-constraint error (body with a value):'
insert into set (session_entry_id, load_type, load_value, reps) values (9,'body',5,1);
\echo 'Expect 0 0 0 for user 2, then a foreign-key error:'
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select (select count(*) from session) sessions, (select count(*) from set) sets, (select count(*) from previous_reps(3)) prev;
insert into set (session_entry_id, load_type, reps) values (9,'body',1);
