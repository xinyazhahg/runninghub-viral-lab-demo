create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft' check (status in ('draft','analyzing','customizing','completed','error')),
  original_asset_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  asset_type text not null check (asset_type in ('original_video','replacement_image')),
  replacement_type text null check (replacement_type in ('subject','scene','element')),
  original_filename text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0),
  storage_path text not null unique,
  public_url text null,
  status text not null default 'active' check (status in ('active','deleted','failed')),
  created_at timestamptz not null default now(),
  constraint replacement_type_matches_asset check (
    (asset_type = 'original_video' and replacement_type is null)
    or (asset_type = 'replacement_image' and replacement_type is not null)
  )
);

alter table public.projects add constraint projects_original_asset_fk
  foreign key (original_asset_id) references public.assets(id) on delete set null;
create index if not exists assets_project_id_idx on public.assets(project_id);
create index if not exists assets_project_type_idx on public.assets(project_id, asset_type);
alter table public.projects enable row level security;
alter table public.assets enable row level security;
-- First round is backend-only. Service role bypasses RLS; no anonymous table policy is added.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'viral-lab-assets', 'viral-lab-assets', true, 524288000,
  array['video/mp4','video/quicktime','video/webm','image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
