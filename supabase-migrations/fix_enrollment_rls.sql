-- ============================================================
-- COMPREHENSIVE FIX: Enrollment, RLS, Trigger, and Policies
-- Safe to re-run (idempotent). Does NOT delete any data.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- ============================================================
-- 0. FIX: attendance_records INSERT policy (THIS FIXES THE 42501 ERROR)
--    Drop + recreate to ensure it exists and is correct
-- ============================================================
DROP POLICY IF EXISTS "Lecturers can insert records for their sessions" ON public.attendance_records;
CREATE POLICY "Lecturers can insert records for their sessions"
ON public.attendance_records FOR INSERT
TO authenticated
WITH CHECK (
  exists (
    select 1 from public.attendance_sessions s
    where s.id = session_id
    and s.lecturer_id = auth.uid()::text
  )
);

-- Also ensure SELECT and UPDATE policies exist
DROP POLICY IF EXISTS "Lecturers can view records for their sessions" ON public.attendance_records;
CREATE POLICY "Lecturers can view records for their sessions"
ON public.attendance_records FOR SELECT
TO authenticated
USING (
  exists (
    select 1 from public.attendance_sessions s
    where s.id = session_id
    and s.lecturer_id = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "Students can view their own attendance" ON public.attendance_records;
CREATE POLICY "Students can view their own attendance"
ON public.attendance_records FOR SELECT
TO authenticated
USING ( auth.uid()::text = student_id );

DROP POLICY IF EXISTS "Lecturers can update records for their sessions" ON public.attendance_records;
CREATE POLICY "Lecturers can update records for their sessions"
ON public.attendance_records FOR UPDATE
TO authenticated
USING (
  exists (
    select 1 from public.attendance_sessions s
    where s.id = session_id
    and s.lecturer_id = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "Lecturers can delete records for their sessions" ON public.attendance_records;
CREATE POLICY "Lecturers can delete records for their sessions"
ON public.attendance_records FOR DELETE
TO authenticated
USING (
  exists (
    select 1 from public.attendance_sessions s
    where s.id = session_id
    and s.lecturer_id = auth.uid()::text
  )
);

-- ============================================================
-- 1. Ensure course_enrollments table exists
-- ============================================================
CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id uuid default gen_random_uuid() primary key,
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id text not null references public."user"(id) on delete cascade,
  enrolled_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE UNIQUE INDEX IF NOT EXISTS course_enrollments_unique_idx
  ON public.course_enrollments (course_id, student_id);

ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. RLS Policies for course_enrollments (drop + recreate for idempotency)
-- ============================================================

-- Lecturers can do everything on enrollments for their courses
DROP POLICY IF EXISTS "Lecturers can view enrollments for their courses" ON public.course_enrollments;
DROP POLICY IF EXISTS "Lecturers can manage enrollments for their courses" ON public.course_enrollments;
CREATE POLICY "Lecturers can manage enrollments for their courses"
ON public.course_enrollments FOR ALL
TO authenticated
USING (
  exists (
    select 1 from public.courses c
    where c.id = course_id
    and c.lecturer_id = auth.uid()::text
  )
)
WITH CHECK (
  exists (
    select 1 from public.courses c
    where c.id = course_id
    and c.lecturer_id = auth.uid()::text
  )
);

-- Students can view their own enrollments
DROP POLICY IF EXISTS "Students can view their own enrollments" ON public.course_enrollments;
CREATE POLICY "Students can view their own enrollments"
ON public.course_enrollments FOR SELECT
TO authenticated
USING ( auth.uid()::text = student_id );

-- ============================================================
-- 3. Auto-enrollment trigger (SECURITY DEFINER bypasses RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_enroll_student_on_scan()
RETURNS trigger AS $$
DECLARE
  v_course_id uuid;
BEGIN
  -- Get the course_id for this session
  SELECT course_id INTO v_course_id
  FROM public.attendance_sessions
  WHERE id = NEW.session_id;
  
  -- Insert into course_enrollments if not already enrolled
  IF v_course_id IS NOT NULL THEN
    INSERT INTO public.course_enrollments (course_id, student_id)
    VALUES (v_course_id, NEW.student_id)
    ON CONFLICT (course_id, student_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_enroll_student ON public.attendance_records;
CREATE TRIGGER trigger_auto_enroll_student
AFTER INSERT ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.auto_enroll_student_on_scan();

-- ============================================================
-- 4. Fix absent_student_details view (uses course_enrollments)
-- ============================================================
DROP VIEW IF EXISTS public.absent_student_details CASCADE;
CREATE OR REPLACE VIEW public.absent_student_details AS
SELECT 
  s.id as session_id,
  u.id as student_id,
  u.name as student_name,
  u.student_id as student_matric,
  u.email as student_email
FROM public.attendance_sessions s
JOIN public.course_enrollments ce ON s.course_id = ce.course_id
JOIN public."user" u ON ce.student_id = u.id
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.attendance_records ar 
  WHERE ar.session_id = s.id 
  AND ar.student_id = u.id
);

GRANT SELECT ON public.absent_student_details TO authenticated;

-- ============================================================
-- 5. Backfill enrollments from existing attendance records
--    (enrolls any students who already scanned but weren't enrolled)
-- ============================================================
INSERT INTO public.course_enrollments (course_id, student_id)
SELECT DISTINCT asess.course_id, ar.student_id
FROM public.attendance_records ar
JOIN public.attendance_sessions asess ON ar.session_id = asess.id
ON CONFLICT (course_id, student_id) DO NOTHING;

-- Done! All fixes applied.