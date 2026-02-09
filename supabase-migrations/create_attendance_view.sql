-- Create a view for easier reading of attendance records
create or replace view public.attendance_details as
select 
  ar.id as record_id,
  ar.status,
  ar.scan_time,
  u.name as student_name,
  u.student_id as student_matric,
  u.email as student_email,
  c.name as course_name,
  c.code as course_code,
  asess.week,
  asess.date as session_date,
  asess.time as session_time
from public.attendance_records ar
join public."user" u on ar.student_id = u.id
join public.attendance_sessions asess on ar.session_id = asess.id
join public.courses c on asess.course_id = c.id;

-- Grant access to authenticated users
grant select on public.attendance_details to authenticated;
