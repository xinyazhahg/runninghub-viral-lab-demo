import test from 'node:test'
import assert from 'node:assert/strict'
import { detectReferenceFileType, referenceAcceptFor, validateReferenceFileType } from '../src/referenceFileTypes.js'

const file = (name, type) => ({ name, type })

test('03 三个入口使用各自独立的 accept 与物理类型', () => {
  assert.equal(referenceAcceptFor('image'), 'image/*')
  assert.equal(referenceAcceptFor('video'), 'video/*')
  assert.equal(referenceAcceptFor('audio'), 'audio/*')
})

test('常用图片、视频和音频 MIME 均能正确识别', () => {
  for (const item of [file('a.jpg', 'image/jpeg'), file('a.jpeg', 'image/jpeg'), file('a.png', 'image/png'), file('a.webp', 'image/webp')]) {
    assert.equal(detectReferenceFileType(item), 'image')
  }
  for (const item of [file('a.mp4', 'video/mp4'), file('a.mov', 'video/quicktime'), file('a.webm', 'video/webm')]) {
    assert.equal(detectReferenceFileType(item), 'video')
  }
  for (const item of [file('a.mp3', 'audio/mpeg'), file('a.wav', 'audio/wav')]) {
    assert.equal(detectReferenceFileType(item), 'audio')
  }
})

test('空 MIME 与通用二进制 MIME 按扩展名兜底识别', () => {
  assert.equal(detectReferenceFileType(file('a.png', '')), 'image')
  assert.equal(detectReferenceFileType(file('a.mp4', 'application/octet-stream')), 'video')
  assert.equal(detectReferenceFileType(file('a.wav', 'binary/octet-stream')), 'audio')
})

test('只有入口与实际文件类型不一致时拒绝', () => {
  assert.equal(validateReferenceFileType('image', file('a.jpg', 'image/jpeg')).ok, true)
  assert.equal(validateReferenceFileType('video', file('a.mp4', 'video/mp4')).ok, true)
  assert.equal(validateReferenceFileType('audio', file('a.mp3', 'audio/mpeg')).ok, true)
  assert.equal(validateReferenceFileType('image', file('a.mp4', 'video/mp4')).ok, false)
  assert.equal(validateReferenceFileType('video', file('a.wav', 'audio/wav')).ok, false)
  assert.equal(validateReferenceFileType('audio', file('a.png', 'image/png')).ok, false)
})
