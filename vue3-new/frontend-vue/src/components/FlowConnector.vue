<script setup>
defineProps({
  paths: {
    type: Array,
    default: () => [],
  },
  width: {
    type: Number,
    default: 0,
  },
  height: {
    type: Number,
    default: 0,
  },
})
</script>

<template>
  <svg
    class="flow-connector-svg"
    :viewBox="`0 0 ${width} ${height}`"
    :width="width"
    :height="height"
    aria-hidden="true"
  >
    <template v-for="p in paths" :key="p.id">
      <path :d="p.d"></path>
      <circle :cx="p.circleStart.cx" :cy="p.circleStart.cy" r="3.5"></circle>
      <circle :cx="p.circleEnd.cx" :cy="p.circleEnd.cy" r="3.5"></circle>
    </template>
  </svg>
</template>

<style scoped>
.flow-connector-svg {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 2;
  overflow: visible;
  pointer-events: none;
}

.flow-connector-svg path {
  stroke: rgba(128, 184, 158, 0.38);
  stroke-width: 1.45;
  stroke-dasharray: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}

.flow-connector-svg circle {
  fill: rgba(190, 255, 220, 0.7);
  stroke: rgba(53, 245, 154, 0.3);
  stroke-width: 0;
}
</style>
