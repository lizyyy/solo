<template>
  <div class="card">
    <h2 class="card-title">🚀 选择任务场景</h2>
    <p class="text-muted mb-6">
      每个场景都包含不同的挑战和边界条件。仔细分析能源需求，制定合理的配平策略。
    </p>
    
    <div class="scenario-grid">
      <div 
        v-for="scenario in scenarios" 
        :key="scenario.id"
        class="scenario-card"
        :class="{ selected: selectedScenario === scenario.id }"
        @click="$emit('select', scenario.id)"
      >
        <div class="flex justify-between items-start mb-3">
          <h3 class="font-semibold">{{ scenario.name }}</h3>
          <span class="difficulty-badge" :class="'difficulty-' + scenario.difficulty">
            {{ getDifficultyText(scenario.difficulty) }}
          </span>
        </div>
        
        <p class="text-sm text-muted mb-3">{{ scenario.description }}</p>
        
        <div v-if="scenario.features" class="mb-4">
          <span 
            v-for="feature in scenario.features" 
            :key="feature"
            class="feature-tag"
          >
            {{ feature }}
          </span>
        </div>
        
        <div class="flex justify-between items-center">
          <span class="text-sm text-muted">
            边界案例: {{ getBoundaryCases(scenario.id).length }}
          </span>
        </div>
      </div>
    </div>
    
    <div class="flex justify-center mt-6">
      <button 
        class="btn btn-primary text-lg px-8 py-3"
        @click="$emit('start')"
      >
        🎮 开始任务
      </button>
    </div>
    
    <div class="mt-6 p-4 bg-secondary rounded-lg">
      <h4 class="font-semibold mb-2">📋 任务说明</h4>
      <ul class="text-sm text-muted space-y-1">
        <li>• 每回合代表1小时，需要完成24回合的配平任务</li>
        <li>• 太阳角度每回合变化15°，影响太阳能发电效率</li>
        <li>• 负载按优先级供电，关键负载断电超过3回合则任务失败</li>
        <li>• 电池过放会导致永久性容量损失</li>
        <li>• 随机事件可能损坏设备，需要灵活应对</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
defineProps({
  scenarios: {
    type: Array,
    required: true
  },
  selectedScenario: {
    type: String,
    required: true
  }
})

defineEmits(['select', 'start'])

function getDifficultyText(difficulty) {
  const texts = {
    easy: '入门',
    medium: '中等',
    hard: '困难',
    expert: '专家'
  }
  return texts[difficulty] || difficulty
}

function getBoundaryCases(scenarioId) {
  const cases = {
    basic: ['太阳角度变化', '昼夜循环'],
    low_battery: ['电池过放', '低电量启动', '太阳角度不利'],
    meteor: ['设备损坏', '发电能力下降', '结构损伤'],
    eclipse: ['零太阳能', '纯电池放电', '额外负载'],
    overload: ['负载过载', '优先级权衡', '多设备竞争'],
    thermal: ['电池过热', '过充保护', '温度管理']
  }
  return cases[scenarioId] || []
}
</script>
