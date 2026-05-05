<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">风险概览</h2>
    
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="text-center p-4 bg-red-50 rounded-lg border border-red-200">
        <div class="text-3xl font-bold text-red-600">{{ highRiskCount }}</div>
        <div class="text-sm text-red-700 mt-1">高风险</div>
      </div>
      <div class="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <div class="text-3xl font-bold text-yellow-600">{{ mediumRiskCount }}</div>
        <div class="text-sm text-yellow-700 mt-1">中风险</div>
      </div>
      <div class="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div class="text-3xl font-bold text-blue-600">{{ lowRiskCount }}</div>
        <div class="text-sm text-blue-700 mt-1">低风险</div>
      </div>
      <div class="text-center p-4 bg-green-50 rounded-lg border border-green-200">
        <div class="text-3xl font-bold text-green-600">{{ resolvedCount }}</div>
        <div class="text-sm text-green-700 mt-1">已解决</div>
      </div>
    </div>

    <div class="space-y-3">
      <h3 class="text-sm font-medium text-gray-700">风险类型分布</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div 
          v-for="(count, type) in riskTypeCounts" 
          :key="type"
          class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
        >
          <span class="text-sm text-gray-700">{{ riskTypeLabels[type] || type }}</span>
          <span class="px-2 py-1 bg-gray-200 text-gray-800 rounded text-sm font-medium">{{ count }}</span>
        </div>
      </div>
    </div>

    <div v-if="risks.length > 0" class="mt-6">
      <h3 class="text-sm font-medium text-gray-700 mb-3">待处理风险列表</h3>
      <div class="space-y-2 max-h-64 overflow-y-auto">
        <div 
          v-for="risk in pendingRisks" 
          :key="risk.id"
          class="flex items-center justify-between p-3 rounded-lg"
          :class="getRiskLevelClass(risk.level)"
        >
          <div class="flex-1">
            <div class="flex items-center space-x-2">
              <span class="text-xs font-medium px-2 py-0.5 rounded" :class="getRiskBadgeClass(risk.level)">
                {{ getRiskLevelLabel(risk.level) }}
              </span>
              <span class="text-xs text-gray-500">{{ risk.roomName }}</span>
            </div>
            <p class="text-sm mt-1">{{ risk.description }}</p>
          </div>
          <div class="ml-4 text-xs text-gray-500">
            {{ riskTypeLabels[risk.type] || risk.type }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { riskTypeLabels } from '../utils/riskCalculator';

const props = defineProps({
  risks: {
    type: Array,
    default: () => []
  }
});

const highRiskCount = computed(() => 
  props.risks.filter(r => r.level === 'high' && r.status !== 'resolved').length
);

const mediumRiskCount = computed(() => 
  props.risks.filter(r => r.level === 'medium' && r.status !== 'resolved').length
);

const lowRiskCount = computed(() => 
  props.risks.filter(r => r.level === 'low' && r.status !== 'resolved').length
);

const resolvedCount = computed(() => 
  props.risks.filter(r => r.status === 'resolved').length
);

const pendingRisks = computed(() => 
  props.risks.filter(r => r.status !== 'resolved').sort((a, b) => {
    const levelOrder = { high: 0, medium: 1, low: 2 };
    return levelOrder[a.level] - levelOrder[b.level];
  })
);

const riskTypeCounts = computed(() => {
  const counts = {};
  props.risks.filter(r => r.status !== 'resolved').forEach(risk => {
    if (!counts[risk.type]) {
      counts[risk.type] = 0;
    }
    counts[risk.type]++;
  });
  return counts;
});

function getRiskLevelClass(level) {
  const classes = {
    high: 'bg-red-50 border border-red-200',
    medium: 'bg-yellow-50 border border-yellow-200',
    low: 'bg-blue-50 border border-blue-200'
  };
  return classes[level] || 'bg-gray-50 border border-gray-200';
}

function getRiskBadgeClass(level) {
  const classes = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-blue-100 text-blue-800'
  };
  return classes[level] || 'bg-gray-100 text-gray-800';
}

function getRiskLevelLabel(level) {
  const labels = {
    high: '高风险',
    medium: '中风险',
    low: '低风险'
  };
  return labels[level] || '未知';
}
</script>
