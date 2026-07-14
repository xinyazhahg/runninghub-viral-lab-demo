<script setup>
import { ref } from 'vue'

const props = defineProps({ loading: Boolean, configError: String })
const emit = defineEmits(['login', 'register'])
const mode = ref('login')
const email = ref('')
const password = ref('')
const error = ref('')

function submit() {
  error.value = ''
  if (!email.value || !password.value) {
    error.value = '请输入邮箱和密码'
    return
  }
  emit(mode.value, { email: email.value.trim(), password: password.value })
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-card">
      <div class="brand-mark">✦</div>
      <p class="eyebrow">VIRAL LAB</p>
      <h1>爆款实验室</h1>
      <p class="subtitle">登录后继续创建和管理视频作品</p>
      <div class="mode-tabs">
        <button :class="{ active: mode === 'login' }" @click="mode = 'login'">邮箱登录</button>
        <button :class="{ active: mode === 'register' }" @click="mode = 'register'">邮箱注册</button>
      </div>
      <form @submit.prevent="submit">
        <label>邮箱<input v-model="email" type="email" autocomplete="email" placeholder="name@example.com"></label>
        <label>密码<input v-model="password" type="password" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" minlength="6" placeholder="至少 6 位"></label>
        <p v-if="configError || error" class="error">{{ configError || error }}</p>
        <button class="submit" type="submit" :disabled="loading">
          {{ loading ? '处理中…' : mode === 'login' ? '登录' : '注册' }}
        </button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.auth-page{min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 20%,#183027 0,#0b0d0e 42%,#070809 100%);color:#f5fff9}.auth-card{width:min(410px,calc(100vw - 40px));padding:42px;border:1px solid rgba(255,255,255,.1);border-radius:22px;background:rgba(18,21,21,.92);box-shadow:0 30px 80px rgba(0,0,0,.45)}.brand-mark{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#35f59a;color:#07110c;font-size:22px}.eyebrow{margin:24px 0 6px;color:#35f59a;font-size:11px;font-weight:800;letter-spacing:.22em}h1{margin:0;font-size:30px}.subtitle{margin:10px 0 28px;color:#929b96}.mode-tabs{display:grid;grid-template-columns:1fr 1fr;padding:4px;border-radius:10px;background:#0c0f0e}.mode-tabs button{padding:10px;border:0;border-radius:8px;background:transparent;color:#7d8681}.mode-tabs button.active{background:#252b28;color:#fff}form{display:grid;gap:18px;margin-top:22px}label{display:grid;gap:8px;color:#cbd3cf;font-size:13px}input{padding:13px 14px;border:1px solid #303733;border-radius:10px;outline:none;background:#0d100f;color:#fff}input:focus{border-color:#35f59a}.submit{padding:13px;border:0;border-radius:10px;background:#35f59a;color:#07110c;font-weight:800}.submit:disabled{opacity:.55}.error{margin:0;color:#ff8585;font-size:13px}
</style>
