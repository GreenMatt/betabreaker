-- Create buckets manually in Dashboard or CLI:
--   profile-photos (public)
--   climb-photos (public)

-- Storage policies for profile-photos
drop policy if exists "public read profile photos" on storage.objects;
create policy "public read profile photos"
on storage.objects for select
using ( bucket_id = 'profile-photos' );

drop policy if exists "user write own profile photos" on storage.objects;
create policy "user write own profile photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-photos' and (auth.uid()::text || '/') = substring(name from 1 for length(auth.uid()::text)+1)
);

-- Storage policies for climb-photos
drop policy if exists "public read climb photos" on storage.objects;
create policy "public read climb photos"
on storage.objects for select
using ( bucket_id = 'climb-photos' );

drop policy if exists "auth upload climb photos" on storage.objects;
create policy "auth upload climb photos"
on storage.objects for insert to authenticated
with check ( bucket_id = 'climb-photos' );
