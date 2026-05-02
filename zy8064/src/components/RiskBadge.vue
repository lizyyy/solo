<template>
  <span class="risk-badge" :class="severity">
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  severity: {
    type: String,
    default: 'info'
  }
})

const label = computed(() => {
  switch (props.severity) {
    case 'critical': return '严重'
    case 'warning': return '警告'
    case 'info': return '信息'
    default: return '未知'
  }
})
</script>

<style scoped>
.risk-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.risk-badge.critical {
  background: #ffebee;
  color: #c62828;
}

.risk-badge.warning {
  background: #fff3e0;
  color: #ef6c00;
}

.risk-badge.info {
  background: #e3f2fd;
  color: #1565c0;
}
</style>
