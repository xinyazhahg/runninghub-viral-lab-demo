<script setup>
import { onMounted, reactive, ref } from 'vue'
import { getAdminOverview, getAdminTasks, getGenerationConfig, getStabilityStatus, scanStorage, resolveStorageAudit } from '../api.js'

const emit = defineEmits(['back'])
const loading = ref(true)
const error = ref('')
const overview = ref(null)
const tasks = ref([])
const stability = ref({ logs: [], storageAudits: [], tasks: [] })
const storageScanning = ref(false)
const storageScanResult = ref(null)
const models = ref([])
const modelsLoading = ref(true)
const modelsError = ref('')
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const now = new Date()
const filters = reactive({
  from: new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10),
  to: now.toISOString().slice(0, 10), modelId: '', taskStatus: '',
})
const taskStatusOptions = [
  { value: 'created', label: '已创建' },
  { value: 'queued', label: '排队中' },
  { value: 'analyzing', label: '分析中' },
  { value: 'generating', label: '生成中' },
  { value: 'success', label: '已成功' },
  { value: 'failed', label: '已失败' },
  { value: 'timeout', label: '已超时' },
  { value: 'cancelled', label: '已取消' },
]

const percent = (value) => `${(Number(value || 0) * 100).toFixed(1)}%`
const number = (value) => Number(value || 0).toFixed(Number(value || 0) % 1 ? 2 : 0)

async function loadModels() {
  modelsLoading.value = true
  modelsError.value = ''
  try {
    const response = await getGenerationConfig()
    models.value = Array.isArray(response.models)
      ? response.models.filter((model) => model?.id).map((model) => ({ id: model.id, label: model.label || model.id }))
      : []
  } catch (modelError) {
    models.value = []
    modelsError.value = modelError.message || '模型配置加载失败'
  } finally {
    modelsLoading.value = false
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = { ...filters, from: new Date(`${filters.from}T00:00:00`).toISOString(), to: new Date(`${filters.to}T23:59:59.999`).toISOString() }
    const [summary, taskPage, stabilityResponse] = await Promise.all([
      getAdminOverview(params), getAdminTasks({ ...params, page: pagination.page, pageSize: pagination.pageSize }), getStabilityStatus(),
    ])
    overview.value = summary.data
    tasks.value = taskPage.items || []
    pagination.total = taskPage.total || 0
    stability.value = stabilityResponse.data || stability.value
  } catch (loadError) {
    error.value = loadError.message || '运营数据加载失败'
  } finally {
    loading.value = false
  }
}

async function runStorageScan() {
  if (storageScanning.value) return
  storageScanning.value = true
  error.value = ''
  try {
    storageScanResult.value = (await scanStorage()).outcome
    stability.value = (await getStabilityStatus()).data || stability.value
  } catch (scanError) {
    error.value = scanError.message
  } finally {
    storageScanning.value = false
  }
}

async function handleAudit(audit, action) {
  try {
    await resolveStorageAudit(audit.id, action)
    stability.value = (await getStabilityStatus()).data || stability.value
  } catch (auditError) {
    error.value = auditError.message
  }
}

function changePage(delta) {
  pagination.page = Math.max(1, pagination.page + delta)
  void load()
}

onMounted(() => {
  void loadModels()
  void load()
})
</script>

<template>
  <main class="admin-dashboard">
    <header><div><p>VIRAL LAB</p><h1>运营后台</h1></div><button @click="emit('back')">返回工作台</button></header>
    <section class="filters">
      <label>开始日期<input v-model="filters.from" type="date"></label>
      <label>结束日期<input v-model="filters.to" type="date"></label>
      <label>模型<select v-model="filters.modelId" :disabled="modelsLoading"><option value="">全部模型</option><option v-for="model in models" :key="model.id" :value="model.id">{{ model.label }}（{{ model.id }}）</option></select><small v-if="modelsLoading">模型加载中…</small><small v-else-if="modelsError" class="filter-error">{{ modelsError }} <button type="button" @click="loadModels">重试</button></small></label>
      <label>任务状态<select v-model="filters.taskStatus"><option value="">全部状态</option><option v-for="status in taskStatusOptions" :key="status.value" :value="status.value">{{ status.label }}</option></select></label>
      <button :disabled="loading" @click="pagination.page = 1; load()">{{ loading ? '加载中…' : '查询' }}</button>
    </section>
    <div v-if="error" class="state error">{{ error }} <button @click="load">重试</button></div>
    <div v-else-if="loading && !overview" class="state">正在加载运营数据…</div>
    <template v-else-if="overview">
      <section class="metric-grid">
        <article><span>注册用户</span><strong>{{ overview.users.registered }}</strong><small>新增 {{ overview.users.newUsers }} · 活跃 {{ overview.users.activeUsers }}</small></article>
        <article><span>新建项目</span><strong>{{ overview.projects.created }}</strong><small>有效 {{ overview.projects.valid }} · 人均 {{ number(overview.projects.averagePerUser) }}</small></article>
        <article><span>任务成功率</span><strong>{{ percent(overview.tasks.successRate) }}</strong><small>成功 {{ overview.tasks.success }} · 失败 {{ overview.tasks.failed }}</small></article>
        <article><span>平均生成耗时</span><strong>{{ number(overview.tasks.averageSeconds) }}s</strong><small>P50 {{ number(overview.tasks.p50Seconds) }}s · P90 {{ number(overview.tasks.p90Seconds) }}s</small></article>
        <article><span>总积分消耗</span><strong>{{ number(overview.billing.consumed) }}</strong><small>冻结 {{ number(overview.billing.frozen) }} · 退款 {{ number(overview.billing.refunded) }}</small></article>
        <article><span>导出率</span><strong>{{ percent(overview.quality.exportRate) }}</strong><small>播放 {{ percent(overview.quality.playRate) }} · 再生成 {{ percent(overview.quality.regenerateRate) }}</small></article>
      </section>
      <section class="panel"><h2>核心漏斗</h2><div class="funnel"><div v-for="item in overview.funnel" :key="item.eventName"><span>{{ item.eventName }}</span><strong>{{ item.users }}</strong></div></div></section>
      <section class="two-columns">
        <article class="panel"><h2>模型数据</h2><table><thead><tr><th>模型</th><th>调用</th><th>成功</th><th>失败</th><th>均耗时</th><th>总成本</th></tr></thead><tbody><tr v-for="item in overview.models" :key="item.model_id"><td>{{ item.model_id }}</td><td>{{ item.calls }}</td><td>{{ item.successes }}</td><td>{{ item.failures }}</td><td>{{ number(item.avg_seconds) }}s</td><td>{{ number(item.total_cost) }}</td></tr></tbody></table></article>
        <article class="panel"><h2>失败原因排行</h2><ol><li v-for="item in overview.failures" :key="`${item.error_code}:${item.error_message}`"><span>{{ item.error_code }} · {{ item.error_message }}</span><strong>{{ item.count }}</strong></li></ol></article>
      </section>
      <section v-if="stability.storageAudits?.length" class="panel"><h2>Storage异常</h2><table><thead><tr><th>类型</th><th>路径</th><th>发现时间</th><th>处理</th></tr></thead><tbody><tr v-for="audit in stability.storageAudits" :key="audit.id"><td>{{ audit.audit_type }}</td><td>{{ audit.storage_path }}</td><td>{{ new Date(audit.detected_at).toLocaleString() }}</td><td><button v-if="audit.audit_type === 'orphan_file'" @click="handleAudit(audit, 'delete_orphan')">清理孤儿文件</button><button v-else @click="handleAudit(audit, 'mark_asset_failed')">标记Asset异常</button><button @click="handleAudit(audit, 'ignore')">忽略</button></td></tr></tbody></table></section>
      <section class="two-columns">
        <article class="panel"><h2>稳定性状态</h2><div class="stability-actions"><button :disabled="storageScanning" @click="runStorageScan">{{ storageScanning ? '正在扫描…' : '扫描Storage一致性' }}</button><span v-if="storageScanResult">缺失 {{ storageScanResult.missing }} · 孤儿 {{ storageScanResult.orphaned }}</span></div><dl class="stability-list"><div><dt>服务进程</dt><dd>{{ stability.health?.process?.ok ? '正常' : '异常' }}</dd></div><div><dt>数据库</dt><dd>{{ stability.health?.database?.ok ? '正常' : '异常' }}</dd></div><div><dt>Storage</dt><dd>{{ stability.health?.storage?.ok ? '正常' : '异常' }}</dd></div><div><dt>模型配置</dt><dd>{{ stability.health?.modelService?.ok ? '正常' : '异常' }}</dd></div><div><dt>最近错误</dt><dd>{{ stability.logs?.length || 0 }}</dd></div><div><dt>失败/超时任务</dt><dd>{{ stability.tasks?.length || 0 }}</dd></div><div><dt>Storage异常</dt><dd>{{ stability.storageAudits?.length || 0 }}</dd></div><div><dt>重试任务</dt><dd>{{ tasks.filter((task) => Number(task.retry_count) > 0).length }}</dd></div></dl></article>
        <article class="panel"><h2>最近错误</h2><ol><li v-for="item in (stability.logs || []).slice(0, 10)" :key="item.log_id"><span>{{ item.error_code || item.action }} · {{ item.error_message || item.status }}</span><strong>{{ new Date(item.timestamp).toLocaleTimeString() }}</strong></li><li v-if="!stability.logs?.length"><span>暂无错误</span></li></ol></article>
      </section>
      <section class="panel"><h2>任务数据</h2><table><thead><tr><th>创建时间</th><th>类型</th><th>状态</th><th>阶段</th><th>模型</th><th>失败原因</th></tr></thead><tbody><tr v-for="task in tasks" :key="task.id"><td>{{ new Date(task.created_at).toLocaleString() }}</td><td>{{ task.task_type }}</td><td>{{ task.status }}</td><td>{{ task.stage }}</td><td>{{ task.input_data?.config?.model_id || '-' }}</td><td>{{ task.error_code || '-' }}</td></tr></tbody></table><footer><button :disabled="pagination.page <= 1" @click="changePage(-1)">上一页</button><span>第 {{ pagination.page }} 页 · 共 {{ pagination.total }} 条</span><button :disabled="pagination.page * pagination.pageSize >= pagination.total" @click="changePage(1)">下一页</button></footer></section>
    </template>
  </main>
</template>

<style scoped>
.admin-dashboard{min-height:100vh;padding:32px;color:#edf5f1;background:#090b0a;font-family:Inter,system-ui,sans-serif}.admin-dashboard>header,.filters,.panel,.metric-grid article{border:1px solid rgba(255,255,255,.1);background:#121513;border-radius:14px}.admin-dashboard>header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px}.admin-dashboard h1,.admin-dashboard h2,.admin-dashboard p{margin:0}.admin-dashboard header p{color:#35f59a;font-size:11px;font-weight:800;letter-spacing:.16em}.admin-dashboard button,.admin-dashboard input,.admin-dashboard select{height:36px;padding:0 12px;border:1px solid rgba(255,255,255,.14);border-radius:8px;color:#eaf2ee;background:#1b201d}.filters{display:flex;align-items:end;gap:12px;margin:16px 0;padding:16px}.filters label{display:grid;gap:6px;color:#8d9892;font-size:12px}.metric-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.metric-grid article{display:grid;gap:8px;padding:18px}.metric-grid span,.metric-grid small{color:#8d9892}.metric-grid strong{font-size:28px}.panel{margin-top:16px;padding:20px;overflow:auto}.panel h2{margin-bottom:14px;font-size:16px}.funnel{display:grid;grid-template-columns:repeat(8,minmax(110px,1fr));gap:8px}.funnel div{display:grid;gap:8px;padding:12px;border-radius:9px;background:rgba(53,245,154,.07)}.funnel span{font-size:11px;color:#93a099;overflow-wrap:anywhere}.two-columns{display:grid;grid-template-columns:1.4fr 1fr;gap:16px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:10px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left}th{color:#7f8a84}.panel ol{display:grid;gap:8px;padding-left:20px}.panel li,.panel footer{display:flex;justify-content:space-between;gap:12px}.panel footer{align-items:center;margin-top:16px}.state{padding:80px;text-align:center;color:#9da7a1}.state.error{color:#ff9c9c}.stability-actions{display:flex;align-items:center;gap:12px}.stability-list{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0 0}.stability-list div{display:flex;justify-content:space-between;padding:10px;border-radius:8px;background:rgba(255,255,255,.04)}.stability-list dt{color:#8d9892}.stability-list dd{margin:0;font-weight:800}@media(max-width:1100px){.metric-grid{grid-template-columns:repeat(2,1fr)}.two-columns{grid-template-columns:1fr}.filters{flex-wrap:wrap}}
.filter-error{max-width:260px;color:#ff9c9c}.filter-error button{height:auto;padding:0;border:0;color:#ffb6b6;background:transparent;text-decoration:underline}
</style>
