<script setup>

const props = defineProps({
  progress: {
    type: Number,
    default: 0,
  },
  stage: {
    type: String,
    default: '提取主体与场景...',
  },
  done: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <div class="analysis-node flow-node" :class="{ 'is-done': done }">
    <div class="node-head">
      <span v-if="!done" class="pulse"></span>
      <span v-else class="done-dot">✓</span>
      <strong>{{ done ? '拆解完成' : '正在拆解视频' }}</strong>
    </div>

    <p v-if="!done">正在整理主体、场景、元素和字幕，完成后会把可操作内容放到画布里。</p>
    <p v-else>视频已拆解完成，可操作内容已准备就绪。控制台已打印拆解结果。</p>

    <div class="progress-track">
      <div class="progress-fill" :class="{ 'fill-done': done }" :style="{ width: progress + '%' }"></div>
    </div>

    <div class="progress-meta">
      <span class="node-caption">{{ stage }}</span>
      <span v-if="!done" class="progress-num">{{ progress }}%</span>
      <span v-else class="progress-num done-num">100%</span>
    </div>
  </div>
</template>

<style scoped>
.analysis-node {
  width: 420px;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(18, 19, 20, 0.94);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.44);
  transition: border-color 0.3s ease;
}

.analysis-node.is-done {
  border-color: rgba(53, 245, 154, 0.42);
  box-shadow: 0 0 0 1px rgba(53, 245, 154, 0.1), 0 28px 80px rgba(0, 0, 0, 0.44);
}

.node-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.node-head strong {
  color: #f0f0f1;
  font-size: 16px;
  font-weight: 700;
}

.pulse {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 0 0 rgba(53, 245, 154, 0.66);
  animation: pulse 1.35s infinite;
}

.done-dot {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--green);
  color: #04140c;
  font-size: 12px;
  font-weight: 900;
  box-shadow: 0 0 14px rgba(53, 245, 154, 0.4);
}

@keyframes pulse {
  70% {
    box-shadow: 0 0 0 16px rgba(53, 245, 154, 0);
  }
}

.analysis-node p {
  margin: 10px 0 16px;
  color: var(--muted);
  line-height: 1.65;
}

.progress-track {
  position: relative;
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  border-radius: inherit;
  background: var(--green);
  box-shadow: 0 0 12px rgba(53, 245, 154, 0.3);
  transition: width 0.3s ease;
}

.progress-fill.fill-done {
  box-shadow: 0 0 16px rgba(53, 245, 154, 0.5);
}

.progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}

.node-caption {
  color: #bfc2c8;
  font-size: 12px;
  font-weight: 700;
}

.progress-num {
  color: var(--green);
  font-size: 12px;
  font-weight: 700;
}

.done-num {
  color: var(--green);
}
</style>
