<script setup>
import { computed } from 'vue'
import { formatGenerationSpecs } from '../generationPresentation.js'
import FlowNodeHeader from './FlowNodeHeader.vue'

const props = defineProps({
  version: { type: Object, required: true },
  index: { type: Number, default: 0 },
  isExporting: { type: Boolean, default: false },
  isRevising: { type: Boolean, default: false },
  isRefreshingVideo: { type: Boolean, default: false },
  videoError: { type: String, default: '' },
})

const emit = defineEmits(['export', 'save', 'revise', 'video-error', 'video-ready', 'retry-video', 'play'])

const isGenerating = computed(() => props.version.isGenerating)
const isSaved = computed(() => !!props.version.saved)

const summaryLines = computed(() => {
  return [
    ...(props.version.summary || []),
    ...(props.version.adjustmentText ? [`补充生成要求：${props.version.adjustmentText}`] : []),
  ]
})

const specsText = computed(() => formatGenerationSpecs(props.version))

const videoUrl = computed(() => props.version.videoUrl || '')
</script>

<template>
  <article
    :class="['result-card', 'flow-node', { 'is-generating': isGenerating }]"
    :data-version="version.id"
    :data-node-key="`result-${version.id}`"
  >
    <FlowNodeHeader step="04" title="视频结果" />

    <!-- 视频预览区 -->
    <div class="result-video">
      <!-- 生成中 -->
      <div v-if="isGenerating" class="generating-visual">
        <div class="generating-orb"></div>
        <div class="generating-ring"></div>
        <p>正在生成视频</p>
        <span>预计需要 1-3 分钟，请勿关闭页面</span>
      </div>

      <!-- 真实视频 -->
      <video
        v-else-if="videoUrl"
        class="result-video-player"
        :src="videoUrl"
        controls
        playsinline
        preload="metadata"
        @pointerdown.stop
        @click.stop
        @canplay="emit('video-ready', version)"
        @play="emit('play', version)"
        @error="emit('video-error', version)"
      ></video>

      <div v-if="isRefreshingVideo" class="result-video-refresh">正在刷新视频地址…</div>

      <div v-else-if="videoError" class="result-video-refresh result-video-error" role="alert">
        <span>{{ videoError }}</span>
        <button type="button" @click.stop="emit('retry-video', version)">重新加载视频</button>
      </div>

      <!-- 无视频（兜底封面） -->
      <img
        v-if="!isGenerating && !videoUrl"
        :src="version.coverUrl || ''"
        alt=""
        loading="lazy"
      />

      <!-- 版本徽章 -->
      <span v-if="!isGenerating" class="result-badge">{{ version.id }}</span>
    </div>

    <!-- 结果信息 -->
    <div class="result-info">
      <!-- 参数信息 -->
      <div class="result-meta">
        <span class="result-param-pill">
          <strong>{{ specsText }}</strong>
        </span>
      </div>

      <!-- 本次改造内容 -->
      <div>
        <h3>本次改造内容</h3>
        <ul>
          <li v-for="(line, i) in summaryLines" :key="i">{{ line }}</li>
          <li v-if="summaryLines.length === 0">其他内容：保持原视频</li>
        </ul>
      </div>

      <details class="result-prompt-details">
        <summary>查看本次创作指令</summary>
        <pre>{{ version.prompt || '暂无创作指令记录' }}</pre>
      </details>
      <!-- 操作按钮 -->
      <div v-if="!isGenerating" class="result-actions">
        <button class="ghost-button" :disabled="isExporting" @click="emit('export')">
          {{ isExporting ? '正在导出...' : '导出视频' }}
        </button>
        <button
          :class="['ghost-button', { 'is-saved': isSaved }]"
          :disabled="isSaved"
          @click="emit('save')"
        >
          {{ isSaved ? '已保存' : '保存至资产库' }}
        </button>
       <button class="ghost-button revise-button" :disabled="isRevising" @click="$emit('revise', version)">
         {{ isRevising ? '正在打开…' : '重新改造' }}
       </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.result-card {
  display: grid;
  position: relative;
  z-index: 4;
  align-content: start;
  gap: 11px;
  width: 860px;
  min-height: 0;
  max-height: none;
  padding: 22px;
  overflow: visible;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(18, 19, 20, 0.94);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.44);
}

/* ── 视频预览区 ── */
.result-video {
  position: relative;
  display: grid;
  place-items: center;
  width: 360px;
  height: 560px;
  justify-self: center;
  flex: 0 0 auto;
  border-radius: 18px;
  overflow: hidden;
  background: linear-gradient(145deg, #1c2923, #536451 45%, #111);
}

.result-video img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.result-video-player {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
  display: block;
  background: #000;
}
.result-video-refresh {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  place-items: center;
  color: #dfe9e4;
  background: rgba(5, 6, 6, .76);
  font-size: 13px;
}
.result-video-error {
  gap: 12px;
  padding: 24px;
  text-align: center;
}
.result-video-error button {
  min-height: 34px;
  padding: 7px 14px;
  border: 1px solid rgba(53, 245, 154, .42);
  border-radius: 9px;
  color: #dfffea;
  background: rgba(20, 52, 38, .88);
  cursor: pointer;
}

.result-badge {
  position: absolute;
  z-index: 4;
  top: 9px;
  right: 9px;
  padding: 4px 8px;
  border: 1px solid rgba(53, 245, 154, 0.2);
  border-radius: 999px;
  color: #baffd6;
  background: rgba(7, 10, 9, 0.68);
  font-size: 11px;
  font-weight: 900;
  box-shadow: 0 0 16px rgba(53, 245, 154, 0.1);
}

/* ── 生成中动画 ── */
.generating-visual {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-radius: inherit;
  background:
    radial-gradient(circle at center, rgba(53, 245, 154, 0.16), transparent 42%),
    rgba(5, 10, 9, 0.86);
  overflow: hidden;
}

.generating-orb {
  width: 46px;
  height: 46px;
  border-radius: 999px;
  background: rgba(53, 245, 154, 0.92);
  box-shadow:
    0 0 24px rgba(53, 245, 154, 0.6),
    0 0 56px rgba(53, 245, 154, 0.28);
  animation: generatingPulse 1.6s ease-in-out infinite;
}

.generating-ring {
  position: absolute;
  width: 96px;
  height: 96px;
  border-radius: 999px;
  border: 1px solid rgba(53, 245, 154, 0.34);
  animation: generatingRing 1.8s ease-out infinite;
}

.generating-visual p {
  margin: 10px 0 0;
  color: #fff;
  font-size: 15px;
  font-weight: 800;
}

.generating-visual span {
  color: rgba(255, 255, 255, 0.54);
  font-size: 12px;
}

@keyframes generatingPulse {
  0%, 100% {
    transform: scale(0.92);
    opacity: 0.72;
  }
  50% {
    transform: scale(1.08);
    opacity: 1;
  }
}

@keyframes generatingRing {
  0% {
    transform: scale(0.72);
    opacity: 0.72;
  }
  100% {
    transform: scale(1.28);
    opacity: 0;
  }
}

/* ── 结果信息 ── */
.result-info {
  display: grid;
  align-content: start;
  gap: 0;
  width: 100%;
  max-height: none;
  overflow: auto;
  opacity: 1;
  pointer-events: auto;
  min-width: 360px;
}

.result-info > :not(.result-actions) {
  max-height: none;
  margin-top: 10px;
  opacity: 1;
  pointer-events: auto;
  overflow: visible;
}

.result-info-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.result-info-head strong {
  margin: 0;
  color: #f2fff8;
  font-size: 18px;
}

.node-caption {
  color: #bfc2c8;
  font-size: 12px;
  font-weight: 700;
}

.result-info p {
  margin: 0;
  color: #9ca2a8;
  font-size: 12px;
}

.result-info h3 {
  margin: 0 0 6px;
  color: #e5e9ec;
  font-size: 13px;
}

.result-info ul {
  margin: 0;
  padding-left: 18px;
}

.result-info li {
  color: #b5bbc0;
  font-size: 12px;
  line-height: 1.6;
}

.result-prompt-details {
  padding: 12px 14px;
  border: 1px solid rgba(53, 245, 154, 0.24);
  border-radius: 12px;
  background: rgba(7, 9, 10, 0.68);
}
.result-prompt-details summary { cursor: pointer; color: #dce6e1; font-size: 12px; font-weight: 800; }
.result-prompt-details pre { max-height: 260px; margin: 12px 0 0; overflow: auto; white-space: pre-wrap; color: #aebbb5; font: inherit; font-size: 12px; line-height: 1.6; }
/* ── 参数 ── */
.result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  align-items: center;
  margin-top: 10px;
}

.result-param-pill {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(53, 245, 154, 0.14);
  border-radius: 999px;
  color: #aab2b5;
  background: rgba(8, 9, 10, 0.42);
  font-size: 11px;
  white-space: nowrap;
}

.result-param-pill strong {
  color: #baffd6;
  font-weight: 800;
}

/* ── 操作按钮 ── */
.result-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.result-actions button {
  min-height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  white-space: nowrap;
}

.ghost-button {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: #c6ced0;
  cursor: pointer;
}

.ghost-button:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.16);
}

.ghost-button.is-saved {
  border-color: rgba(53, 245, 154, 0.36);
  background: rgba(53, 245, 154, 0.08);
  color: #7dffb6;
  cursor: default;
}

.ghost-button:disabled {
  opacity: 0.7;
  cursor: default;
}

/* ── 生成中隐藏操作 ── */
.result-card.is-generating .result-actions {
  display: none;
}
</style>
