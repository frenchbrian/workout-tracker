\set ON_ERROR_STOP 1
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into exercise (name, pushup_name) values ('Bench Press (Wide)', 'Wide Pushup');
insert into exercise (name) values ('Seated Lat Row');
insert into workout (name) values ('Chest n Back');
insert into workout_entry (workout_id, exercise_id, sort_order) values (1,1,1),(1,2,2),(1,2,3);
-- S1 (Sep 1): press form, both rounds
insert into session (workout_id, performed_on) values (1,'2026-09-01');
insert into session_entry (session_id, workout_entry_id, exercise_id, sort_order, form) values (1,1,1,1,'press'),(1,2,2,2,null),(1,3,2,3,null);
insert into set (session_entry_id, round, load_type, load_value, position, reps) values
 (1,1,'machine',6,4,10),(1,2,'machine',6,4,8),(2,1,'bands',230,null,11),(2,2,'bands',230,null,9),(3,1,'bands',230,null,12);
-- S2 (Sep 8): pushup form, round 1 only
insert into session (workout_id, performed_on) values (1,'2026-09-08');
insert into session_entry (session_id, workout_entry_id, exercise_id, sort_order, form) values (2,1,1,1,'pushup'),(2,2,2,2,null),(2,3,2,3,null);
insert into set (session_entry_id, round, load_type, load_value, reps) values (4,1,'body',null,20),(5,1,'bands',230,13),(6,1,'bands',230,14);
-- S3 (Sep 15): press again, entries reordered (lat rows first)
insert into session (workout_id, performed_on) values (1,'2026-09-15');
insert into session_entry (session_id, workout_entry_id, exercise_id, sort_order, form) values (3,1,1,3,'press'),(3,2,2,1,null),(3,3,2,2,null);
\echo 'Expect press R1=10, R2=8 (from 9/1, skipping pushup 9/8); lat row entry2 R1=13 (9/8) R2=9 (9/1); entry3 R1=14, R2 none'
select se.workout_entry_id, pr.round, pr.reps, pr.performed_on from previous_reps(3) pr join session_entry se on se.id=pr.session_entry_id order by 1,2;
\echo 'Pushup form in S3 instead should give R1=20'
update session_entry set form='pushup' where id=7;
select pr.round, pr.reps, pr.performed_on from previous_reps(3) pr where session_entry_id=7;
\echo 'Last used:'
select * from exercise_last_used;
\echo 'Constraint: body with value should fail'
\set ON_ERROR_STOP 0
insert into set (session_entry_id, round, load_type, load_value, reps) values (8,1,'body',5,1);
\echo 'RLS: user 2 sees'
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select (select count(*) from session) sessions, (select count(*) from set) sets, (select count(*) from previous_reps(3)) prev;
insert into set (session_entry_id, round, load_type, reps) values (8,1,'body',1);
