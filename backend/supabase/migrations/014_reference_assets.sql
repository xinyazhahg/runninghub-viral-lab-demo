begin;

alter table public.assets drop constraint if exists assets_asset_type_check;
alter table public.assets add constraint assets_asset_type_check check (
  asset_type in (
    'original_video', 'replacement_image', 'result_video',
    'reference_image', 'reference_audio', 'reference_video'
  )
);

alter table public.assets drop constraint if exists assets_replacement_type_check;
alter table public.assets add constraint assets_replacement_type_check check (
  (asset_type = 'replacement_image' and replacement_type is not null)
  or (asset_type <> 'replacement_image' and replacement_type is null)
);

create index if not exists assets_project_reference_type_idx
  on public.assets(project_id, asset_type, created_at)
  where asset_type in ('reference_image', 'reference_audio', 'reference_video');

commit;
