const { getSupabaseClient } = require('../lib/supabase');
const { DEFAULT_MODEL_CONFIG, isMissingModelConfigTable } = require('../config/defaultModelConfig');
const GENERATION_MODEL_ID = 'seedance-2.0';

function createPromptModelService({ client = getSupabaseClient() } = {}) {
  async function listActiveModels() {
    const { data, error } = await client.from('model_configs').select('*')
      .eq('status', 'active').eq('model_id', GENERATION_MODEL_ID).order('priority', { ascending: true });
    if (error) {
      if (isMissingModelConfigTable(error)) return [{ ...DEFAULT_MODEL_CONFIG }];
      throw error;
    }
    return data || [];
  }

  async function getActiveModel(modelId) {
    if (modelId !== GENERATION_MODEL_ID) return null;
    const { data, error } = await client.from('model_configs').select('*')
      .eq('model_id', modelId).eq('status', 'active').maybeSingle();
    if (error) {
      if (isMissingModelConfigTable(error) && modelId === DEFAULT_MODEL_CONFIG.model_id) return { ...DEFAULT_MODEL_CONFIG };
      throw error;
    }
    return data;
  }

  async function getActiveTemplate(type) {
    const { data, error } = await client.from('prompt_templates').select('*')
      .eq('type', type).eq('status', 'active').order('version', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function getLatestProjectPrompt(projectId, userId) {
    let query = client.from('prompt_versions').select('*').eq('project_id', projectId);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query.order('version', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function listProjectPrompts(projectId, userId) {
    let query = client.from('prompt_versions').select('*').eq('project_id', projectId);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query.order('version', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function getPromptByResult(resultId, userId) {
    let query = client.from('prompt_versions').select('*').eq('result_id', resultId);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  }

  return { listActiveModels, getActiveModel, getActiveTemplate, getLatestProjectPrompt, listProjectPrompts, getPromptByResult };
}

module.exports = { createPromptModelService };
