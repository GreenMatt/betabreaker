-- Performance indexes to speed typical queries
create index if not exists idx_climb_photos_climb_created on public.climb_photos(climb_id, created_at);

