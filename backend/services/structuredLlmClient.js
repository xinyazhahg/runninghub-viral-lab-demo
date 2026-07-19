const { appError } = require('../lib/errorCodes');

const DEFAULT_LLM_BASE_URL = 'https://llm.runninghub.cn/v1';

function createStructuredLlmClient({ fetchImpl = fetch } = {}) {
  async function complete({ model, systemPrompt, input, timeoutMs = 120000 }) {
    const apiKey = process.env.RUNNINGHUB_API_KEY;
    if (!apiKey) throw appError('MODEL_UNAVAILABLE', '未配置 RUNNINGHUB_API_KEY');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const baseUrl = String(process.env.RUNNINGHUB_LLM_BASE_URL || DEFAULT_LLM_BASE_URL).replace(/\/$/, '');
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, temperature: 0.2, max_tokens: 12000,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(input) },
          ],
        }),
      });
      const rawText = await response.text();
      let body;
      try { body = rawText ? JSON.parse(rawText) : {}; } catch { body = {}; }
      if (!response.ok) {
        const error = appError(response.status === 429 ? 'MODEL_RATE_LIMITED' : 'MODEL_REQUEST_FAILED', body?.error?.message || body?.message || `LLM HTTP ${response.status}`, { retryable: response.status === 429 || response.status >= 500 });
        error.status = response.status;
        throw error;
      }
      const content = body?.choices?.[0]?.message?.content;
      if (!content) throw appError('MODEL_RESULT_INVALID', 'LLM 未返回 choices[0].message.content', { retryable: true });
      return { content, model: body?.model || model, usage: body?.usage || {} };
    } catch (error) {
      if (error?.name === 'AbortError') throw appError('TASK_TIMEOUT', 'LLM 调用超时', { retryable: true });
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  return { complete };
}

module.exports = { createStructuredLlmClient, DEFAULT_LLM_BASE_URL };
