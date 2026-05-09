<template>
  <div class="card">
    <div class="card-header">
      <h2>JSON 配置</h2>
      <div class="flex gap-2">
        <button class="btn btn-sm btn-secondary" @click="refreshFromEditor">
          ↺ 从编辑器刷新
        </button>
        <button class="btn btn-sm btn-success" @click="applyJson">
          ✓ 应用到编辑器
        </button>
        <button class="btn btn-sm btn-primary" @click="downloadJson">
          ⬇ 导出
        </button>
      </div>
    </div>
    
    <div class="toolbar">
      <button class="btn btn-sm btn-secondary" @click="loadSample('normal')">
        加载正常示例
      </button>
      <button class="btn btn-sm btn-warning" @click="loadSample('conflict')">
        加载冲突示例
      </button>
      <button class="btn btn-sm btn-danger" @click="loadSample('cycle')">
        加载循环示例
      </button>
    </div>
    
    <textarea
      ref="jsonTextarea"
      class="json-editor"
      v-model="jsonContent"
      @input="validateJson"
      placeholder="在此输入或粘贴 JSON 配置..."
    ></textarea>
    
    <div v-if="jsonError" class="alert alert-error mt-4">
      <div>
        <strong>JSON 格式错误:</strong>
        <div class="mt-1">{{ jsonError }}</div>
      </div>
    </div>
    
    <div v-else class="alert alert-success mt-4">
      <div>
        <strong>✓ JSON 格式正确</strong>
        <div class="mt-1 text-sm">
          {{ fields.length }} 个字段，{{ rules.length }} 条规则
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { sampleFields, sampleRules, conflictingRules, problematicRules } from '../core/sampleData'

const props = defineProps({
  fields: {
    type: Array,
    required: true
  },
  rules: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['update:fields', 'update:rules'])

const jsonTextarea = ref(null)
const jsonContent = ref('')
const jsonError = ref('')

const parsedData = computed(() => {
  try {
    if (!jsonContent.value.trim()) return null
    return JSON.parse(jsonContent.value)
  } catch (e) {
    return null
  }
})

function formatJson(data) {
  return JSON.stringify(data, null, 2)
}

function updateFromProps() {
  const config = {
    title: '表单配置',
    description: '从编辑器导出的配置',
    fields: props.fields,
    rules: props.rules,
    exportedAt: new Date().toISOString()
  }
  jsonContent.value = formatJson(config)
  jsonError.value = ''
}

function validateJson() {
  try {
    if (!jsonContent.value.trim()) {
      jsonError.value = ''
      return
    }
    const data = JSON.parse(jsonContent.value)
    
    if (!data.fields || !Array.isArray(data.fields)) {
      jsonError.value = '缺少 fields 数组'
      return
    }
    
    if (!data.rules || !Array.isArray(data.rules)) {
      jsonError.value = '缺少 rules 数组'
      return
    }
    
    jsonError.value = ''
  } catch (e) {
    jsonError.value = e.message
  }
}

function applyJson() {
  if (jsonError.value) {
    alert('请先修复 JSON 格式错误')
    return
  }
  
  if (!parsedData.value) {
    alert('JSON 内容为空')
    return
  }
  
  emit('update:fields', parsedData.value.fields || [])
  emit('update:rules', parsedData.value.rules || [])
  
  alert('配置已应用到编辑器！')
}

function refreshFromEditor() {
  updateFromProps()
}

function downloadJson() {
  if (jsonError.value) {
    alert('请先修复 JSON 格式错误')
    return
  }
  
  const blob = new Blob([jsonContent.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `form-config-${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function loadSample(type) {
  let fields = []
  let rules = []
  
  switch (type) {
    case 'normal':
      fields = JSON.parse(JSON.stringify(sampleFields))
      rules = JSON.parse(JSON.stringify(sampleRules))
      break
    case 'conflict':
      fields = JSON.parse(JSON.stringify(sampleFields))
      rules = JSON.parse(JSON.stringify(conflictingRules))
      break
    case 'cycle':
      fields = JSON.parse(JSON.stringify(sampleFields))
      rules = JSON.parse(JSON.stringify(problematicRules))
      break
  }
  
  const config = {
    title: type === 'normal' ? '正常示例配置' : 
           type === 'conflict' ? '冲突示例配置' : '循环依赖示例配置',
    description: type === 'normal' ? '这是一个正常工作的表单规则配置示例' :
                 type === 'conflict' ? '这个配置包含冲突的规则，用于演示错误检测功能' :
                 '这个配置包含循环依赖，用于演示循环检测功能',
    fields,
    rules,
    exportedAt: new Date().toISOString()
  }
  
  jsonContent.value = formatJson(config)
  jsonError.value = ''
}

watch(() => [props.fields, props.rules], () => {
  updateFromProps()
}, { deep: true, immediate: true })
</script>
