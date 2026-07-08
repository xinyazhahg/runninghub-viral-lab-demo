<script setup>
</script>

<template>
  <div class="lab-head">
    <button class="back-button">← 一键同款</button>
    <div class="lab-title">
      <span class="module-dot"></span>
      <strong>爆款实验室</strong>
      <span>当前配置：上传替换与定制</span>
    </div>
  </div>
</template>

<style scoped>
.lab-head {
  position: absolute;
  top: 28px;
  left: 230px;
  z-index: 9;
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-button {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 9px 14px;
  background: rgba(28, 29, 32, 0.88);
  color: var(--soft);
  transition: 0.18s ease;
}

.back-button:hover {
  border-color: var(--green-line);
  color: #eefcf4;
  background: rgba(53, 245, 154, 0.1);
}

.lab-title {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 16px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(20, 21, 22, 0.88);
  box-shadow: 0 16px 50px rgba(0, 0, 0, 0.36);
}

.lab-title strong {
  color: #f0f0f1;
  font-size: 16px;
  font-weight: 700;
}

.lab-title span:last-child {
  color: #8d9198;
  font-size: 13px;
}

.module-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 14px rgba(53, 245, 154, 0.8);
}
</style>
