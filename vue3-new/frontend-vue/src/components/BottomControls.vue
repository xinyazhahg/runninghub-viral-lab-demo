<script setup>
</script>

<template>
  <div class="bottom-controls">
    <button>▰</button>
    <button>▦</button>
    <button>⌖</button>
    <div class="zoom-line"><span></span></div>
    <button>?</button>
    <button>□</button>
    <button class="watermark">水印设置</button>
  </div>
</template>

<style scoped>
.bottom-controls {
  position: absolute;
  left: 20px;
  bottom: 18px;
  z-index: 12;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(28, 29, 32, 0.88);
  box-shadow: var(--shadow);
}

.bottom-controls button {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #b9bbc1;
}

.bottom-controls .watermark {
  width: auto;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
}

.zoom-line {
  position: relative;
  width: 86px;
  height: 4px;
  border-radius: 999px;
  background: #45484d;
}

.zoom-line span {
  position: absolute;
  left: 16px;
  top: 0;
  width: 42px;
  height: 4px;
  border-radius: inherit;
  background: var(--green);
}
</style>
