-- Create missing profiles for existing auth users
-- Fix type mismatch by casting UUID to text
insert into public."user" (id, email, name, role)
select 
  id::text, 
  email, 
  coalesce(raw_user_meta_data->>'name', email) as name,
  'student' as role 
from auth.users
where id::text not in (select id from public."user")
on conflict (id) do nothing;
