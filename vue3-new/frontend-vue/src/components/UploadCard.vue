<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  video: {
    type: Object,
    default: () => ({
      name: '', coverUrl: '', assetUrl: '', duration: '', ratio: '', size: '',
    }),
  },
  status: {
    type: String,
    default: 'idle', // 'idle' | 'analyzing' | 'done' | 'error'
  },
})

const emit = defineEmits(['upload', 'view-breakdown'])

const videoInput = ref(null)

function triggerUpload() {
  videoInput.value?.click()
}

function onFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  emit('upload', file)
}

const statusText = computed(() => {
  if (props.status === 'analyzing') return '正在拆解'
  if (props.status === 'done') return '查看视频拆解'
  if (props.status === 'error') return '拆解失败'
  if (props.video.name) return '已上传'
  return ''
})

function onStatusClick() {
  if (props.status === 'done') {
    emit('view-breakdown')
  } else {
    triggerUpload()
  }
}
</script>

<template>
  <div class="upload-node flow-node">
    <input ref="videoInput" type="file" accept="video/*" hidden @change="onFileChange" />

    <!-- 空态：上传卡片 -->
    <div v-if="!video.name" class="upload-empty" @click="triggerUpload">
      <div class="upload-plus">+</div>
      <h1>上传你想复刻的视频</h1>
      <p>点击选择视频文件</p>
    </div>

    <!-- 已上传态 -->
    <div v-else class="uploaded-video-node">
      <div class="uploaded-thumb">
        <img v-if="video.coverUrl" :src="video.coverUrl" alt="" />
        <video v-else-if="video.assetUrl" :src="video.assetUrl" muted playsinline preload="metadata"></video>
        <div class="play-dot">▶</div>
      </div>
      <strong>{{ video.name }}</strong>
      <span>{{ video.duration }} · {{ video.ratio }} · {{ video.size }}</span>
      <button class="source-status" type="button" @click="onStatusClick">
        {{ statusText }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.upload-node {
  display: block;
  padding: 0;
  text-align: center;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(18, 19, 20, 0.94);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.44);
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease;
}

.upload-node:hover {
  border-color: rgba(53, 245, 154, 0.32);
  background: rgba(22, 24, 24, 0.98);
}

.upload-node:hover .upload-plus {
  border-color: rgba(53, 245, 154, 0.36);
  color: #e5fff0;
  background: rgba(53, 245, 154, 0.08);
  box-shadow: 0 0 18px rgba(53, 245, 154, 0.12);
}

.upload-empty {
  display: grid;
  justify-items: center;
  gap: 12px;
  min-height: 360px;
  align-content: center;
  padding: 48px;
  border-radius: 20px;
  transition: border-color 0.18s ease, background 0.18s ease;
}

.upload-plus {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  color: #c5c9cf;
  background: rgba(255, 255, 255, 0.045);
  font-size: 34px;
  font-weight: 300;
}

.upload-node h1 {
  margin: 0;
  color: #f2f2f2;
  font-size: 26px;
}

.upload-node p {
  color: var(--muted);
  max-width: 220px;
  font-size: 13px;
  line-height: 1.5;
}

.uploaded-video-node {
  display: grid;
  justify-items: center;
  gap: 12px;
  padding: 48px;
  border-radius: 20px;
}

.uploaded-thumb {
  position: relative;
  overflow: hidden;
  display: grid;
  place-items: end start;
  width: 116px;
  height: 190px;
  padding: 8px;
  border-radius: 9px;
  background: linear-gradient(155deg, #23382e, #6f7e62 48%, #131514);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
}

.uploaded-thumb img,
.uploaded-thumb video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.86) brightness(0.82);
}

.uploaded-thumb::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 48%, rgba(0, 0, 0, 0.45));
}

.play-dot {
  position: relative;
  z-index: 3;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.58);
  color: #fff;
  font-size: 12px;
}

.uploaded-video-node strong {
  max-width: 150px;
  overflow: hidden;
  color: #e8e9ec;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.uploaded-video-node span {
  color: #8d9299;
  font-size: 12px;
}

.source-status {
  border: 0;
  padding: 5px 9px;
  border-radius: 999px;
  color: #06110a;
  background: var(--green);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: box-shadow 0.18s ease;
}

.source-status:hover {
  color: #031007;
  box-shadow: 0 0 18px rgba(53, 245, 154, 0.28);
}
</style>
