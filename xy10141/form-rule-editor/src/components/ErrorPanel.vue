<template>
  <div class="card">
    <div class="card-header">
      <h2>规则分析</h2>
      <div class="flex gap-2">
        <span
          v-if="analysis.hasErrors"
          class="badge badge-error"
        >
          存在严重错误
        </span>
        <span
          v-else-if="analysis.hasWarnings"
          class="badge badge-warning"
        >
          存在警告
        </span>
        <span
          v-else
          class="badge badge-success"
        >
          规则正常
        </span>
      </div>
    </div>
    
    <div v-if="analysis.errors && analysis.errors.length > 0">
      <div
        v-for="(error, index) in analysis.errors"
        :key="index"
        :class="['alert', getAlertClass(error.severity)]"
      >
        <div style="flex: 1;">
          <div class="flex items-center gap-2 mb-1">
            <strong>{{ getErrorSeverityLabel(error.severity) }}</strong>
            <span class="text-sm text-gray">{{ error.type }}</span>
          </div>
          <div>{{ error.message }}</div>
          
          <div v-if="error.path && error.path.length > 0" class="mt-2">
            <span class="text-sm">循环路径: </span>
            <span class="text-sm" style="font-family: monospace;">
              {{ error.path.join(' → ') }}
            </span>
          </div>
          
          <div v-if="error.rules && error.rules.length > 0" class="mt-2">
            <span class="text-sm">涉及规则: </span>
            <span class="text-sm" style="font-family: monospace;">
              {{ error.rules.join(', ') }}
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="text-center text-gray py-8">
      <p>🎉 未检测到错误</p>
      <p class="text-sm mt-2">您的规则配置看起来没有问题</p>
    </div>
    
    <div v-if="analysis.cycles && analysis.cycles.length > 0" class="mt-4">
      <div class="divider"></div>
      <h3 class="mb-2">循环依赖详情</h3>
      <div
        v-for="(cycle, index) in analysis.cycles"
        :key="index"
        class="alert alert-error"
      >
        <div>
          <strong>循环 {{ index + 1 }}:</strong>
          <div class="mt-1" style="font-family: monospace;">
            {{ cycle.path.join(' → ') }}
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="analysis.conflicts && analysis.conflicts.length > 0" class="mt-4">
      <div class="divider"></div>
      <h3 class="mb-2">冲突详情</h3>
      <div
        v-for="(conflict, index) in analysis.conflicts"
        :key="index"
        :class="['alert', getAlertClass(conflict.severity)]"
      >
        <div>
          <strong>{{ getConflictTypeLabel(conflict.type) }}</strong>
          <div class="mt-1">{{ conflict.message }}</div>
          <div v-if="conflict.fieldName" class="mt-1 text-sm">
            字段: {{ conflict.fieldName }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  analysis: {
    type: Object,
    required: true
  }
})

function getAlertClass(severity) {
  const classes = {
    error: 'alert-error',
    high: 'alert-error',
    medium: 'alert-warning',
    warning: 'alert-warning',
    info: 'alert-info'
  }
  return classes[severity] || 'alert-warning'
}

function getErrorSeverityLabel(severity) {
  const labels = {
    error: '错误',
    high: '严重',
    medium: '中等',
    warning: '警告',
    info: '提示'
  }
  return labels[severity] || '未知'
}

function getConflictTypeLabel(type) {
  const labels = {
    cycle: '循环依赖',
    visibility_conflict: '显隐冲突',
    required_conflict: '必填冲突',
    hidden_required_conflict: '隐藏必填冲突',
    self_reference: '自引用',
    missing_field: '缺失字段',
    missing_target_field: '缺失目标字段'
  }
  return labels[type] || type
}
</script>
