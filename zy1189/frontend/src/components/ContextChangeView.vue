<template>
  <a-card title="上下文变化" class="context-change-card">
    <a-empty 
      v-if="!selectedEvent" 
      description="选择一个事件查看上下文变化"
      :image="Empty.PRESENTED_IMAGE_SIMPLE"
    />
    
    <template v-else>
      <a-descriptions :column="1" size="small" bordered class="event-info">
        <a-descriptions-item label="事件类型">
          <a-tag :color="getEventColor(selectedEvent.type)">
            {{ getEventLabel(selectedEvent.type) }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="发生时间">
          Tick {{ selectedEvent.tick }}
        </a-descriptions-item>
        <a-descriptions-item label="描述">
          {{ selectedEvent.description }}
        </a-descriptions-item>
        <a-descriptions-item v-if="selectedEvent.taskName" label="相关任务">
          {{ selectedEvent.taskName }}
        </a-descriptions-item>
      </a-descriptions>
      
      <a-divider />
      
      <template v-if="selectedEvent.contextSnapshot">
        <h4 class="section-title">寄存器状态</h4>
        <a-table 
          :columns="regColumns" 
          :data-source="registerChanges"
          :pagination="false"
          size="small"
          :row-key="'name'"
        >
          <template #bodyCell="{ column, record }">
            <template v-else-if="column.key === 'name'">
              <span class="reg-name">{{ record.name.toUpperCase() }}</span>
            </template>
            <template v-else-if="column.key === 'value'">
              <span :class="['reg-value', { 'changed': record.changed }]">
                {{ formatHex(record.value) }}
              </span>
            </template>
          </template>
        </a-table>
        
        <a-divider />
        
        <h4 class="section-title">关键指针</h4>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-statistic title="程序计数器 (EIP)">
              <template #value>
                <a-tag color="blue">{{ formatHex(selectedEvent.contextSnapshot.programCounter) }}</a-tag>
              </template>
            </a-statistic>
          </a-col>
          <a-col :span="8">
            <a-statistic title="栈指针 (ESP)">
              <template #value>
                <a-tag color="purple">{{ formatHex(selectedEvent.contextSnapshot.stackPointer) }}</a-tag>
              </template>
            </a-statistic>
          </a-col>
          <a-col :span="8">
            <a-statistic title="执行模式">
              <template #value>
                <a-tag :color="getModeColor(selectedEvent.contextSnapshot.executionMode)">
                  {{ getModeLabel(selectedEvent.contextSnapshot.executionMode) }}
                </a-tag>
              </template>
            </a-statistic>
          </a-col>
        </a-row>
        
        <a-divider />
        
        <h4 class="section-title">栈帧</h4>
        <a-list 
          :data-source="selectedEvent.contextSnapshot.stack.frames" 
          size="small"
          :pagination="false"
        >
          <template #renderItem="{ item, index }">
            <a-list-item>
              <a-list-item-meta>
                <template #title>
                  <span :class="['frame-name', { 'top': index === 0 }]">
                    {{ index === 0 ? '(栈顶) ' : '' }}{{ item.functionName }}
                  </span>
                </template>
                <template #description>
                  <div class="frame-detail">
                    <span>返回地址: {{ formatHex(item.returnAddress) }}</span>
                    <template v-if="Object.keys(item.arguments).length > 0">
                      <a-divider type="vertical" />
                      <span>
                        参数: 
                        <a-tag 
                          v-for="(val, key) in item.arguments" 
                          :key="key"
                          size="small"
                          style="margin-left: 4px"
                        >
                          {{ key }}={{ val }}
                        </a-tag>
                      </span>
                    </template>
                  </div>
                </template>
              </a-list-item-meta>
            </a-list-item>
          </template>
        </a-list>
        
        <a-empty 
          v-if="selectedEvent.contextSnapshot.stack.frames.length === 0"
          description="暂无栈帧"
          :image="Empty.PRESENTED_IMAGE_SIMPLE"
        />
      </template>
      
      <a-empty 
        v-else-if="!selectedEvent.contextSnapshot"
        description="此事件未保存上下文快照"
        :image="Empty.PRESENTED_IMAGE_SIMPLE"
      />
      
      <a-divider />
      
      <h4 class="section-title">事件详情</h4>
      <a-card size="small" class="details-card">
        <pre>{{ formatDetails(selectedEvent.details) }}</pre>
      </a-card>
    </template>
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Empty } from 'ant-design-vue'
import type { Event, EventType, ExecutionMode, Register } from '@/types'
import { EXECUTION_MODE_LABELS, EXECUTION_MODE_COLORS } from '@/core/constants'

interface Props {
  selectedEvent: Event | null
}

const props = defineProps<Props>()

const regColumns = [
  { title: '寄存器', key: 'name', width: 100 },
  { title: '值 (十六进制)', key: 'value' }
]

const registerChanges = computed(() => {
  if (!props.selectedEvent?.contextSnapshot) return []
  
  return props.selectedEvent.contextSnapshot.registers.map(reg => ({
    ...reg,
    changed: false
  }))
})

const formatHex = (num: number): string => {
  return '0x' + num.toString(16).toUpperCase().padStart(8, '0')
}

const formatDetails = (details: Record<string, any>): string => {
  return JSON.stringify(details, null, 2)
}

const eventLabels: Record<EventType, string> = {
  [EventType.TASK_CREATE]: '任务创建',
  [EventType.TASK_START]: '任务开始',
  [EventType.CONTEXT_SWITCH]: '上下文切换',
  [EventType.SYSTEM_CALL]: '系统调用',
  [EventType.TIMER_INTERRUPT]: '定时器中断',
  [EventType.IO_START]: 'I/O 开始',
  [EventType.IO_COMPLETE]: 'I/O 完成',
  [EventType.COROUTINE_YIELD]: '协程让出',
  [EventType.COROUTINE_RESUME]: '协程恢复',
  [EventType.TASK_BLOCK]: '任务阻塞',
  [EventType.TASK_WAKEUP]: '任务唤醒',
  [EventType.TASK_TERMINATE]: '任务终止'
}

const eventColors: Record<EventType, string> = {
  [EventType.TASK_CREATE]: 'blue',
  [EventType.TASK_START]: 'green',
  [EventType.CONTEXT_SWITCH]: 'orange',
  [EventType.SYSTEM_CALL]: 'purple',
  [EventType.TIMER_INTERRUPT]: 'red',
  [EventType.IO_START]: 'cyan',
  [EventType.IO_COMPLETE]: 'cyan',
  [EventType.COROUTINE_YIELD]: 'magenta',
  [EventType.COROUTINE_RESUME]: 'magenta',
  [EventType.TASK_BLOCK]: 'red',
  [EventType.TASK_WAKEUP]: 'green',
  [EventType.TASK_TERMINATE]: 'default'
}

const getEventLabel = (type: EventType): string => eventLabels[type] || type
const getEventColor = (type: EventType): string => eventColors[type] || 'blue'
const getModeLabel = (mode: ExecutionMode): string => EXECUTION_MODE_LABELS[mode]
const getModeColor = (mode: ExecutionMode): string => EXECUTION_MODE_COLORS[mode]
</script>

<style scoped>
.context-change-card {
  height: 100%;
}

.event-info {
  margin-bottom: 12px;
}

.section-title {
  font-size: 13px;
  font-weight: bold;
  color: #666;
  margin-bottom: 8px;
}

.reg-name {
  font-family: 'Courier New', monospace;
  font-weight: bold;
}

.reg-value {
  font-family: 'Courier New', monospace;
}

.reg-value.changed {
  color: #fa8c16;
  font-weight: bold;
}

.frame-name {
  font-weight: 500;
}

.frame-name.top {
  color: #722ed1;
}

.frame-detail {
  font-size: 12px;
  color: #666;
}

.details-card {
  max-height: 200px;
  overflow: auto;
  background: #fafafa;
}

.details-card pre {
  margin: 0;
  font-size: 12px;
  white-space: pre-wrap;
}
</style>
