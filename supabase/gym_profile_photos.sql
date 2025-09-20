-- Add profile_photo field to gyms table
ALTER TABLE public.gyms ADD COLUMN IF NOT EXISTS profile_photo text;