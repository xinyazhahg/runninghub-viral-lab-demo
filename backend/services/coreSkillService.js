const fs = require('fs');
const path = require('path');
const { createLogger } = require('../lib/logger');
const { appError, normalizeError } = require('../lib/errorCodes');

const SKILL_FILES = {
  video_understanding: 'video-understanding.skill.json',
  prompt_generation: 'prompt-generation.skill.json',
  video_generation: 'video-generation.skill.json',
};

function loadContracts(skillDirectory = path.join(__dirname, '..', 'skills')) {
  return Object.fromEntries(Object.entries(SKILL_FILES).map(([name, filename]) => {
    const contract = JSON.parse(fs.readFileSync(path.join(skillDirectory, filename), 'utf8'));
    if (contract.name !== name) throw new Error(`Skill名称不匹配：${filename}`);
    return [name, Object.freeze(contract)];
  }));
}

function validateRequired(schema, value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw appError('TASK_STATE_INVALID', `${label}必须是对象`);
  for (const key of schema?.required || []) {
    if (value[key] === undefined || value[key] === null || value[key] === '') throw appError('TASK_STATE_INVALID', `${label}缺少字段：${key}`);
  }
}

function validateOutput(schema, output) {
  if (schema?.type === 'string' && typeof output !== 'string') throw appError('MODEL_RESULT_INVALID', 'Skill输出不是预期字符串');
  if (schema?.type === 'object') validateRequired(schema, output, 'Skill输出');
}

function createCoreSkillService({ contracts = loadContracts(), logger = createLogger() } = {}) {
  function getContract(name) {
    const contract = contracts[name];
    if (!contract) throw appError('TASK_STATE_INVALID', `未知Skill：${name}`);
    return contract;
  }

  async function execute(name, input, context = {}, handler) {
    const contract = getContract(name);
    if (typeof handler !== 'function') throw appError('INTERNAL_ERROR', `${name}缺少实现处理器`);
    validateRequired(contract.input_schema, input, 'Skill输入');
    const started = Date.now();
    logger.info({ ...context, skillName: name, action: 'skill.execute', status: 'started', modelName: contract.model, metadata: { provider: contract.provider } });
    try {
      const output = await handler(input, context);
      validateOutput(contract.output_schema, output);
      logger.info({ ...context, skillName: name, action: 'skill.execute', durationMs: Date.now() - started, status: 'success', modelName: contract.model });
      return output;
    } catch (error) {
      const normalized = normalizeError(error, name === 'prompt_generation' ? 'INTERNAL_ERROR' : 'MODEL_REQUEST_FAILED');
      logger.error({ ...context, skillName: name, action: 'skill.execute', durationMs: Date.now() - started, status: 'failed', modelName: contract.model, errorCode: normalized.code, errorMessage: normalized.message });
      throw normalized;
    }
  }

  return { execute, getContract, listContracts: () => Object.values(contracts) };
}

module.exports = { createCoreSkillService, loadContracts, validateRequired, validateOutput, SKILL_FILES };
