import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const componentSource = fs.readFileSync(path.join(dirname, '..', 'src', 'components', 'ReplaceRail.vue'), 'utf8')
const appSource = fs.readFileSync(path.join(dirname, '..', 'src', 'App.vue'), 'utf8')

test('替换素材上传成功后先结束上传态，再关闭弹窗并同步替换状态', () => {
  const successBlock = componentSource.slice(
    componentSource.indexOf('const completedItemId = item.id'),
    componentSource.indexOf('} catch (error)')
  )
  assert.ok(successBlock.indexOf('isAssetUploading.value = false') < successBlock.indexOf('closeAssetModal()'))
  assert.ok(successBlock.indexOf('closeAssetModal()') < successBlock.indexOf("emit('replace', completedItemId)"))
  assert.match(componentSource, /item\.current = fileName[\s\S]*item\.replacement = fileName[\s\S]*item\.changed = true/)
});

test('上传失败保留弹窗内错误并恢复旧替换状态，不使用阻塞 alert', () => {
  const catchBlock = componentSource.slice(
    componentSource.indexOf('} catch (error)'),
    componentSource.indexOf('} finally')
  )
  assert.match(catchBlock, /Object\.assign\(item, previous\)/)
  assert.match(catchBlock, /assetUploadError\.value = `素材上传失败/)
  assert.match(catchBlock, /assetModalSubtitle\.value = assetUploadError\.value/)
  assert.doesNotMatch(catchBlock, /alert\(/)
});

test('成功替换会即时清除缺图与旧上传错误并重新计算费用', () => {
  const handler = appSource.slice(appSource.indexOf('function handleReplace'), appSource.indexOf('function openBreakdown'))
  assert.match(handler, /clearReplacementImageError\(\)/)
  assert.doesNotMatch(handler, /validateReplacementImages\(\{ showWhenMissing: true \}\)/)
  assert.match(handler, /refreshEstimatedPrice\(\)/)
  assert.match(appSource, /REPLACEMENT_IMAGE_ERROR_PATTERN[\s\S]*素材上传失败/)
});

test('替换素材缺失提示只在点击生成 Prompt 时触发', () => {
  const promptHandler = appSource.slice(
    appSource.indexOf('async function handleGeneratePrompt'),
    appSource.indexOf('function handlePromptDraftInput')
  )
  assert.match(promptHandler, /validateReplacementImages\(\{ showWhenMissing: true \}\)/)

  const watcher = appSource.slice(
    appSource.indexOf('() => validReplacementImages.value.map'),
    appSource.indexOf('function userFacingWorkspaceError')
  )
  assert.doesNotMatch(watcher, /showWhenMissing: true/)

  const restoreHandler = appSource.slice(
    appSource.indexOf('async function restoreProjectState'),
    appSource.indexOf('function clearDemoState')
  )
  assert.doesNotMatch(restoreHandler, /showWhenMissing: true/)
})
