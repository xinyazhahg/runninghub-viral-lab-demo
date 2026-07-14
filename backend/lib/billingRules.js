function numeric(value, fallback = 0) {
  const normalized = String(value ?? '').replace(/[^0-9.-]/g, '');
  if (!normalized || normalized === '-' || normalized === '.') return fallback;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : fallback;
}

function ceilCredits(value) {
  return Math.ceil((Math.max(0, Number(value) || 0) - 1e-9) * 100) / 100;
}

function calculateCreditCost({ costRule = {}, providerCost = 0, duration, resolution, aspectRatio, extraParams = {} }) {
  if (costRule.enabled === false) throw new Error('当前模型计费规则未启用');
  const seconds = numeric(duration);
  const base = numeric(costRule.base_credits);
  const perSecond = numeric(costRule.per_second_credits) * seconds;
  const providerCredits = numeric(providerCost) * numeric(costRule.provider_to_credit_rate);
  const resolutionFactor = numeric(costRule.resolution_coefficients?.[String(resolution).toLowerCase()], 1);
  const durationFactor = numeric(costRule.duration_coefficients?.[String(duration)], 1);
  const ratioFactor = numeric(costRule.ratio_coefficients?.[String(aspectRatio)], 1);
  const saleFactor = numeric(costRule.sale_factor, 1);
  const extraFactor = numeric(extraParams.cost_factor, 1);
  return ceilCredits((base + perSecond + providerCredits) * resolutionFactor * durationFactor * ratioFactor * saleFactor * extraFactor);
}

function failureChargeRatio({ externalTaskId, costRule = {}, defaultRatio = 0.2 }) {
  if (!externalTaskId) return 0;
  return Math.max(0, Math.min(1, numeric(costRule.failure_charge_ratio, defaultRatio)));
}

module.exports = { calculateCreditCost, failureChargeRatio, numeric, ceilCredits };
