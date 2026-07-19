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
const shots = computed(() => Array.isArray(props.data?.actionStages) && props.data.actionStages.length
  ? props.data.actionStages
  : (Array.isArray(props.data?.shots) ? props.data.shots : []))
const hasData = computed(() => shots.value.length > 0 || overview.value.referenceVideo)
const isFineBreakdown = computed(() => Number(props.data?.breakdownVersion || 0) >= 3)

function formatList(value) {
  if (Array.isArray(value) && value.length) return value.join('、')
  if (typeof value === 'string' && value.trim()) return value
  return '未识别'
}

function getShotStartSeconds(time = '') {
  const decimal = String(time).match(/^(\d+(?:\.\d+)?)\s*[-–—至]/)
  if (decimal) return Number(decimal[1]) + 0.1
  const match = String(time).match(/(\d{1,2}):(\d{2})/)
  if (!match) return 0
  return Number(match[1]) * 60 + Number(match[2]) + 0.3
}

function elementsText(shot) {
  if (Array.isArray(shot.elements)) return shot.elements.join('、') || '未识别'
  return shot.elements || '未识别'
}

function formatSeconds(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(2).replace(/\.00$/, '')}s` : '未确认'
}

function shotTime(shot) {
  if (!isFineBreakdown.value) return shot.time || '未确认时间'
  if (shot.timeConfirmed === false) return '时间未确认'
  return `${formatSeconds(shot.startTime)}–${formatSeconds(shot.endTime)}`
}

function dialogueText(dialogue) {
  if (!Array.isArray(dialogue) || !dialogue.length) return '对白尚未识别'
  return dialogue.map((item) => `${item.speaker || '说话人未确认'}：${item.text || ''}（${formatSeconds(item.startTime)}–${formatSeconds(item.endTime)}）`).join('\n')
}
</script>

<template>
  <div v-if="visible" class="modal" @click.self="emit('close')">
    <div class="modal-card breakdown-card">
      <button class="close-modal" @click="emit('close')">×</button>
      <h2>视频拆解</h2>
      <p class="breakdown-subtitle">按真实剧情变化整理动作阶段，保留时间依据、对白、动作与情绪信息。</p>

      <!-- 识别概览 -->
      <section v-if="hasData" class="breakdown-overview">
        <div>
          <span>视频摘要</span>
          <strong>{{ overview.referenceVideo || videoName || '已上传参考视频' }}</strong>
        </div>
        <div>
          <span>动作阶段</span>
          <strong>{{ isFineBreakdown ? `${overview.shotCount || shots.length || 0} 个物理镜头` : `${overview.actionStageCount || overview.shotCount || shots.length || 0} 个` }}</strong>
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
        <article v-for="(shot, index) in shots" :key="shot.id || index" class="shot-card">
          <aside class="shot-side">
            <strong class="shot-number">镜头 {{ index + 1 }}</strong>
            <div class="shot-thumb">
              <video
                v-if="videoObjectUrl"
                class="shot-thumb-video"
                :src="`${videoObjectUrl}#t=${getShotStartSeconds(isFineBreakdown ? shot.startTime : shot.time)}`"
                muted
                playsinline
                preload="metadata"
              ></video>
              <img v-else-if="coverUrl" :src="coverUrl" :alt="`镜头 ${index + 1}`" />
              <span class="play-dot">▶</span>
            </div>
            <time>{{ shotTime(shot) }}</time>
            <h3>{{ shot.title || shot.narrative?.summary || `镜头 ${index + 1}` }}</h3>
          </aside>

          <div v-if="isFineBreakdown" class="shot-detail fine-detail">
            <section class="detail-module">
              <h4>叙事要素</h4>
              <p><strong>场景：</strong>{{ shot.narrative?.scene || '未识别' }}</p>
              <p><strong>角色：</strong>{{ formatList(shot.narrative?.characters) }}</p>
              <p><strong>镜头摘要：</strong>{{ shot.narrative?.summary || '未识别' }}</p>
            </section>
            <section class="detail-module">
              <h4>台词对白</h4>
              <p class="multiline">{{ dialogueText(shot.narrative?.dialogue) }}</p>
            </section>
            <section class="detail-module">
              <h4>镜头语言</h4>
              <p><strong>景别：</strong>{{ shot.cinematography?.shotSize || '未识别' }}</p>
              <p><strong>构图：</strong>{{ shot.cinematography?.composition || '未识别' }}</p>
              <p><strong>镜头类型：</strong>{{ [shot.cinematography?.viewAngle, shot.cinematography?.cameraPosition].filter(Boolean).join('、') || '未识别' }}</p>
              <p><strong>运镜：</strong>{{ shot.cinematography?.cameraMovement || '未识别' }}</p>
              <p><strong>焦距与景深：</strong>{{ shot.cinematography?.lensAndDepth || '未识别' }}</p>
            </section>
            <section class="detail-module">
              <h4>影像处理</h4>
              <p><strong>光影与色调：</strong>{{ [shot.visualTreatment?.lighting, shot.visualTreatment?.colorTone, shot.visualTreatment?.contrast, shot.visualTreatment?.imageTexture].filter(Boolean).join('；') || '未识别' }}</p>
              <p><strong>剪辑：</strong>{{ shot.visualTreatment?.editing || '未识别' }}</p>
            </section>
            <section class="detail-module">
              <h4>声音</h4>
              <p><strong>音乐与音效：</strong>{{ [shot.sound?.backgroundMusic, shot.sound?.environmentSound, ...(shot.sound?.soundEffects || []), shot.sound?.laughter].filter(Boolean).join('；') || '未识别' }}</p>
              <p><strong>声音摘要：</strong>{{ shot.sound?.audioSummary || '未识别' }}</p>
            </section>
            <section class="detail-module">
              <h4>叙事功能</h4>
              <p><strong>分镜功能：</strong>{{ shot.narrativeFunction?.shotPurpose || '未识别' }}</p>
              <p><strong>镜头叙事功能：</strong>{{ shot.narrativeFunction?.storyFunction || '未识别' }}</p>
              <p><strong>情绪变化：</strong>{{ shot.narrativeFunction?.emotionChange || '未识别' }}</p>
            </section>
            <section class="detail-module beats-section">
              <h4>动作阶段（{{ shot.beats?.length || 0 }}）</h4>
              <article v-for="beat in shot.beats || []" :key="beat.id" class="beat-row">
                <strong>{{ beat.title || beat.id }} · {{ beat.timeConfirmed === false ? '时间未确认' : `${formatSeconds(beat.startTime)}–${formatSeconds(beat.endTime)}` }}</strong>
                <p>{{ beat.trigger ? `触发：${beat.trigger}；` : '' }}{{ beat.action || '动作未识别' }}</p>
                <p>表情：{{ beat.expression || '未识别' }}；情绪：{{ beat.emotionBefore || '未识别' }} → {{ beat.emotionAfter || '未识别' }}</p>
              </article>
            </section>
          </div>
          <div v-else class="shot-detail">
            <section class="detail-module">
              <h4>叙事要素</h4>
              <p><strong>主体：</strong>{{ formatList(shot.subjects || shot.people) }}</p>
              <p><strong>场景：</strong>{{ shot.scene || '未识别' }}</p>
              <p><strong>动作：</strong>{{ shot.actions || shot.action || shot.description || '未识别' }}</p>
              <p><strong>表情与情绪：</strong>{{ [shot.expressions || shot.expression, shot.emotion].filter(Boolean).join('；') || '未识别' }}</p>
              <p><strong>元素：</strong>{{ elementsText(shot) }}</p>
            </section>
            <section class="detail-module">
              <h4>台词对白</h4>
              <p><strong>对白：</strong>{{ shot.dialogue || '对白尚未识别' }}</p>
            </section>
            <section class="detail-module">
              <h4>声音</h4>
              <p><strong>声音：</strong>{{ shot.sound || '未识别' }}</p>
            </section>
          </div>
        </article>
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
  width: min(1360px, calc(100vw - 64px));
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
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.045);
  overflow: hidden;
}

.shot-side { display: grid; gap: 10px; min-width: 0; }
.shot-number { color: #79ffc0; font-size: 13px; font-weight: 800; }
.shot-side h3 { margin: 0; color: #fff; font-size: 16px; line-height: 1.45; }

/* 镜头缩略图 */
.shot-thumb {
  width: 100%;
  height: 132px;
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

/* 时间 */
time {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 700;
  white-space: nowrap;
  padding: 7px 9px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.055);
  font-size: 12px;
}

/* 右侧拆解模块 */
.shot-detail {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  min-width: 0;
}

.shot-detail section {
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.065);
  border-radius: 12px;
  background: rgba(8, 9, 10, 0.34);
}

.shot-detail h4 {
  margin: 0 0 8px;
  color: var(--green);
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
.fine-detail .beats-section { grid-column: 1 / -1; }
.multiline { white-space: pre-line; }
.beat-row { padding: 10px 0; border-top: 1px solid rgba(255,255,255,.07); }
.beat-row:first-of-type { border-top: 0; }
.beat-row > strong { display: block; color: #e8f3ed; font-size: 12px; }

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
  .shot-card {
    grid-template-columns: 1fr;
  }

  .shot-detail {
    grid-template-columns: 1fr;
  }

  .fine-detail .beats-section { grid-column: auto; }

  .breakdown-overview {
    grid-template-columns: 1fr;
  }
}
</style>
