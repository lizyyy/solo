<template>
  <div class="lithology-log" ref="logRef">
    <div
      v-for="(box, index) in boxesWithPercentages"
      :key="box.box_number"
      class="lithology-layer"
      :class="{ 'is-selected': isBoxSelected(box.box_number) }"
      :style="{
        top: box.topPercentage + '%',
        height: box.heightPercentage + '%',
        backgroundColor: getLithologyColor(box.lithology)
      }"
      @click="onBoxClick(box)"
    >
      <div 
        class="lithology-texture"
        :style="{ background: getLithologyPattern(box.lithology) }"
      ></div>
      <div class="lithology-info">
        <div class="lithology-name">{{ box.lithology || '未命名' }}</div>
        <div class="lithology-depth">
          箱 {{ box.box_number }} | {{ box.start_depth.toFixed(1) }}-{{ box.end_depth.toFixed(1) }}m
        </div>
      </div>
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
import { computed, ref } from 'vue'

const props = defineProps({
  boxes: {
    type: Array,
    default: () => []
  },
  minDepth: {
    type: Number,
    default: 0
  },
  maxDepth: {
    type: Number,
    default: 0
  },
  selectedBoxNumber: {
    type: Number,
    default: null
  },
  highlightedRange: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['box-click'])

const logRef = ref(null)

const depthRange = computed(() => props.maxDepth - props.minDepth)

const boxesWithPercentages = computed(() => {
  if (depthRange.value <= 0) return []
  
  return props.boxes.map(box => ({
    ...box,
    topPercentage: ((box.start_depth - props.minDepth) / depthRange.value) * 100,
    heightPercentage: ((box.end_depth - box.start_depth) / depthRange.value) * 100
  }))
})

const lithologyColorMap = {
  '素填土': '#d4a574',
  '粉质黏土': '#c4956a',
  '粉土': '#b8885d',
  '残积黏性土': '#a0522d',
  '全风化花岗岩': '#8b4513',
  '强风化花岗岩': '#708090',
  '中风化花岗岩': '#696969',
  '微风化花岗岩': '#4a4a4a'
}

const lithologyPatternMap = {
  '素填土': 'repeating-linear-gradient(45deg, #d4a574, #d4a574 2px, #e8c8a0 2px, #e8c8a0 4px)',
  '粉质黏土': 'repeating-linear-gradient(90deg, #c4956a, #c4956a 3px, #d4a574 3px, #d4a574 6px)',
  '粉土': 'radial-gradient(circle, #b8885d 1px, transparent 1px)',
  '残积黏性土': 'linear-gradient(135deg, #a0522d 25%, #8b4513 25%, #8b4513 50%, #a0522d 50%, #a0522d 75%, #8b4513 75%)',
  '全风化花岗岩': 'repeating-linear-gradient(0deg, #8b4513, #8b4513 4px, #654321 4px, #654321 8px)',
  '强风化花岗岩': 'linear-gradient(45deg, #708090 25%, #5a6a7a 25%, #5a6a7a 50%, #708090 50%, #708090 75%, #5a6a7a 75%)',
  '中风化花岗岩': 'linear-gradient(135deg, #696969 25%, #555 25%, #555 50%, #696969 50%, #696969 75%, #555 75%)',
  '微风化花岗岩': 'linear-gradient(to right, #4a4a4a, #3a3a3a, #4a4a4a)'
}

function getLithologyColor(lithology) {
  if (!lithology) return '#ddd'
  return lithologyColorMap[lithology] || '#999'
}

function getLithologyPattern(lithology) {
  if (!lithology) return '#ddd'
  return lithologyPatternMap[lithology] || getLithologyColor(lithology)
}

function isBoxSelected(boxNumber) {
  return props.selectedBoxNumber === boxNumber
}

function getPercentage(depth) {
  if (depthRange.value <= 0) return 0
  return ((depth - props.minDepth) / depthRange.value) * 100
}

function getHeightPercentage(startDepth, endDepth) {
  if (depthRange.value <= 0) return 0
  return ((endDepth - startDepth) / depthRange.value) * 100
}

function onBoxClick(box) {
  emit('box-click', box)
}
</script>

<style scoped>
.lithology-layer {
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;
}

.lithology-layer:hover {
  filter: brightness(1.1);
  z-index: 2;
}

.lithology-layer.is-selected {
  z-index: 3;
  box-shadow: 0 0 0 2px #3498db;
}

.lithology-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.lithology-name {
  font-weight: 600;
  font-size: 0.8rem;
  color: #fff;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

.lithology-depth {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.3);
}
</style>
