-- Check if the user exists in public.user
select * from public."user" limit 5;

-- Check if the specific user from the error log exists
-- Replace '55de8dce-9974-41cd-8a4b-0519d7fd25f8' with the ID from your logs if different
select * from public."user" where id = '55de8dce-9974-41cd-8a4b-0519d7fd25f8';

-- Check constraints on attendance_records
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.attendance_records'::regclass;
