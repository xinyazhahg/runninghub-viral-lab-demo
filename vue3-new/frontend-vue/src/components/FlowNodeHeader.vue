<script setup>
defineProps({
  step: { type: String, default: '' },
  title: { type: String, required: true },
})
</script>

<template>
  <header class="flow-node-header">
    <div class="flow-node-title-line">
      <span v-if="step" class="flow-node-step">{{ step }}</span>
      <h2>{{ title }}</h2>
    </div>
    <slot name="actions" />
  </header>
</template>

<style scoped>
.flow-node-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  text-align: left;
}
.flow-node-title-line { display: flex; min-width: 0; align-items: baseline; gap: 8px; }
.flow-node-step {
  flex: 0 0 auto;
  color: rgba(255, 255, 255, .42);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .12em;
  line-height: 1.35;
}
.flow-node-title-line h2 {
  margin: 0;
  color: #f4f7f6;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.35;
}
</style>
