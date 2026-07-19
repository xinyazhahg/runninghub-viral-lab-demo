const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const directorPrompt = fs.readFileSync(path.join(__dirname, '../prompts/directorAgentSystemPrompt.js'), 'utf8');
const generatorPrompt = fs.readFileSync(path.join(__dirname, '../prompts/seedancePromptGeneratorSystemPrompt.js'), 'utf8');

test('03 reference upload writes image, video or audio directly instead of semantic asset_type', () => {
  const route = server.match(/app\.post\("\/api\/projects\/:projectId\/assets\/reference"[\s\S]*?\n\}\);/)?.[0] || '';
  assert.match(route, /assetType,/);
  assert.match(route, /normalizePhysicalMimeType\(assetType/);
  assert.match(route, /purpose: normalizeReferencePurpose/);
  assert.match(route, /assetRef:/);
  assert.match(route, /targetPlaceholderId:/);
  assert.match(route, /confidence:/);
  assert.doesNotMatch(route, /assetType: `reference_/);
});

test('02 replacements and generated videos also use physical asset types', () => {
  assert.match(server, /assetType: "image",\s*\n\s*replacementType:/);
  assert.match(server, /assetType: "video", purpose: 'source_video'/);
  assert.match(server, /assetType: "video", purpose: 'generated_video'/);
});

test('Director and Prompt Generator consume authoritative purpose and target placeholder bindings', () => {
  assert.match(directorPrompt, /purpose 和 targetPlaceholderId/);
  assert.match(directorPrompt, /不得根据文件名重新猜测用途/);
  assert.match(generatorPrompt, /purpose 和 targetPlaceholderId/);
  assert.match(generatorPrompt, /主体形象严格参考@图片N/);
  assert.match(generatorPrompt, /全程保持毛色、脸型、服装、体型一致/);
});

test('参考素材上传将字符串状态码归一化并保留 415 类型错误', () => {
  assert.match(server, /const statusCode = Number\(error\.statusCode\) \|\| 500/);
  assert.match(server, /statusCode === 415 \? 'FILE_TYPE_NOT_SUPPORTED'/);
});
