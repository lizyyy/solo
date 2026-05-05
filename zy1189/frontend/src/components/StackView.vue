<template>
  <a-card title="栈视图" class="stack-card">
    <div class="stack-info">
      <a-descriptions :column="3" size="small">
        <a-descriptions-item label="基地址">
          <a-tag>{{ formatHex(baseAddress) }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="栈顶">
          <a-tag>{{ formatHex(topAddress) }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="栈指针">
          <a-tag color="purple">{{ formatHex(pointer) }}</a-tag>
        </a-descriptions-item>
      </a-descriptions>
    </div>
    
    <a-divider style="margin: 12px 0" />
    
    <div class="stack-visualization">
      <div class="stack-header">
        <span class="address-label">地址</span>
        <span class="content-label">内容</span>
      </div>
      
      <div class="stack-body">
        <div 
          v-for="addr in stackAddresses" 
          :key="addr"
          :class="['stack-row', { 'current': addr === pointer, 'has-frame': hasFrameAt(addr) }]"
        >
          <span class="address">{{ formatHex(addr) }}</span>
          <span class="content">
            <template v-if="hasFrameAt(addr)">
              <a-tag size="small" color="purple">{{ getFrameAt(addr)?.functionName }}</a-tag>
            </template>
            <template v-else-if="addr === pointer">
              <span class="pointer-marker">
                <caret-right-outlined /> ESP
              </span>
            </template>
            <template v-else>
              <span class="empty">...</span>
            </template>
          </span>
        </div>
      </div>
    </div>
    
    <a-divider style="margin: 12px 0" />
    
    <div class="stack-frames">
      <h4 class="frames-title">栈帧</h4>
      <a-list :data-source="frames" size="small" :pagination="false">
        <template #renderItem="{ item, index }">
          <a-list-item :class="{ 'top-frame': index === 0 }">
            <a-list-item-meta>
              <template #title>
                <span :class="['frame-name', { 'top': index === 0 }]">
                  {{ index === 0 ? '(栈顶) ' : '' }}{{ item.functionName }}
                </span>
              </template>
              <template #description>
                <div class="frame-details">
                  <span>返回地址: {{ formatHex(item.returnAddress) }}</span>
                  <a-divider type="vertical" />
                  <span>参数: {{ formatArgs(item.arguments) }}</span>
                </div>
              </template>
            </a-list-item-meta>
          </a-list-item>
        </template>
      </a-list>
      
      <a-empty v-if="frames.length === 0" description="暂无栈帧" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
    </div>
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CaretRightOutlined } from '@ant-design/icons-vue'
import { Empty } from 'ant-design-vue'
import type { Stack, StackFrame } from '@/types'

interface Props {
  stack: Stack
}

const props = defineProps<Props>()

const baseAddress = computed(() => props.stack.baseAddress)
const topAddress = computed(() => props.stack.topAddress)
const pointer = computed(() => props.stack.pointer)
const frames = computed(() => [...props.stack.frames].reverse())

const stackAddresses = computed(() => {
  const addresses: number[] = []
  const start = Math.max(baseAddress.value, pointer.value - 256)
  const end = topAddress.value
  
  for (let addr = end - 4; addr >= start; addr -= 4) {
    addresses.push(addr)
  }
  
  return addresses
})

const formatHex = (num: number): string => {
  return '0x' + num.toString(16).toUpperCase().padStart(8, '0')
}

const formatArgs = (args: Record<string, any>): string => {
  const keys = Object.keys(args)
  if (keys.length === 0) return '无'
  return keys.map(k => `${k}=${args[k]}`).join(', ')
}

const hasFrameAt = (addr: number): boolean => {
  return frames.value.some(f => {
    return addr >= Math.floor(pointer.value / 4) * 4 - (frames.value.indexOf(f) + 1) * 32 && 
           addr < Math.floor(pointer.value / 4) * 4 - frames.value.indexOf(f) * 32
  })
}

const getFrameAt = (addr: number): StackFrame | undefined => {
  const index = Math.floor((pointer.value - addr) / 32)
  if (index >= 0 && index < frames.value.length) {
    return frames.value[index]
  }
  return undefined
}
</script>

<style scoped>
.stack-card {
  margin-bottom: 16px;
}

.stack-info {
  margin-bottom: 8px;
}

.stack-visualization {
  background: #fafafa;
  border-radius: 4px;
  padding: 8px;
}

.stack-header {
  display: flex;
  padding: 4px 8px;
  background: #e6e6e6;
  border-radius: 4px 4px 0 0;
  font-weight: bold;
  font-size: 12px;
}

.address-label {
  width: 100px;
}

.content-label {
  flex: 1;
}

.stack-body {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #d9d9d9;
  border-top: none;
  border-radius: 0 0 4px 4px;
}

.stack-row {
  display: flex;
  padding: 4px 8px;
  border-bottom: 1px solid #f0f0f0;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.stack-row:last-child {
  border-bottom: none;
}

.stack-row.current {
  background: #e6f7ff;
}

.stack-row.has-frame {
  background: #f6ffed;
}

.stack-row .address {
  width: 100px;
  color: #666;
}

.stack-row .content {
  flex: 1;
}

.pointer-marker {
  color: #722ed1;
  font-weight: bold;
}

.empty {
  color: #999;
}

.frames-title {
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 8px;
  color: #666;
}

.frame-name {
  font-weight: 500;
}

.frame-name.top {
  color: #722ed1;
}

.frame-details {
  font-size: 12px;
  color: #666;
}

.top-frame {
  background: #f9f0ff;
}
</style>
