-- Drop the incorrect foreign key constraint
ALTER TABLE public.attendance_records
DROP CONSTRAINT IF EXISTS attendance_records_student_id_user_student_id_fk;

-- Add the correct foreign key constraint referencing user(id)
-- Using ALTER TABLE to ensure correct syntax and constraint naming
ALTER TABLE public.attendance_records
ADD CONSTRAINT attendance_records_student_id_user_id_fk
FOREIGN KEY (student_id)
REFERENCES public."user"(id)
ON DELETE CASCADE;

-- Optional: Create index for better performance on student_id lookups
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_id 
ON public.attendance_records(student_id);
