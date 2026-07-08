<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  data: { type: Object, default: null },
  videoName: { type: String, default: '' },
  coverUrl: { type: String, default: '' },
  videoObjectUrl: { type: String, default: '' },
})

const emit = defineEmits(['close'])

const overview = computed(() => props.data?.overview || {})
const shots = computed(() => Array.isArray(props.data?.shots) ? props.data.shots : [])
const hasData = computed(() => shots.value.length > 0 || overview.value.referenceVideo)

function formatList(value) {
  if (Array.isArray(value) && value.length) return value.join('、')
  if (typeof value === 'string' && value.trim()) return value
  return '未识别'
}

function getShotStartSeconds(time = '') {
  const match = String(time).match(/(\d{1,2}):(\d{2})/)
  if (!match) return 0.8
  return Number(match[1]) * 60 + Number(match[2]) + 0.3
}

function elementsText(shot) {
  if (Array.isArray(shot.elements)) return shot.elements.join('、') || '未识别'
  return shot.elements || '未识别'
}
</script>

<template>
  <div v-if="visible" class="modal" @click.self="emit('close')">
    <div class="modal-card breakdown-card">
      <button class="close-modal" @click="emit('close')">×</button>
      <h2>视频拆解</h2>
      <p class="breakdown-subtitle">按镜头整理视频结构，帮助后续替换和生成更贴近参考效果。</p>

      <!-- 识别概览 -->
      <section v-if="hasData" class="breakdown-overview">
        <div>
          <span>参考视频</span>
          <strong>{{ overview.referenceVideo || videoName || '已上传参考视频' }}</strong>
        </div>
        <div>
          <span>总镜头</span>
          <strong>{{ overview.shotCount || shots.length || 0 }} 个</strong>
        </div>
        <div>
          <span>可替换主体</span>
          <strong>{{ formatList(overview.replaceableSubjects) }}</strong>
        </div>
        <div>
          <span>可替换场景</span>
          <strong>{{ formatList(overview.replaceableScenes) }}</strong>
        </div>
        <div>
          <span>可替换元素</span>
          <strong>{{ formatList(overview.replaceableElements) }}</strong>
        </div>
      </section>

      <!-- 镜头列表 -->
      <div v-if="hasData" class="shot-list" id="shotList">
        <details v-for="(shot, index) in shots" :key="index" class="shot-card">
          <summary>
            <div class="shot-main">
              <!-- 镜头缩略图 -->
              <div class="shot-thumb">
                <video
                  v-if="videoObjectUrl"
                  class="shot-thumb-video"
                  :src="`${videoObjectUrl}#t=${getShotStartSeconds(shot.time)}`"
                  muted
                  playsinline
                  preload="metadata"
                ></video>
                <img v-else-if="coverUrl" :src="coverUrl" :alt="`镜头 ${index + 1}`" />
                <span class="play-dot">▶</span>
                <span>镜头 {{ index + 1 }}</span>
              </div>

              <!-- 镜头文案 -->
              <div class="shot-copy">
                <h3>{{ shot.title || `镜头 ${index + 1}` }}</h3>
                <p>{{ shot.description || '暂无画面描述' }}</p>
                <div class="shot-tags">
                  <span v-if="!shot.replaceable?.length">可替换：未识别</span>
                  <span v-for="(tag, ti) in shot.replaceable" :key="ti">可替换：{{ tag }}</span>
                </div>
                <div class="shot-tags keep">
                  <span v-if="!shot.suggestKeep?.length">建议保留：未识别</span>
                  <span v-for="(tag, ti) in shot.suggestKeep" :key="ti">建议保留：{{ tag }}</span>
                </div>
              </div>

              <time>{{ shot.time || '' }}</time>
              <span class="shot-toggle">展开详情</span>
            </div>
          </summary>

          <!-- 展开详情 -->
          <div class="shot-detail">
            <section>
              <h4>画面结构</h4>
              <p><strong>人物：</strong>{{ shot.people || '未识别' }}</p>
              <p><strong>场景：</strong>{{ shot.scene || '未识别' }}</p>
              <p><strong>动作：</strong>{{ shot.action || '未识别' }}</p>
              <p><strong>元素：</strong>{{ elementsText(shot) }}</p>
            </section>
            <section>
              <h4>镜头表达</h4>
              <p><strong>镜头：</strong>{{ shot.camera || '未识别' }}</p>
              <p><strong>节奏：</strong>{{ shot.rhythm || '未识别' }}</p>
            </section>
          </div>
        </details>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-breakdown">
        <h3>暂无视频拆解结果</h3>
        <p>请先上传参考视频，等待系统完成拆解后再查看。</p>
      </div>

      <div class="modal-actions">
        <button class="ghost-button" @click="emit('close')">收起拆解</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(8px);
}

.modal-card {
  position: relative;
  width: min(760px, 100%);
  padding: 20px;
  border-radius: 16px;
  background: rgba(20, 21, 22, 0.98);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
}

.modal-card h2 {
  margin: 0;
  color: #f0f4f1;
  font-size: 18px;
  font-weight: 800;
}

.breakdown-card {
  width: min(1180px, calc(100vw - 64px));
  max-height: min(820px, 88vh);
  overflow: auto;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.11);
  background:
    radial-gradient(circle at 12% 0%, rgba(53, 245, 154, 0.06), transparent 24%),
    rgba(16, 17, 18, 0.98);
}

.breakdown-subtitle {
  max-width: 720px;
  margin: 6px 0 0;
  color: #8f949b;
  font-size: 13px;
  line-height: 1.55;
}

.close-modal {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  display: grid;
  place-items: center;
}

.close-modal:hover {
  background: rgba(255, 255, 255, 0.14);
}

/* ── 概览 ── */
.breakdown-overview {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 18px;
  padding: 14px;
  border: 1px solid rgba(53, 245, 154, 0.13);
  border-radius: 16px;
  background: rgba(53, 245, 154, 0.035);
}

.breakdown-overview div {
  min-width: 0;
  padding: 10px;
  border-radius: 12px;
  background: rgba(8, 9, 10, 0.35);
}

.breakdown-overview span {
  display: block;
  margin-bottom: 5px;
  color: #7f8789;
  font-size: 11px;
  font-weight: 800;
}

.breakdown-overview strong {
  margin: 0;
  color: #dfe6e4;
  font-size: 12px;
  line-height: 1.55;
  word-break: break-all;
}

/* ── 镜头列表 ── */
.shot-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 18px;
}

.shot-card {
  display: block;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.045);
  overflow: hidden;
}

.shot-card[open] {
  border-color: rgba(53, 245, 154, 0.18);
  background: rgba(255, 255, 255, 0.045);
}

.shot-card summary {
  list-style: none;
  cursor: pointer;
  padding: 18px;
}

.shot-card summary::-webkit-details-marker {
  display: none;
}

.shot-main {
  display: grid;
  grid-template-columns: 140px 1fr auto auto;
  gap: 18px;
  align-items: center;
}

/* 镜头缩略图 */
.shot-thumb {
  width: 140px;
  height: 96px;
  border-radius: 14px;
  background:
    linear-gradient(135deg, rgba(43, 255, 154, 0.16), rgba(255, 255, 255, 0.06)),
    rgba(0, 0, 0, 0.36);
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  padding: 12px;
  position: relative;
  box-sizing: border-box;
  overflow: hidden;
}

.shot-thumb img,
.shot-thumb-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.82) brightness(0.72);
}

.shot-thumb::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 45%, rgba(0, 0, 0, 0.55));
}

.shot-thumb .play-dot {
  position: absolute;
  left: 12px;
  top: 12px;
  z-index: 2;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #effff5;
}

.shot-thumb span:last-child {
  position: relative;
  z-index: 2;
  color: #fff;
  font-weight: 700;
  font-size: 14px;
}

/* 镜头文案 */
.shot-copy {
  min-width: 0;
}

.shot-copy h3 {
  margin: 0 0 8px;
  font-size: 18px;
  color: #ffffff;
}

.shot-copy p {
  margin: 0 0 10px;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1.6;
  font-size: 13px;
}

.shot-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.shot-tags span {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 5px 10px;
  font-size: 12px;
  color: #9dffc5;
  background: rgba(43, 255, 154, 0.1);
  border: 1px solid rgba(43, 255, 154, 0.2);
}

.shot-tags.keep span {
  color: rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}

/* 时间 */
time {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 700;
  white-space: nowrap;
  align-self: flex-start;
  padding-top: 4px;
  font-size: 12px;
}

/* 展开按钮 */
.shot-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 88px;
  height: 38px;
  margin: 0;
  padding: 0 14px;
  border: 1px solid rgba(53, 245, 154, 0.24);
  border-radius: 999px;
  color: #8dffba;
  background: rgba(53, 245, 154, 0.045);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  align-self: center;
  justify-self: end;
}

.shot-card[open] .shot-toggle {
  font-size: 0;
}

.shot-card[open] .shot-toggle::before {
  content: "收起";
  font-size: 13px;
}

/* 展开详情 */
.shot-detail {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0 18px 18px 176px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.shot-detail section {
  min-width: 0;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.065);
  border-radius: 12px;
  background: rgba(8, 9, 10, 0.34);
}

.shot-detail h4 {
  margin: 14px 0 8px;
  color: #ffffff;
  font-size: 13px;
  font-weight: 800;
}

.shot-detail p {
  margin: 6px 0;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
  font-size: 12px;
}

.shot-detail strong {
  color: rgba(255, 255, 255, 0.88);
}

/* ── 空状态 ── */
.empty-breakdown {
  margin-top: 32px;
  padding: 40px;
  text-align: center;
}

.empty-breakdown h3 {
  margin: 0 0 8px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 16px;
}

.empty-breakdown p {
  margin: 0;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}

/* ── 底部操作 ── */
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.ghost-button {
  padding: 9px 16px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: #c6ced0;
  font-size: 13px;
  cursor: pointer;
}

.ghost-button:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.16);
}

/* ── 响应式 ── */
@media (max-width: 768px) {
  .shot-main {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .shot-detail {
    padding: 0 14px 14px;
    grid-template-columns: 1fr;
  }

  .breakdown-overview {
    grid-template-columns: 1fr;
  }
}
</style>
