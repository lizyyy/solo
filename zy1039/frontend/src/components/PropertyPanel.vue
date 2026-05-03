<template>
  <div class="property-panel">
    <div v-if="!selectedState && !selectedTransition" class="empty-state">
      <el-icon class="empty-icon"><Mouse /></el-icon>
      <div class="empty-title">点击状态或边查看详情</div>
      <div class="empty-desc">在状态图中选择一个状态或转换</div>
    </div>
    
    <div v-else-if="selectedState && machine">
      <div class="property-section">
        <div class="section-title">
          <el-icon><OfficeBuilding /></el-icon>
          状态属性
        </div>
        
        <div class="property-row">
          <span class="property-label">状态ID:</span>
          <span class="property-value">
            <code>{{ selectedState }}</code>
          </span>
        </div>
        
        <div class="property-row">
          <span class="property-label">名称:</span>
          <span class="property-value">{{ stateInfo?.name || '-' }}</span>
        </div>
        
        <div class="property-row">
          <span class="property-label">类型:</span>
          <span class="property-value">
            <span class="type-tag" :class="stateInfo?.type">
              {{ getStateTypeLabel(stateInfo?.type) }}
            </span>
          </span>
        </div>
        
        <div class="property-row" v-if="stateInfo?.description">
          <span class="property-label">描述:</span>
          <span class="property-value">{{ stateInfo.description }}</span>
        </div>
      </div>
      
      <div class="property-section" v-if="outTransitions.length > 0">
        <div class="section-title">
          <el-icon><Share /></el-icon>
          出转换 ({{ outTransitions.length }})
        </div>
        
        <div class="transitions-list">
          <div
            v-for="(transition, index) in outTransitions"
            :key="index"
            class="transition-item"
            :class="{ selected: isTransitionSelected(transition) }"
          >
            <div class="transition-event">
              <el-icon><Lightning /></el-icon>
              {{ transition.event }}
            </div>
            <div class="transition-target">
              目标: <span class="target-name">{{ transition.target }}</span>
              ({{ machine.states[transition.target]?.name }})
            </div>
            <div v-if="transition.description" class="transition-target">
              {{ transition.description }}
            </div>
            <div v-if="transition.guard" class="transition-guard">
              <el-icon><Key /></el-icon>
              <strong>守卫条件:</strong>
              <div v-if="transition.guard.description">
                {{ transition.guard.description }}
              </div>
              <div v-if="transition.guard.condition">
                <code>{{ transition.guard.condition }}</code>
              </div>
            </div>
            <div v-if="transition.actions?.length > 0" style="margin-top: 8px;">
              <el-icon><List /></el-icon>
              <strong>动作:</strong>
              <div style="margin-top: 4px; padding-left: 20px;">
                <div v-for="(action, i) in transition.actions" :key="i">
                  • {{ action }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="property-section" v-if="inTransitions.length > 0">
        <div class="section-title">
          <el-icon><Connection /></el-icon>
          入转换 ({{ inTransitions.length }})
        </div>
        
        <div class="transitions-list">
          <div
            v-for="(transition, index) in inTransitions"
            :key="index"
            class="transition-item"
          >
            <div class="transition-event">
              <el-icon><Lightning /></el-icon>
              {{ transition.event }}
            </div>
            <div class="transition-target">
              来源: <span class="target-name">{{ transition.source }}</span>
              ({{ machine.states[transition.source]?.name }})
            </div>
            <div v-if="transition.description" class="transition-target">
              {{ transition.description }}
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else-if="selectedTransition && machine">
      <div class="property-section">
        <div class="section-title">
          <el-icon><Share /></el-icon>
          转换属性
        </div>
        
        <div class="property-row">
          <span class="property-label">事件:</span>
          <span class="property-value">
            <code>{{ selectedTransition.label || selectedTransition.event }}</code>
          </span>
        </div>
        
        <div class="property-row">
          <span class="property-label">源状态:</span>
          <span class="property-value">
            {{ selectedTransition.from }}
            ({{ machine.states[selectedTransition.from]?.name }})
          </span>
        </div>
        
        <div class="property-row">
          <span class="property-label">目标状态:</span>
          <span class="property-value">
            {{ selectedTransition.to }}
            ({{ machine.states[selectedTransition.to]?.name }})
          </span>
        </div>
        
        <div class="property-row" v-if="selectedTransition.description">
          <span class="property-label">描述:</span>
          <span class="property-value">{{ selectedTransition.description }}</span>
        </div>
      </div>
      
      <div class="property-section" v-if="selectedTransition.guard">
        <div class="section-title">
          <el-icon><Key /></el-icon>
          守卫条件
        </div>
        
        <div v-if="selectedTransition.guard.description" style="margin-bottom: 8px;">
          {{ selectedTransition.guard.description }}
        </div>
        <div v-if="selectedTransition.guard.condition">
          <div style="background: #f5f7fa; padding: 12px; border-radius: 4px; font-family: monospace;">
            {{ selectedTransition.guard.condition }}
          </div>
        </div>
      </div>
      
      <div class="property-section" v-if="selectedTransition.actions?.length > 0">
        <div class="section-title">
          <el-icon><List /></el-icon>
          执行动作
        </div>
        
        <div style="padding-left: 8px;">
          <div v-for="(action, i) in selectedTransition.actions" :key="i" style="margin-bottom: 4px;">
            <el-icon><Check /></el-icon>
            {{ action }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { StateMachine, Transition, State } from '@/api';

interface Props {
  machine: StateMachine | null;
  selectedState: string | null;
  selectedTransition: any;
}

const props = withDefaults(defineProps<Props>(), {
  machine: null,
  selectedState: null,
  selectedTransition: null
});

const stateInfo = computed<State | null>(() => {
  if (!props.machine || !props.selectedState) return null;
  return props.machine.states[props.selectedState] || null;
});

const outTransitions = computed(() => {
  if (!props.machine || !props.selectedState) return [];
  const state = props.machine.states[props.selectedState];
  if (!state) return [];
  
  const transitions: any[] = [];
  for (const [eventName, trans] of Object.entries(state.on)) {
    for (const t of trans) {
      transitions.push({
        ...t,
        event: eventName
      });
    }
  }
  return transitions;
});

const inTransitions = computed(() => {
  if (!props.machine || !props.selectedState) return [];
  
  const transitions: any[] = [];
  for (const [stateId, state] of Object.entries(props.machine.states)) {
    for (const [eventName, trans] of Object.entries(state.on)) {
      for (const t of trans) {
        if (t.target === props.selectedState) {
          transitions.push({
            ...t,
            source: stateId,
            event: eventName
          });
        }
      }
    }
  }
  return transitions;
});

const isTransitionSelected = (transition: any) => {
  if (!props.selectedTransition) return false;
  return (
    props.selectedTransition.source === transition.source &&
    props.selectedTransition.target === transition.target &&
    props.selectedTransition.event === transition.event
  );
};

const getStateTypeLabel = (type?: State['type']) => {
  switch (type) {
    case 'initial': return '初始状态';
    case 'final': return '终态';
    default: return '普通状态';
  }
};
</script>
