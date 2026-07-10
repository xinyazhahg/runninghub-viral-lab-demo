import { ref, reactive, nextTick, onMounted, onUnmounted, readonly } from 'vue'

/**
 * 画布节点拖拽 + 动态连线系统
 *
 * 用法：
 *   const canvas = useCanvasNodes()
 *
 *   // 在模板中给节点加 ref 和 data-node-key
 *   <div ref="uploadNodeEl" data-node-key="uploadNode">...</div>
 *
 *   // 注册节点 ref
 *   canvas.registerNode('uploadNode', uploadNodeEl)
 *
 *   // 注册连线
 *   canvas.setEdges([{ source: 'uploadNode', target: 'analysisNode' }])
 *
 *   // 拖拽：在节点上绑定 pointerdown
 *   <div @pointerdown="canvas.onPointerDown($event, 'uploadNode')">
 */

export function useCanvasNodes(options = {}) {
  const storageKey = options.storageKey || ''
  // 节点 DOM 引用
  const nodeEls = reactive({})
  // 节点偏移量
  const nodeOffsets = reactive({})
  // 连线定义
  const edges = ref([])
  // SVG path 数据
  const paths = ref([])
  // SVG 尺寸
  const svgSize = reactive({ width: 0, height: 0 })
  // board ref
  let boardEl = null

  function loadSavedOffsets() {
    if (!storageKey || typeof localStorage === 'undefined') return
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
      if (!saved || typeof saved !== 'object') return
      Object.entries(saved).forEach(([key, value]) => {
        const x = Number(value?.x)
        const y = Number(value?.y)
        if (Number.isFinite(x) && Number.isFinite(y)) nodeOffsets[key] = { x, y }
      })
    } catch (error) {
      console.warn('节点布局恢复失败：', error)
    }
  }

  function persistNodeOffset(key) {
    if (!storageKey || typeof localStorage === 'undefined' || !nodeOffsets[key]) return
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
      const next = saved && typeof saved === 'object' ? saved : {}
      // 只更新本次被拖动的节点，其他节点坐标原样保留。
      next[key] = { x: nodeOffsets[key].x, y: nodeOffsets[key].y }
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch (error) {
      console.warn('节点布局保存失败：', error)
    }
  }

  function clearSavedOffsets() {
    Object.keys(nodeOffsets).forEach((key) => {
      nodeOffsets[key] = { x: 0, y: 0 }
      const el = nodeEls[key]
      if (el) el.style.transform = 'translate(0px, 0px)'
    })
    if (storageKey && typeof localStorage !== 'undefined') localStorage.removeItem(storageKey)
    updateConnectorsSync()
  }

  loadSavedOffsets()

  // ── 注册节点 ──
  function registerNode(key, el) {
    if (el) {
      nodeEls[key] = el
      if (!nodeOffsets[key]) {
        nodeOffsets[key] = { x: 0, y: 0 }
      }
      const offset = nodeOffsets[key]
      el.style.transform = `translate(${offset.x}px, ${offset.y}px)`
    }
  }

  function unregisterNode(key) {
    delete nodeEls[key]
  }

  function setBoard(el) {
    boardEl = el
  }

  // ── 设置连线（不自动触发 updateConnectors，由调用方决定时机）──
  function setEdges(edgeList) {
    const newEdges = edgeList.map((e) => ({
      id: e.id || `${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
    }))
    // 只在连线真正变化时才更新（避免相同数据重复触发）
    const oldKey = edges.value.map((e) => e.id).join(',')
    const newKey = newEdges.map((e) => e.id).join(',')
    if (oldKey !== newKey) {
      edges.value = newEdges
    }
  }

  // ── 拖拽状态 ──
  const dragState = reactive({
    active: false,
    nodeKey: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    moved: false,
    pointerId: null,
  })

  // ── 判断是否点击了交互元素 ──
  function isInteractiveTarget(target) {
    return Boolean(target.closest?.('button, input, textarea, select, a, label, .inline-picker, .copy-editor, .item-preview, .source-status, .retry-button, .restore-button, [data-action]'))
  }

  // ── 获取可拖拽节点 ──
  function getDraggableNode(event, nodeKey) {
    const el = nodeEls[nodeKey]
    if (!el) return null
    if (isInteractiveTarget(event.target)) return null
    return el
  }

  // ── pointerdown ──
  function onPointerDown(event, nodeKey) {
    if (event.button !== 0) return
    const el = getDraggableNode(event, nodeKey)
    if (!el) return

    const offset = nodeOffsets[nodeKey] || { x: 0, y: 0 }
    dragState.active = true
    dragState.nodeKey = nodeKey
    dragState.startX = event.clientX
    dragState.startY = event.clientY
    dragState.offsetX = offset.x
    dragState.offsetY = offset.y
    dragState.moved = false
    dragState.pointerId = event.pointerId

    el.classList.add('node-dragging')
  }

  // ── pointermove ──
  function onPointerMove(event) {
    if (!dragState.active) return
    const deltaX = event.clientX - dragState.startX
    const deltaY = event.clientY - dragState.startY
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) dragState.moved = true
    if (!dragState.moved) return
    event.preventDefault()

    const key = dragState.nodeKey
    const newX = dragState.offsetX + deltaX
    const newY = dragState.offsetY + deltaY
    nodeOffsets[key] = { x: newX, y: newY }

    const el = nodeEls[key]
    if (el) {
      el.style.transform = `translate(${newX}px, ${newY}px)`
    }

    updateConnectorsSync()
  }

  // ── pointerup ──
  function onPointerUp(event) {
    if (!dragState.active) return
    const key = dragState.nodeKey
    const moved = dragState.moved
    const el = nodeEls[key]
    if (el) {
      el.classList.remove('node-dragging')
    }
    dragState.active = false
    dragState.nodeKey = null
    dragState.moved = false
    dragState.pointerId = null
    if (moved && key) persistNodeOffset(key)
    updateConnectorsSync()
  }

  // ── 计算连线 ──
  let updateScheduled = false

  function updateConnectors() {
    if (updateScheduled) return
    updateScheduled = true
    requestAnimationFrame(() => {
      updateScheduled = false
      doUpdateConnectors()
    })
  }

  // 拖拽时同步更新（跳过 rAF 防抖）
  function updateConnectorsSync() {
    updateScheduled = false
    doUpdateConnectors()
  }

  function doUpdateConnectors() {
    if (!boardEl) {
      paths.value = []
      return
    }

    const boardRect = boardEl.getBoundingClientRect()
    if (!boardRect || boardRect.width === 0) {
      paths.value = []
      return
    }

    const validEdges = edges.value.filter((edge) => {
      const sourceEl = nodeEls[edge.source]
      const targetEl = nodeEls[edge.target]
      if (!sourceEl || !targetEl) return false
      const sr = sourceEl.getBoundingClientRect()
      const tr = targetEl.getBoundingClientRect()
      return sr.width > 0 && sr.height > 0 && tr.width > 0 && tr.height > 0
    })

    if (validEdges.length === 0) {
      paths.value = []
      return
    }

    // 计算 SVG 尺寸
    let maxRight = boardRect.width
    let maxBottom = boardRect.height

    for (const edge of validEdges) {
      const sourceEl = nodeEls[edge.source]
      const targetEl = nodeEls[edge.target]
      const sr = sourceEl.getBoundingClientRect()
      const tr = targetEl.getBoundingClientRect()
      maxRight = Math.max(maxRight, sr.right - boardRect.left, tr.right - boardRect.left)
      maxBottom = Math.max(maxBottom, sr.bottom - boardRect.top, tr.bottom - boardRect.top)
    }

    svgSize.width = maxRight + 80
    svgSize.height = maxBottom + 80

    // 构建贝塞尔曲线
paths.value = validEdges
  .map((edge) => {
    const sourceEl = nodeEls[edge.source]
    const targetEl = nodeEls[edge.target]

    if (
      !sourceEl ||
      !targetEl ||
      !document.body.contains(sourceEl) ||
      !document.body.contains(targetEl)
    ) {
      return null
    }

    const sr = sourceEl.getBoundingClientRect()
    const tr = targetEl.getBoundingClientRect()

      // 源节点右侧中心 → 目标节点左侧中心
      const startX = sr.right - boardRect.left
      const startY = sr.top + sr.height / 2 - boardRect.top
      const endX = tr.left - boardRect.left
      const endY = tr.top + tr.height / 2 - boardRect.top

      // 贝塞尔控制点
      const deltaX = endX - startX
      const deltaY = endY - startY
      const absX = Math.abs(deltaX)
      const absY = Math.abs(deltaY)
      const direction = deltaX >= 0 ? 1 : -1
      const handle = Math.min(120, Math.max(48, absX * 0.32))
      const yEase = absY < 40 ? 0 : Math.min(24, absY * 0.18)
      const c1x = startX + handle * direction
      const c1y = startY + Math.sign(deltaY) * yEase
      const c2x = endX - handle * direction
      const c2y = endY - Math.sign(deltaY) * yEase

      const path = `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`

      return {
        id: edge.id,
        d: path,
        circleStart: { cx: startX, cy: startY },
        circleEnd: { cx: endX, cy: endY },
      }
      })
  .filter(Boolean)
  }

  // ── 延迟更新（防重复）──
  let timerId = null

  function queueUpdate(delay = 0) {
    if (timerId) { clearTimeout(timerId); timerId = null }
    if (delay > 0) {
      timerId = setTimeout(() => {
        timerId = null
        nextTick(() => {
          if (!updateScheduled) {
            updateScheduled = true
            requestAnimationFrame(() => {
              updateScheduled = false
              doUpdateConnectors()
            })
          }
        })
      }, delay)
    } else {
      updateConnectors()
    }
  }

  // ── resize 监听（只观察 board，不观察节点，避免循环）──
  let resizeObserver = null
  let resizeRafId = null

  function startResizeObserver() {
    if (!boardEl || typeof ResizeObserver === 'undefined') return
    resizeObserver = new ResizeObserver(() => {
      if (resizeRafId) return
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = null
        updateConnectors()
      })
    })
    resizeObserver.observe(boardEl)
  }

  function stopResizeObserver() {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
  }

  function refreshObservers() {
    stopResizeObserver()
    startResizeObserver()
  }

  // ── window resize ──
  function onWindowResize() {
    updateConnectors()
  }

  onMounted(() => {
    window.addEventListener('resize', onWindowResize)
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', onWindowResize)
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    stopResizeObserver()
    if (timerId) { clearTimeout(timerId); timerId = null }
    if (resizeRafId) { cancelAnimationFrame(resizeRafId); resizeRafId = null }
  })

  return {
    nodeEls,
    nodeOffsets,
    edges,
    paths,
    svgSize,
    registerNode,
    unregisterNode,
    setBoard,
    setEdges,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    updateConnectors,
    updateConnectorsSync,
    queueUpdate,
    refreshObservers,
    clearSavedOffsets,
  }
}
