<script setup>
const tools = [
  { icon: '+', label: '', class: 'add-tool', title: '新建' },
  { icon: '▣', label: '资产', title: '资产' },
  { icon: '⌘', label: '工作流', active: true, title: '工作流' },
  { icon: '◷', label: '历史', title: '历史' },
  { icon: '▰', label: '导演台', title: '导演台' },
  { icon: '✂', label: '剪辑', title: '剪辑' },
]
</script>

<template>
  <aside class="leftbar">
    <button
      v-for="(t, i) in tools"
      :key="i"
      class="tool"
      :class="{ 'add-tool': t.class === 'add-tool', active: t.active }"
      :title="t.title"
    >
      <span>{{ t.icon }}</span>
      <small v-if="t.label">{{ t.label }}</small>
    </button>
  </aside>
</template>

<style scoped>
.leftbar {
  position: absolute;
  left: 20px;
  top: 50%;
  z-index: 12;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  width: 70px;
  padding: 10px 0 18px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(28, 29, 30, 0.86);
  box-shadow: var(--shadow);
  transform: translateY(-50%);
}

.tool {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 5px;
  width: 52px;
  min-height: 52px;
  border: 1px solid transparent;
  border-radius: 16px;
  background: transparent;
  color: #f2f2f2;
  font-size: 22px;
}

.tool small {
  color: #a6a8ad;
  font-size: 13px;
}

.tool.active,
.tool:hover {
  background: rgba(255, 255, 255, 0.06);
}

.add-tool {
  width: 48px;
  height: 48px;
  min-height: 48px;
  border-radius: 50%;
  background: #fff;
  color: #111;
  font-size: 38px;
  line-height: 1;
}
</style>
