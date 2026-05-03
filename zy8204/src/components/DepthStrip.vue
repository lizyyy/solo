<template>
  <div class="depth-strip" ref="stripRef">
    <div
      v-for="marker in depthMarkers"
      :key="marker.depth"
      class="depth-marker"
      :style="{ top: marker.top + '%' }"
    >
      {{ marker.depth.toFixed(1) }}m
    </div>
    <div
      v-if="highlightedRange"
      class="core-box-indicator"
      :style="{
        top: getPercentage(highlightedRange.start_depth) + '%',
        height: getHeightPercentage(highlightedRange.start_depth, highlightedRange.end_depth) + '%'
      }"
    ></div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  minDepth: {
    type: Number,
    default: 0
  },
  maxDepth: {
    type: Number,
    default: 0
  },
  highlightedRange: {
    type: Object,
    default: null
  }
})

const stripRef = ref(null)

const depthRange = computed(() => props.maxDepth - props.minDepth)

const depthMarkers = computed(() => {
  const markers = []
  const range = depthRange.value
  
  if (range <= 0) return markers
  
  let interval = 1
  if (range > 50) interval = 5
  else if (range > 20) interval = 2
  
  for (let depth = props.minDepth; depth <= props.maxDepth; depth += interval) {
    const top = ((depth - props.minDepth) / range) * 100
    markers.push({
      depth,
      top: Math.max(0, Math.min(95, top))
    })
  }
  
  return markers
})

function getPercentage(depth) {
  if (depthRange.value <= 0) return 0
  return ((depth - props.minDepth) / depthRange.value) * 100
}

function getHeightPercentage(startDepth, endDepth) {
  if (depthRange.value <= 0) return 0
  return ((endDepth - startDepth) / depthRange.value) * 100
}
</script>
