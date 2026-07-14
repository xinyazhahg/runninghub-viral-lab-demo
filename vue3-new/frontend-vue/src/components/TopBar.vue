<script setup>
defineProps({
  projectName: { type: String, default: 'Untitled' }, userEmail: { type: String, default: '' },
  worksLoading: Boolean, creditBalance: { type: Number, default: 0 }, frozenBalance: { type: Number, default: 0 },
  isAdmin: Boolean,
})
defineEmits(['works', 'logout', 'billing', 'clear', 'test-bench', 'admin'])
</script>

<template>
  <div class="project-title">
    <span class="rh-mark">✦</span>
    <strong>{{ projectName || 'Untitled' }}</strong>
  </div>

  <div class="canvas-actions">
    <span class="perf-badge">HeyGen HyperFrames</span>
    <button class="credit-badge" title="查看积分明细" @click="$emit('billing')">
      <span>积分</span>
      <strong>{{ creditBalance.toFixed(2) }}</strong>
      <small v-if="frozenBalance">冻结 {{ frozenBalance.toFixed(2) }}</small>
    </button>
    <button class="text-action" :disabled="worksLoading" @click="$emit('works')">{{ worksLoading ? '正在打开…' : '我的作品' }}</button>
    <button class="text-action secondary-action" @click="$emit('clear')">清空当前状态</button>
    <button class="text-action test-action" @click="$emit('test-bench')">测试台</button>
    <button v-if="isAdmin" class="text-action" @click="$emit('admin')">运营后台</button>
    <span v-if="userEmail" class="user-email" :title="userEmail">{{ userEmail }}</span>
    <button class="text-action" @click="$emit('logout')">退出</button>
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
  max-width: min(34vw, 440px);
}

.project-title strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  gap: 8px;
  max-width: calc(100vw - 520px);
  white-space: nowrap;
}

.perf-badge {
  flex: 0 0 auto;
  padding: 9px 13px;
  border: 1px solid var(--line);
  border-radius: 10px;
  color: #effff8;
  background: linear-gradient(135deg, rgba(53, 245, 154, 0.22), rgba(19, 21, 23, 0.95));
  font-size: 12px;
  font-weight: 800;
}
.credit-badge { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 5px; height: 36px; padding: 0 9px; border: 1px solid rgba(53,245,154,.24); border-radius: 8px; color: #dff9eb; background: rgba(20,40,30,.88); }
.credit-badge strong { font-variant-numeric: tabular-nums; }
.credit-badge small { color: #7f9b8c; font-size: 10px; }

.text-action {
  flex: 0 0 auto;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(28, 29, 32, 0.88);
  color: var(--soft);
}
.text-action:disabled { cursor: wait; opacity: .62; }
.user-email {
  min-width: 0;
  max-width: 150px;
  overflow: hidden;
  color: #8f9993;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1360px) {
  .canvas-actions { max-width: calc(100vw - 400px); }
  .perf-badge { display: none; }
  .user-email { max-width: 110px; }
}

@media (max-width: 1120px) {
  .project-title { max-width: 260px; }
  .canvas-actions { max-width: calc(100vw - 340px); }
  .credit-badge small { display: none; }
  .user-email { max-width: 72px; }
}

@media (max-width: 920px) {
  .project-title { max-width: 200px; }
  .canvas-actions { max-width: calc(100vw - 270px); }
  .user-email { display: none; }
  .secondary-action { max-width: 42px; overflow: hidden; text-indent: -999px; }
  .secondary-action::after { content: '清空'; display: block; text-indent: 0; }
}
</style>
