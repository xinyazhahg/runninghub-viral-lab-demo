<script setup>
import { ref } from 'vue'

defineProps({ projects: { type: Array, default: () => [] }, loading: Boolean, error: String })
defineEmits(['open', 'delete', 'back'])

const failedCovers = ref(new Set())

function dateText(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN', { hour12: false })
}

function coverUrl(project) {
  return project.latest_result_url || project.original_video_url || ''
}

function isImageCover(url) {
  return /\.(jpe?g|png|webp|gif)(?:\?|$)/i.test(url || '')
}

function coverFailed(project) {
  return failedCovers.value.has(coverUrl(project))
}

function markCoverFailed(project) {
  failedCovers.value = new Set([...failedCovers.value, coverUrl(project)])
}
</script>

<template>
  <main class="works-page">
    <header><div><p>VIRAL LAB</p><h1>我的作品</h1></div><button @click="$emit('back')">返回工作台</button></header>
    <section v-if="loading" class="state">正在加载作品…</section>
    <section v-else-if="error" class="state error">{{ error }}</section>
    <section v-else-if="!projects.length" class="state"><strong>暂无作品</strong><span>返回工作台上传第一条原视频。</span></section>
    <section v-else class="grid">
      <article v-for="project in projects" :key="project.id" class="card">
        <div class="preview">
          <img
            v-if="coverUrl(project) && !coverFailed(project) && isImageCover(coverUrl(project))"
            :src="coverUrl(project)"
            :alt="project.name || '项目封面'"
            @error="markCoverFailed(project)"
          >
          <video
            v-else-if="coverUrl(project) && !coverFailed(project)"
            :src="coverUrl(project)"
            muted
            playsinline
            preload="metadata"
            @error="markCoverFailed(project)"
          ></video>
          <div v-else class="preview-placeholder"><span>✦</span><small>暂无可用封面</small></div>
          <b>{{ Number(project.version_count || 0) }} 个版本</b>
        </div>
        <div class="body">
          <h2>{{ project.name || '未命名项目' }}</h2>
          <dl>
            <div><dt>状态</dt><dd>{{ project.status || '未知' }}</dd></div>
            <div><dt>创建时间</dt><dd>{{ dateText(project.created_at) }}</dd></div>
            <div><dt>更新时间</dt><dd>{{ dateText(project.updated_at) }}</dd></div>
          </dl>
        </div>
        <footer class="actions">
          <button class="open" @click="$emit('open', project)">继续编辑</button>
          <button @click="$emit('open', project)">历史版本</button>
          <button class="delete" @click="$emit('delete', project)">删除</button>
        </footer>
      </article>
    </section>
  </main>
</template>

<style scoped>
.works-page { min-height: 100vh; padding: 48px clamp(24px, 6vw, 90px); box-sizing: border-box; background: #0b0d0e; color: #f3f7f5; }
header { display: flex; align-items: end; justify-content: space-between; margin-bottom: 36px; }
header p { margin: 0 0 8px; color: #35f59a; font-size: 11px; font-weight: 800; letter-spacing: .22em; }
h1 { margin: 0; font-size: 34px; }
button { border: 1px solid #343b37; border-radius: 9px; background: #1a1e1c; color: #dce3df; padding: 10px 14px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); align-items: start; gap: 20px; }
.card { display: grid; grid-template-rows: 180px auto auto; min-width: 0; min-height: 360px; overflow: visible; border: 1px solid #272d2a; border-radius: 16px; background: #141716; }
.preview { position: relative; min-width: 0; height: 180px; overflow: hidden; display: grid; place-items: center; border-radius: 15px 15px 0 0; background: #090b0a; color: #6f7773; }
.preview video, .preview img { display: block; width: 100%; height: 100%; min-width: 0; min-height: 0; object-fit: cover; }
.preview-placeholder { display: grid; place-items: center; gap: 8px; color: #737c77; }
.preview-placeholder span { color: #35f59a; font-size: 26px; }
.preview-placeholder small { font-size: 12px; }
.preview b { position: absolute; right: 10px; bottom: 10px; z-index: 1; padding: 6px 9px; border-radius: 7px; background: rgba(0, 0, 0, .72); color: #f3f7f5; font-size: 11px; }
.body { min-width: 0; padding: 18px; }
.body h2 { margin: 0 0 14px; overflow-wrap: anywhere; font-size: 18px; }
.body dl { display: grid; gap: 8px; margin: 0; }
.body dl div { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 8px; font-size: 12px; }
.body dt { color: #69726d; }
.body dd { min-width: 0; margin: 0; color: #9aa39e; overflow-wrap: anywhere; }
.actions { display: flex; align-self: end; flex-wrap: wrap; gap: 10px; padding: 0 18px 18px; }
.actions button { flex: 0 0 auto; }
.actions .open { flex: 1 1 110px; border-color: #35f59a; background: #35f59a; color: #07110c; font-weight: 800; }
.delete { color: #ff8585; }
.state { min-height: 360px; display: grid; place-content: center; gap: 10px; text-align: center; color: #8e9792; }
.state strong { color: #fff; font-size: 20px; }
.state.error { color: #ff8585; }
</style>
