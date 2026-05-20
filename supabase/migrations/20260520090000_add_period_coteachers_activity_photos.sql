alter table public.lesson_records
  add column if not exists period_label text,
  add column if not exists co_teachers text[] not null default '{}',
  add column if not exists activity_photo_urls text[] not null default '{}',
  add column if not exists activity_photo_count integer not null default 0;

create index if not exists lesson_records_period_label_idx
  on public.lesson_records (period_label);

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

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow public lesson photo reads'
  ) then
    create policy "Allow public lesson photo reads"
      on storage.objects
      for select
      to anon
      using (bucket_id = 'lesson-photos');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow public lesson photo uploads'
  ) then
    create policy "Allow public lesson photo uploads"
      on storage.objects
      for insert
      to anon
      with check (bucket_id = 'lesson-photos');
  end if;
end $$;
