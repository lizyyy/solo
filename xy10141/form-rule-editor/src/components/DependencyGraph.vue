<template>
  <div class="card">
    <div class="card-header">
      <h2>字段依赖关系图</h2>
      <div class="flex gap-2">
        <span class="badge badge-visibility">显隐</span>
        <span class="badge badge-required">必填</span>
        <span class="badge badge-validation">校验</span>
      </div>
    </div>
    <div class="dependency-graph" ref="graphContainer">
      <svg
        v-if="graph.nodes.length > 0"
        :width="graphWidth"
        :height="graphHeight"
        class="graph-edge"
      >
        <defs>
          <marker
            v-for="type in ['visibility', 'required', 'validation', 'cycle']"
            :key="type"
            :id="`arrow-${type}`"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3, 0 6"
              :class="`graph-edge-arrow edge-${type}`"
              :style="getArrowColor(type)"
            />
          </marker>
        </defs>
        <line
          v-for="edge in graph.edges"
          :key="edge.id"
          :x1="getNodePosition(edge.from).x + getNodeWidth(edge.from) / 2"
          :y1="getNodePosition(edge.from).y + 30"
          :x2="getNodePosition(edge.to).x + getNodeWidth(edge.to) / 2"
          :y2="getNodePosition(edge.to).y"
          :class="`graph-edge ${edge.ruleType} ${isInCycle(edge) ? 'cycle' : ''}`"
          :marker-end="`url(#arrow-${isInCycle(edge) ? 'cycle' : edge.ruleType})`"
        />
      </svg>
      <div
        v-if="graph.nodes.length === 0"
        class="text-center text-gray"
        style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"
      >
        <p>暂无规则依赖关系</p>
        <p class="text-sm mt-2">请先添加规则来查看依赖关系</p>
      </div>
      <div
        v-for="node in graph.nodes"
        :key="node"
        :class="['graph-node', getNodeClass(node)]"
        :style="getNodeStyle(node)"
        @click="selectNode(node)"
        :title="getNodeTitle(node)"
      >
        <div>{{ getFieldName(node) }}</div>
        <div class="text-sm" style="opacity: 0.7;">{{ getNodeInfo(node) }}</div>
      </div>
    </div>
    <div v-if="graph.nodes.length > 0" class="mt-4 text-sm text-gray text-center">
      点击节点查看详细依赖信息 | 共 {{ graph.nodes.length }} 个字段，{{ graph.edges.length }} 条依赖关系
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'

const props = defineProps({
  graph: {
    type: Object,
    required: true
  },
  fields: {
    type: Array,
    required: true
  },
  analysis: {
    type: Object,
    default: () => ({})
  },
  selectedRule: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['select-node'])

const graphContainer = ref(null)
const graphWidth = ref(800)
const graphHeight = ref(400)
const selectedNode = ref(null)

const nodePositions = ref({})
const nodeWidths = ref({})

const fieldMap = computed(() => {
  const map = new Map()
  props.fields.forEach(field => {
    map.set(field.id, field)
  })
  return map
})

const cycleNodes = computed(() => {
  if (!props.analysis.cycles) return new Set()
  const nodes = new Set()
  props.analysis.cycles.forEach(cycle => {
    cycle.path.forEach(node => nodes.add(node))
  })
  return nodes
})

function getFieldName(fieldId) {
  const field = fieldMap.value.get(fieldId)
  return field ? field.name : fieldId
}

function getNodePosition(nodeId) {
  if (!nodePositions.value[nodeId]) {
    calculateNodePositions()
  }
  return nodePositions.value[nodeId] || { x: 50, y: 50 }
}

function getNodeWidth(nodeId) {
  return nodeWidths.value[nodeId] || 120
}

function getNodeStyle(nodeId) {
  const pos = getNodePosition(nodeId)
  return {
    left: `${pos.x}px`,
    top: `${pos.y}px`
  }
}

function getNodeClass(nodeId) {
  const classes = []
  
  if (cycleNodes.value.has(nodeId)) {
    classes.push('cycle')
  }
  
  if (selectedNode.value === nodeId) {
    classes.push('selected')
  }
  
  if (props.selectedRule) {
    if (props.selectedRule.targetField === nodeId) {
      classes.push('target')
    }
    const conditionFields = props.selectedRule.conditions.map(c => c.fieldId)
    if (conditionFields.includes(nodeId)) {
      classes.push('source')
    }
  }
  
  return classes.join(' ')
}

function getNodeTitle(nodeId) {
  const deps = props.graph.dependencies.get(nodeId) || new Set()
  const dependents = props.graph.dependents.get(nodeId) || new Set()
  const field = fieldMap.value.get(nodeId)
  
  let title = `字段: ${field ? field.name : nodeId}\n`
  title += `类型: ${field ? field.type : '未知'}\n`
  title += `依赖: ${deps.size} 个字段\n`
  title += `被依赖: ${dependents.size} 个字段`
  
  return title
}

function getNodeInfo(nodeId) {
  const deps = props.graph.dependencies.get(nodeId) || new Set()
  const dependents = props.graph.dependents.get(nodeId) || new Set()
  return `↓${deps.size} ↑${dependents.size}`
}

function getArrowColor(type) {
  const colors = {
    visibility: '#3b82f6',
    required: '#f59e0b',
    validation: '#ef4444',
    cycle: '#ef4444'
  }
  return { fill: colors[type] || '#9ca3af' }
}

function isInCycle(edge) {
  if (!props.analysis.cycles) return false
  return props.analysis.cycles.some(cycle => {
    const path = cycle.path
    for (let i = 0; i < path.length - 1; i++) {
      if (path[i] === edge.from && path[i + 1] === edge.to) {
        return true
      }
    }
    return false
  })
}

function calculateNodePositions() {
  if (!graphContainer.value) return
  
  const container = graphContainer.value
  graphWidth.value = container.clientWidth
  graphHeight.value = container.clientHeight
  
  const { nodes, dependencies, dependents } = props.graph
  
  const inDegree = new Map()
  const outDegree = new Map()
  
  nodes.forEach(node => {
    inDegree.set(node, (dependencies.get(node) || new Set()).size)
    outDegree.set(node, (dependents.get(node) || new Set()).size)
  })
  
  const levels = []
  const visited = new Set()
  
  function getLevel(node, currentLevel = 0) {
    if (visited.has(node)) return
    
    const deps = dependencies.get(node) || new Set()
    
    if (deps.size === 0) {
      if (!levels[0]) levels[0] = new Set()
      levels[0].add(node)
      visited.add(node)
      return
    }
    
    let maxDepLevel = -1
    deps.forEach(dep => {
      if (!visited.has(dep)) {
        getLevel(dep, currentLevel)
      }
      const depIndex = levels.findIndex(level => level.has(dep))
      if (depIndex > maxDepLevel) {
        maxDepLevel = depIndex
      }
    })
    
    const targetLevel = maxDepLevel + 1
    if (!levels[targetLevel]) levels[targetLevel] = new Set()
    levels[targetLevel].add(node)
    visited.add(node)
  }
  
  nodes.forEach(node => getLevel(node))
  
  const padding = 20
  const levelGap = 80
  const nodeGap = 20
  
  levels.forEach((levelNodes, levelIndex) => {
    const levelArray = Array.from(levelNodes)
    const totalWidth = levelArray.reduce((sum, node) => {
      const width = Math.max(getFieldName(node).length * 12 + 32, 100)
      nodeWidths.value[node] = width
      return sum + width
    }, 0) + (levelArray.length - 1) * nodeGap
    
    let currentX = (graphWidth.value - totalWidth) / 2
    const y = padding + levelIndex * levelGap + 30
    
    levelArray.forEach(node => {
      nodePositions.value[node] = {
        x: currentX,
        y: y
      }
      currentX += nodeWidths.value[node] + nodeGap
    })
  })
  
  graphHeight.value = Math.max(400, levels.length * levelGap + padding * 2 + 60)
}

function selectNode(nodeId) {
  selectedNode.value = nodeId
  emit('select-node', nodeId)
}

onMounted(() => {
  calculateNodePositions()
  
  window.addEventListener('resize', calculateNodePositions)
})

watch(() => [props.graph, props.fields, props.selectedRule], () => {
  selectedNode.value = null
  calculateNodePositions()
}, { deep: true })
</script>
