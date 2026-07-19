begin;

-- 仅停止可灵新任务，不删除配置和任何历史 Task、Result 或作品数据。
update public.model_configs
set status = 'inactive', updated_at = now()
where model_id like 'kling%';

update public.model_configs
set status = 'active', priority = 1, updated_at = now()
where model_id = 'seedance-2.0';

commit;
