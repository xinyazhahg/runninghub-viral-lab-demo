<script setup>
</script>

<template>
  <div class="project-title">
    <span class="rh-mark">✦</span>
    <strong>Untitled</strong>
  </div>

  <div class="canvas-actions">
    <span class="perf-badge">HeyGen HyperFrames</span>
    <button class="text-action">分享</button>
  </div>
</template>

<style scoped>
.project-title {
  position: absolute;
  top: 28px;
  left: 42px;
  z-index: 8;
  display: flex;
  align-items: center;
  gap: 18px;
  font-size: 26px;
  color: #f4f4f4;
}

.project-title strong {
  color: #f4f4f4;
  font-weight: 700;
}

.rh-mark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  color: #04140c;
  background: var(--green);
  clip-path: polygon(10% 10%, 60% 10%, 60% 36%, 88% 36%, 88% 90%, 34% 90%, 34% 62%, 10% 62%);
  filter: drop-shadow(0 0 18px rgba(53, 245, 154, 0.35));
}

.canvas-actions {
  position: absolute;
  top: 28px;
  right: 28px;
  z-index: 8;
  display: flex;
  align-items: center;
  gap: 16px;
}

.perf-badge {
  padding: 9px 13px;
  border: 1px solid var(--line);
  border-radius: 10px;
  color: #effff8;
  background: linear-gradient(135deg, rgba(53, 245, 154, 0.22), rgba(19, 21, 23, 0.95));
  font-size: 12px;
  font-weight: 800;
}

.text-action {
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(28, 29, 32, 0.88);
  color: var(--soft);
}
</style>
