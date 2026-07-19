begin;

insert into public.model_configs (
  model_id, model_name, provider, endpoint, capability,
  supported_durations, supported_ratios, supported_resolutions,
  cost_rule, status, priority
) values (
  'seedance-2.0',
  'Seedance 2.0',
  'RunningHub',
  'rhart-video/sparkvideo-2.0/multimodal-video',
  '{"type":"multimodal_video","requires_reference_video":false,"requires_replacement_images":true,"generate_audio":true}'::jsonb,
  '["4","5","6","7","8","9","10","11","12","13","14","15"]'::jsonb,
  '["adaptive","16:9","4:3","1:1","3:4","9:16","21:9"]'::jsonb,
  '["480p","720p"]'::jsonb,
  '{"enabled":true,"pricing_mode":"reference_video_seconds","currency":"USD","rates":{"480p":0.06,"720p":0.12},"base_credits":0,"per_second_credits":0,"provider_to_credit_rate":10,"resolution_coefficients":{"480p":1,"720p":1},"duration_coefficients":{},"ratio_coefficients":{},"sale_factor":1,"failure_charge_ratio":0.2}'::jsonb,
  'active',
  20
)
on conflict (model_id) do update set
  model_name = excluded.model_name,
  provider = excluded.provider,
  endpoint = excluded.endpoint,
  capability = excluded.capability,
  supported_durations = excluded.supported_durations,
  supported_ratios = excluded.supported_ratios,
  supported_resolutions = excluded.supported_resolutions,
  cost_rule = excluded.cost_rule,
  status = excluded.status,
  priority = excluded.priority,
  updated_at = now();

commit;
