-- Position is the setting a machine's parts are moved to, so only Machine Loads have one.
-- The spreadsheet recorded positions on some body-weight pushups; clear them.

update set set position = null where load_type <> 'machine' and position is not null;

alter table set add constraint set_position_machine_only check (position is null or load_type = 'machine');
