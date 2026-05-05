<template>
  <a-card title="寄存器" class="registers-card">
    <a-table 
      :columns="columns" 
      :data-source="registersList"
      :pagination="false"
      size="small"
      :row-key="'name'"
    >
      <template #bodyCell="{ column, record }">
        <template v-else-if="column.key === 'name'">
          <span :class="['register-name', record.type]">
            <component v-if="getIconName(record.type)" :is="getIconName(record.type)" />
            {{ record.name.toUpperCase() }}
          </span>
        </template>
        <template v-else-if="column.key === 'hex'">
          <span class="register-value hex">{{ formatHex(record.value) }}</span>
        </template>
        <template v-else-if="column.key === 'decimal'">
          <span class="register-value decimal">{{ record.value }}</span>
        </template>
        <template v-else-if="column.key === 'binary'">
          <span class="register-value binary">{{ formatBinary(record.value) }}</span>
        </template>
      </template>
    </a-table>
    
    <a-divider style="margin: 12px 0" />
    
    <a-descriptions :column="2" size="small">
      <a-descriptions-item label="程序计数器 (EIP)">
        <a-tag color="blue">{{ formatHex(programCounter) }}</a-tag>
      </a-descriptions-item>
      <a-descriptions-item label="栈指针 (ESP)">
        <a-tag color="purple">{{ formatHex(stackPointer) }}</a-tag>
      </a-descriptions-item>
      <a-descriptions-item label="状态字 (EFLAGS)">
        <a-tag color="orange">{{ formatHex(statusWord) }}</a-tag>
      </a-descriptions-item>
      <a-descriptions-item label="执行模式">
        <a-tag :color="getModeColor(executionMode)">
          {{ getModeLabel(executionMode) }}
        </a-tag>
      </a-descriptions-item>
    </a-descriptions>
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ProgramOutlined, SwapOutlined, FileSearchOutlined } from '@ant-design/icons-vue'
import type { Register, ExecutionMode } from '@/types'
import { EXECUTION_MODE_LABELS, EXECUTION_MODE_COLORS } from '@/core/constants'

interface Props {
  registers: Register[]
  programCounter: number
  stackPointer: number
  statusWord: number
  executionMode: ExecutionMode
}

const props = defineProps<Props>()

const registersList = computed(() => {
  return [...props.registers].sort((a, b) => {
    const order = ['eip', 'esp', 'ebp', 'eax', 'ebx', 'ecx', 'edx', 'esi', 'edi', 'eflags']
    return order.indexOf(a.name) - order.indexOf(b.name)
  })
})

const columns = [
  { title: '寄存器', key: 'name', width: 100 },
  { title: '十六进制', key: 'hex', width: 120 },
  { title: '十进制', key: 'decimal', width: 100 },
  { title: '二进制', key: 'binary' }
]

const formatHex = (num: number): string => {
  return '0x' + num.toString(16).toUpperCase().padStart(8, '0')
}

const formatBinary = (num: number): string => {
  return num.toString(2).padStart(32, '0').replace(/(.{8})/g, '$1 ').trim()
}

const getIconName = (type: string) => {
  switch (type) {
    case 'program_counter': return ProgramOutlined
    case 'stack_pointer': return SwapOutlined
    case 'status': return FileSearchOutlined
    default: return null
  }
}

const getModeLabel = (mode: ExecutionMode): string => EXECUTION_MODE_LABELS[mode]
const getModeColor = (mode: ExecutionMode): string => EXECUTION_MODE_COLORS[mode]
</script>

<style scoped>
.registers-card {
  margin-bottom: 16px;
}

.register-name {
  font-family: 'Courier New', monospace;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 4px;
}

.register-name.program_counter {
  color: #1890ff;
}

.register-name.stack_pointer {
  color: #722ed1;
}

.register-name.status {
  color: #fa8c16;
}

.register-value {
  font-family: 'Courier New', monospace;
}

.register-value.hex {
  color: #1890ff;
}

.register-value.decimal {
  color: #52c41a;
}

.register-value.binary {
  color: #722ed1;
  font-size: 11px;
}
</style>
