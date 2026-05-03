<template>
  <div class="state-graph-container" ref="containerRef">
    <svg class="graph-canvas" ref="svgRef" @wheel="handleWheel" @mousedown="handleMouseDown">
      <g :transform="`translate(${translate.x}, ${translate.y}) scale(${scale})`">
        <defs>
          <marker
            v-for="type in ['default', 'highlighted', 'selected']"
            :key="type"
            :id="`arrow-${type}`"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              :fill="getArrowColor(type)"
            />
          </marker>
        </defs>
        
        <g class="edges">
          <g
            v-for="(edge, edgeIndex) in edges"
            :key="`edge-${edgeIndex}`"
            class="edge"
            :class="{
              selected: isEdgeSelected(edge),
              highlighted: isEdgeHighlighted(edge)
            }"
            @click.stop="selectEdge(edge)"
          >
            <path
              class="edge-path"
              :d="edge.path"
              :stroke="getEdgeColor(edge)"
              stroke-width="2"
              fill="none"
              :marker-end="`url(#arrow-${getEdgeMarkerType(edge)})`"
            />
            <g
              v-if="edge.label"
              class="edge-label"
              @click.stop="selectEdge(edge)"
            >
              <rect
                :x="edge.labelX - edge.labelWidth / 2 - 4"
                :y="edge.labelY - 10"
                :width="edge.labelWidth + 8"
                height="20"
                fill="white"
                :stroke="getEdgeColor(edge)"
                stroke-width="1"
                rx="4"
              />
              <text
                :x="edge.labelX"
                :y="edge.labelY + 4"
                text-anchor="middle"
                font-size="10"
                fill="#606266"
              >
                {{ edge.label }}
              </text>
            </g>
          </g>
        </g>
        
        <g class="nodes">
          <g
            v-for="node in nodes"
            :key="`node-${node.id}`"
            class="node"
            :class="{
              selected: selectedState === node.id,
              current: currentState === node.id,
              initial: node.type === 'initial',
              final: node.type === 'final'
            }"
            @click.stop="selectNode(node.id)"
          >
            <rect
              class="node-rect"
              :x="node.x - node.width / 2"
              :y="node.y - node.height / 2"
              :width="node.width"
              :height="node.height"
              rx="8"
              fill="white"
              stroke="#909399"
              stroke-width="1.5"
            />
            <text
              :x="node.x"
              :y="node.y - 5"
              text-anchor="middle"
              font-size="12"
              font-weight="600"
              fill="#303133"
            >
              {{ node.name }}
            </text>
            <text
              :x="node.x"
              :y="node.y + 12"
              text-anchor="middle"
              font-size="10"
              fill="#909399"
            >
              {{ node.id }}
            </text>
            <circle
              v-if="node.type === 'initial'"
              :cx="node.x - node.width / 2 - 15"
              :cy="node.y"
              r="8"
              fill="#409eff"
            />
            <circle
              v-if="node.type === 'final'"
              :cx="node.x + node.width / 2 + 15"
              :cy="node.y"
              r="8"
              fill="none"
              stroke="#e6a23c"
              stroke-width="2"
            />
            <circle
              v-if="node.type === 'final'"
              :cx="node.x + node.width / 2 + 15"
              :cy="node.y"
              r="4"
              fill="#e6a23c"
            />
          </g>
        </g>
      </g>
    </svg>
    
    <div class="zoom-controls">
      <button class="zoom-btn" @click="zoomIn">+</button>
      <button class="zoom-btn" @click="zoomOut">−</button>
      <button class="zoom-btn" @click="resetView">⟲</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import * as dagre from 'dagre';
import type { StateMachine, Transition } from '@/api';

interface Props {
  machine: StateMachine | null;
  currentState: string;
  selectedState: string | null;
  selectedTransition: Transition | null;
  highlightedEdges: string[];
}

const props = withDefaults(defineProps<Props>(), {
  machine: null,
  currentState: '',
  selectedState: null,
  selectedTransition: null,
  highlightedEdges: () => []
});

const emit = defineEmits<{
  (e: 'select-state', stateId: string): void;
  (e: 'select-transition', transition: any): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);

const translate = ref({ x: 100, y: 100 });
const scale = ref(1);
const isDragging = ref(false);
const lastMousePos = ref({ x: 0, y: 0 });

interface GraphNode {
  id: string;
  name: string;
  type: 'initial' | 'final' | 'normal';
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GraphEdge {
  from: string;
  to: string;
  label: string;
  transition: Transition;
  path: string;
  labelX: number;
  labelY: number;
  labelWidth: number;
}

const nodes = ref<GraphNode[]>([]);
const edges = ref<GraphEdge[]>([]);

const computeLayout = () => {
  if (!props.machine) return;
  
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'LR',
    ranksep: 80,
    nodesep: 60,
    marginx: 50,
    marginy: 50
  });
  g.setDefaultEdgeLabel(() => ({}));
  
  const stateMap = props.machine.states;
  const allStates = Object.keys(stateMap);
  
  for (const stateId of allStates) {
    const state = stateMap[stateId];
    const nameLength = Math.max(state.name.length, stateId.length);
    const width = Math.max(120, nameLength * 10 + 40);
    
    g.setNode(stateId, {
      width,
      height: 60,
      id: stateId,
      name: state.name,
      type: state.type
    });
  }
  
  const edgeMap = new Map<string, { transitions: Transition[]; events: string[] }>();
  
  for (const stateId of allStates) {
    const state = stateMap[stateId];
    for (const [eventName, transitions] of Object.entries(state.on)) {
      for (const transition of transitions) {
        const edgeKey = `${stateId}->${transition.target}`;
        if (!edgeMap.has(edgeKey)) {
          edgeMap.set(edgeKey, {
            transitions: [],
            events: []
          });
        }
        const edgeData = edgeMap.get(edgeKey)!;
        edgeData.transitions.push(transition);
        if (!edgeData.events.includes(eventName)) {
          edgeData.events.push(eventName);
        }
      }
    }
  }
  
  let edgeIndex = 0;
  for (const [key, edgeData] of edgeMap.entries()) {
    const [from, to] = key.split('->');
    g.setEdge(from, to, {
      label: edgeData.events.length > 2 
        ? `${edgeData.events[0]},...` 
        : edgeData.events.join(','),
      transitions: edgeData.transitions,
      index: edgeIndex++
    });
  }
  
  dagre.layout(g);
  
  nodes.value = g.nodes().map((nodeId: string) => {
    const node = g.node(nodeId);
    return {
      id: nodeId,
      name: node.name,
      type: node.type,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height
    };
  });
  
  edges.value = g.edges().map((e: any) => {
    const edge = g.edge(e);
    const points = edge.points || [];
    
    let path = '';
    if (points.length > 0) {
      path = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        path += ` L ${points[i].x} ${points[i].y}`;
      }
    }
    
    const labelWidth = (edge.label?.length || 0) * 8 + 16;
    
    return {
      from: e.v,
      to: e.w,
      label: edge.label || '',
      transition: edge.transitions?.[0] || null,
      path,
      labelX: edge.x || 0,
      labelY: edge.y || 0,
      labelWidth
    };
  });
};

const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  const newScale = Math.max(0.3, Math.min(2, scale.value + delta));
  
  if (svgRef.value) {
    const rect = svgRef.value.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const oldScale = scale.value;
    scale.value = newScale;
    
    translate.value.x = mouseX - (mouseX - translate.value.x) * (newScale / oldScale);
    translate.value.y = mouseY - (mouseY - translate.value.y) * (newScale / oldScale);
  }
};

const handleMouseDown = (e: MouseEvent) => {
  if (e.button === 0) {
    isDragging.value = true;
    lastMousePos.value = { x: e.clientX, y: e.clientY };
  }
};

const handleMouseMove = (e: MouseEvent) => {
  if (isDragging.value) {
    const dx = e.clientX - lastMousePos.value.x;
    const dy = e.clientY - lastMousePos.value.y;
    
    translate.value.x += dx;
    translate.value.y += dy;
    
    lastMousePos.value = { x: e.clientX, y: e.clientY };
  }
};

const handleMouseUp = () => {
  isDragging.value = false;
};

const zoomIn = () => {
  scale.value = Math.min(2, scale.value + 0.1);
};

const zoomOut = () => {
  scale.value = Math.max(0.3, scale.value - 0.1);
};

const resetView = () => {
  scale.value = 1;
  translate.value = { x: 100, y: 100 };
};

const selectNode = (stateId: string) => {
  emit('select-state', stateId);
};

const selectEdge = (edge: GraphEdge) => {
  if (edge.transition) {
    emit('select-transition', {
      ...edge.transition,
      from: edge.from,
      to: edge.to,
      label: edge.label
    });
  }
};

const isEdgeSelected = (edge: GraphEdge) => {
  if (!props.selectedTransition) return false;
  return (
    props.selectedTransition.source === edge.from &&
    props.selectedTransition.target === edge.to
  );
};

const isEdgeHighlighted = (edge: GraphEdge) => {
  const key = `${edge.from}->${edge.to}`;
  return props.highlightedEdges.includes(key);
};

const getEdgeColor = (edge: GraphEdge) => {
  if (isEdgeHighlighted(edge)) return '#67c23a';
  if (isEdgeSelected(edge)) return '#409eff';
  return '#909399';
};

const getEdgeMarkerType = (edge: GraphEdge) => {
  if (isEdgeHighlighted(edge)) return 'highlighted';
  if (isEdgeSelected(edge)) return 'selected';
  return 'default';
};

const getArrowColor = (type: string) => {
  switch (type) {
    case 'highlighted': return '#67c23a';
    case 'selected': return '#409eff';
    default: return '#909399';
  }
};

watch(
  () => props.machine,
  () => {
    computeLayout();
  },
  { immediate: true, deep: true }
);

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
});
</script>
