<template>
  <div class="card">
    <h2 class="card-title">🎮 控制面板</h2>
    
    <div class="space-y-3">
      <button 
        class="btn btn-primary w-full justify-center"
        :disabled="!canAdvance || isGameOver"
        @click="$emit('advance')"
      >
        ⏭️ 下一回合
      </button>
      
      <div class="grid grid-2 gap-2">
        <button 
          class="btn btn-warning justify-center"
          @click="$emit('start-replay')"
        >
          🎬 回放
        </button>
        <button 
          class="btn btn-danger justify-center"
          @click="$emit('reset')"
        >
          🔄 重置
        </button>
      </div>
      
      <button 
        class="btn justify-center w-full"
        style="background: var(--bg-secondary); color: var(--text-primary);"
        @click="$emit('show-report')"
      >
        📄 查看报告
      </button>
    </div>
    
    <div v-if="isGameOver" class="mt-4 p-4 rounded-lg" :class="isVictory ? 'bg-green-900/30' : 'bg-red-900/30'">
      <div class="text-center">
        <div class="text-2xl mb-2">{{ isVictory ? '🎉' : '💀' }}</div>
        <div class="font-bold text-lg">{{ isVictory ? '任务完成!' : '任务失败' }}</div>
        <p class="text-sm text-muted mt-1">
          {{ isVictory ? '你成功维持了空间站24小时的运转' : '关键负载断电时间过长，乘员失活' }}
        </p>
      </div>
    </div>
    
    <div class="mt-4 p-3 bg-secondary rounded text-xs">
      <h4 class="font-semibold mb-2">💡 操作提示</h4>
      <ul class="text-muted space-y-1">
        <li>• 点击负载开关可手动切断/恢复供电</li>
        <li>• 优先保证关键负载(红色)持续供电</li>
        <li>• 太阳角度变化会影响发电效率</li>
        <li>• 电池过放会造成永久性损伤</li>
      </ul>
    </div>
    
    <div class="mt-4 p-3 bg-secondary rounded text-xs">
      <h4 class="font-semibold mb-2">🏷️ 优先级说明</h4>
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded" style="background: var(--accent-critical)"></span>
          <span>关键 - 生命维持等核心系统</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded" style="background: var(--accent-warning)"></span>
          <span>高 - 通信、计算等重要系统</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded" style="background: var(--accent-primary)"></span>
          <span>中 - 实验、照明等系统</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded" style="background: var(--text-muted)"></span>
          <span>低 - 舒适、娱乐等次要系统</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  isGameOver: {
    type: Boolean,
    default: false
  },
  canAdvance: {
    type: Boolean,
    default: true
  }
})

defineEmits(['advance', 'reset', 'show-report', 'start-replay'])

const isVictory = computed(() => props.isGameOver && props.canAdvance)
</script>
