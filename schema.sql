-- Create tables for the attendance system
-- NOTE: This assumes a 'user' table already exists in the public schema.

-- 1. Courses Table
create table if not exists public.courses (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  code text not null,
  lecturer_id text not null references public.user(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Unique index on course code removed to allow multiple lecturers to teach the same subject
-- create unique index if not exists courses_code_idx on public.courses (code);

-- 2. Attendance Sessions Table
create table if not exists public.attendance_sessions (
  id uuid default gen_random_uuid() primary key,
  course_id uuid not null references public.courses(id) on delete cascade,
  lecturer_id text not null references public.user(id) on delete cascade,
  week integer not null,
  date date not null,
  time time not null,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Unique index to prevent duplicate sessions for same course/week/date
create unique index if not exists attendance_sessions_unique_idx on public.attendance_sessions (course_id, week, date);

-- 3. Attendance Records Table
create table if not exists public.attendance_records (
  id uuid default gen_random_uuid() primary key,
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id text not null references public.user(id) on delete cascade,
  status text not null check (status in ('present', 'absent')),
  scan_time timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Unique index to prevent duplicate attendance records
create unique index if not exists attendance_records_unique_idx on public.attendance_records (session_id, student_id);

-- Enable Row Level Security (RLS)
alter table public.courses enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;

-- Policies

-- Courses: 
-- Lecturers can view and create their own courses
create policy "Lecturers can view their own courses"
on public.courses for select
to authenticated
using ( auth.uid()::text = lecturer_id );

create policy "Lecturers can insert their own courses"
on public.courses for insert
to authenticated
with check ( auth.uid()::text = lecturer_id );

-- Students can view courses they are enrolled in? (For now, let's allow students to view all courses or restrict if needed. 
-- Assuming for now simple visibility for simplicity or we can add Enrollment logic later.
-- For this MVP, maybe students don't need to see courses list directly, but let's allow read for now if we want dynamic course selection)

-- Attendance Sessions:
-- Lecturers can manage their own sessions
create policy "Lecturers can view their own sessions"
on public.attendance_sessions for select
to authenticated
using ( auth.uid()::text = lecturer_id );

create policy "Lecturers can insert their own sessions"
on public.attendance_sessions for insert
to authenticated
with check ( auth.uid()::text = lecturer_id );

-- Attendance Records:
-- Students can view their own attendance
create policy "Students can view their own attendance"
on public.attendance_records for select
to authenticated
using ( auth.uid()::text = student_id );

-- Students can (potentially) insert their own attendance via scanning? 
-- Or is it the lecturer's device that inserts?
-- "MOCK success logic in scan.tsx" implies the Lecturer app creates the record after scanning Student QR.
-- So Lecturers should be able to insert attendance records for ANY student in THEIR session.

create policy "Lecturers can view records for their sessions"
on public.attendance_records for select
to authenticated
using (
  exists (
    select 1 from public.attendance_sessions s
    where s.id = session_id
    and s.lecturer_id = auth.uid()::text
  )
);

create policy "Lecturers can insert records for their sessions"
on public.attendance_records for insert
to authenticated
with check (
  exists (
    select 1 from public.attendance_sessions s
    where s.id = session_id
    and s.lecturer_id = auth.uid()::text
  )
);
