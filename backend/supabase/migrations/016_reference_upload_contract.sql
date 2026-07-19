begin;

alter table public.assets add column if not exists purpose text;
alter table public.assets add column if not exists asset_ref text;
alter table public.assets add column if not exists target_placeholder_id text;
alter table public.assets add column if not exists confidence numeric;
alter table public.assets add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.assets drop constraint if exists assets_asset_type_check;
alter table public.assets drop constraint if exists replacement_type_matches_asset;
alter table public.assets drop constraint if exists assets_replacement_type_check;
alter table public.assets drop constraint if exists assets_purpose_check;
alter table public.assets drop constraint if exists assets_confidence_check;

update public.assets
set
  purpose = case
    when purpose in (
      'source_video', 'generated_video', 'character_reference', 'scene_reference',
      'prop_reference', 'style_reference', 'action_reference', 'audio_reference', 'general_reference'
    ) then purpose
    when asset_type = 'original_video' then 'source_video'
    when asset_type = 'result_video' then 'generated_video'
    when asset_type = 'replacement_image' and replacement_type = 'subject' then 'character_reference'
    when asset_type = 'replacement_image' and replacement_type = 'scene' then 'scene_reference'
    when asset_type = 'replacement_image' and replacement_type = 'element' then 'prop_reference'
    when asset_type = 'reference_video' then 'action_reference'
    when asset_type = 'reference_audio' then 'audio_reference'
    else 'general_reference'
  end,
  asset_type = case
    when asset_type in ('original_video', 'result_video', 'reference_video') then 'video'
    when asset_type in ('replacement_image', 'reference_image') then 'image'
    when asset_type = 'reference_audio' then 'audio'
    else asset_type
  end;

alter table public.assets alter column purpose set default 'general_reference';
alter table public.assets alter column purpose set not null;
update public.assets set confidence = 1 where confidence is null and replacement_type is not null;
update public.assets set confidence = 0.5 where confidence is null;
alter table public.assets alter column confidence set default 0.5;

alter table public.assets add constraint assets_asset_type_check
  check (asset_type in ('image', 'video', 'audio'));

alter table public.assets add constraint assets_purpose_check check (
  purpose in (
    'source_video', 'generated_video', 'character_reference', 'scene_reference',
    'prop_reference', 'style_reference', 'action_reference', 'audio_reference', 'general_reference'
  )
);

alter table public.assets add constraint assets_replacement_type_check check (
  replacement_type is null
  or (asset_type = 'image' and replacement_type in ('subject', 'scene', 'element'))
);

alter table public.assets add constraint assets_confidence_check
  check (confidence is null or (confidence >= 0 and confidence <= 1));

drop index if exists public.result_assets_task_unique;
create unique index if not exists result_assets_task_unique
  on public.assets(source_task_id)
  where purpose = 'generated_video' and source_task_id is not null;

drop index if exists public.assets_project_reference_type_idx;
create index if not exists assets_project_reference_type_idx
  on public.assets(project_id, asset_type, created_at)
  where replacement_type is null
    and purpose in (
      'character_reference', 'scene_reference', 'prop_reference', 'style_reference',
      'action_reference', 'audio_reference', 'general_reference'
    );

-- MIME 白名单由后端的 image/*、video/*、audio/* 物理类型校验统一管理。
update storage.buckets
set allowed_mime_types = null
where id = 'viral-lab-assets';

notify pgrst, 'reload schema';

commit;
