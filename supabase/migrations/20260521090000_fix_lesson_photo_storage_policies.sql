insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-photos',
  'lesson-photos',
  true,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Allow public lesson photo reads" on storage.objects;
drop policy if exists "Allow public lesson photo uploads" on storage.objects;
drop policy if exists "Allow lesson photo reads" on storage.objects;
drop policy if exists "Allow lesson photo uploads" on storage.objects;

create policy "Allow lesson photo reads"
  on storage.objects
  for select
  to public
  using (bucket_id = 'lesson-photos');

create policy "Allow lesson photo uploads"
  on storage.objects
  for insert
  to public
  with check (bucket_id = 'lesson-photos');
