<script setup>
defineProps({ projects: { type: Array, default: () => [] }, loading: Boolean, error: String })
defineEmits(['open', 'delete', 'back'])

function dateText(value) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
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
          <video v-if="project.latest_result_url || project.original_video_url" :src="project.latest_result_url || project.original_video_url" muted preload="metadata" />
          <span v-else>暂无预览</span>
          <b>{{ project.version_count || 0 }} 个版本</b>
        </div>
        <div class="body"><h2>{{ project.name }}</h2><p>{{ project.status }} · 更新于 {{ dateText(project.updated_at) }}</p><small>创建于 {{ dateText(project.created_at) }}</small></div>
        <footer>
          <button class="open" @click="$emit('open', project)">继续编辑</button>
          <button @click="$emit('open', project)">历史版本</button>
          <button class="delete" @click="$emit('delete', project)">删除</button>
        </footer>
      </article>
    </section>
  </main>
</template>

<style scoped>
.works-page{min-height:100vh;padding:48px clamp(24px,6vw,90px);box-sizing:border-box;background:#0b0d0e;color:#f3f7f5}header{display:flex;align-items:end;justify-content:space-between;margin-bottom:36px}header p{margin:0 0 8px;color:#35f59a;font-size:11px;font-weight:800;letter-spacing:.22em}h1{margin:0;font-size:34px}button{border:1px solid #343b37;border-radius:9px;background:#1a1e1c;color:#dce3df;padding:10px 14px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px}.card{overflow:hidden;border:1px solid #272d2a;border-radius:16px;background:#141716}.preview{position:relative;height:180px;display:grid;place-items:center;background:#090b0a;color:#6f7773}.preview video{width:100%;height:100%;object-fit:cover}.preview b{position:absolute;right:10px;bottom:10px;padding:6px 9px;border-radius:7px;background:rgba(0,0,0,.72);font-size:11px}.body{padding:18px}.body h2{margin:0 0 8px;font-size:18px}.body p,.body small{color:#89928d}.body p{margin:0 0 8px;font-size:12px}footer{display:flex;gap:10px;padding:0 18px 18px}.open{flex:1;border-color:#35f59a;background:#35f59a;color:#07110c;font-weight:800}.delete{color:#ff8585}.state{min-height:360px;display:grid;place-content:center;gap:10px;text-align:center;color:#8e9792}.state strong{color:#fff;font-size:20px}.state.error{color:#ff8585}
</style>
