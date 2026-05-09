<template>
  <div class="container">
    <div class="header">
      <h1>表单规则编排编辑器</h1>
      <p>可视化配置表单显隐、必填和联动校验规则，自动检测循环依赖和冲突</p>
    </div>
    
    <div class="tabs">
      <div
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab', activeTab === tab.id ? 'active' : '']"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </div>
    </div>
    
    <div v-if="activeTab === 'editor'">
      <div class="grid grid-2">
        <div>
          <RuleEditor
            :rules="rules"
            :fields="fields"
            @update:rules="rules = $event"
            @select-rule="selectedRule = $event"
          />
        </div>
        <div>
          <FormPreview
            :fields="fields"
            :execution-result="executionResult"
            @update:fields="fields = $event"
          />
        </div>
      </div>
    </div>
    
    <div v-if="activeTab === 'analysis'">
      <div class="grid grid-2">
        <div>
          <DependencyGraph
            :graph="analysis.graph"
            :fields="fields"
            :analysis="analysis"
            :selected-rule="selectedRule"
            @select-node="handleNodeSelect"
          />
        </div>
        <div>
          <ErrorPanel :analysis="analysis" />
        </div>
      </div>
    </div>
    
    <div v-if="activeTab === 'json'">
      <JsonEditor
        :fields="fields"
        :rules="rules"
        @update:fields="fields = $event"
        @update:rules="rules = $event"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import RuleEditor from './components/RuleEditor.vue'
import FormPreview from './components/FormPreview.vue'
import DependencyGraph from './components/DependencyGraph.vue'
import ErrorPanel from './components/ErrorPanel.vue'
import JsonEditor from './components/JsonEditor.vue'
import { executeRules } from './core/ruleEngine'
import { analyzeAll } from './core/dependencyAnalyzer'
import { sampleFields, sampleRules } from './core/sampleData'

const tabs = [
  { id: 'editor', label: '规则编辑器' },
  { id: 'analysis', label: '依赖分析' },
  { id: 'json', label: 'JSON 配置' }
]

const activeTab = ref('editor')
const selectedRule = ref(null)
const selectedNode = ref(null)

const fields = ref(JSON.parse(JSON.stringify(sampleFields)))
const rules = ref(JSON.parse(JSON.stringify(sampleRules)))

const executionResult = computed(() => {
  return executeRules(rules.value, fields.value)
})

const analysis = computed(() => {
  return analyzeAll(rules.value, fields.value)
})

function handleNodeSelect(nodeId) {
  selectedNode.value = nodeId
  
  const relatedRules = rules.value.filter(rule => {
    if (rule.targetField === nodeId) return true
    return rule.conditions.some(c => c.fieldId === nodeId)
  })
  
  if (relatedRules.length > 0) {
    selectedRule.value = relatedRules[0]
  }
}

watch(() => [fields.value, rules.value], () => {
}, { deep: true })

onMounted(() => {
  console.log('表单规则编排编辑器已启动')
  console.log('字段数量:', fields.value.length)
  console.log('规则数量:', rules.value.length)
  console.log('分析结果:', analysis.value)
})
</script>
