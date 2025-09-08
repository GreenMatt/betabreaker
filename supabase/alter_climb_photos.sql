-- Make climb_photos capable of storing inline image
alter table public.climb_photos alter column url drop not null;
alter table public.climb_photos add column if not exists image_base64 text;

