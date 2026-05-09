<template>
  <div class="card">
    <div class="card-header">
      <h2>规则编辑器</h2>
      <button class="btn btn-primary" @click="addNewRule">
        + 添加规则
      </button>
    </div>
    
    <div v-if="rules.length === 0" class="text-center text-gray py-8">
      <p>暂无规则</p>
      <p class="text-sm mt-2">点击上方"添加规则"按钮开始创建</p>
    </div>
    
    <div v-else>
      <div
        v-for="rule in rules"
        :key="rule.id"
        :class="['rule-item', selectedRuleId === rule.id ? 'selected' : '']"
      >
        <div class="rule-header" @click="toggleRule(rule.id)">
          <div class="flex items-center gap-2">
            <span :class="['badge', `badge-${rule.type}`]">
              {{ getRuleTypeLabel(rule.type) }}
            </span>
            <h3>{{ getRuleSummary(rule) }}</h3>
          </div>
          <div class="flex items-center gap-2">
            <label class="switch">
              <input type="checkbox" v-model="rule.enabled" @click.stop />
              <span class="switch-slider"></span>
            </label>
            <button class="btn btn-sm btn-danger" @click.stop="deleteRule(rule.id)">
              删除
            </button>
          </div>
        </div>
        
        <div v-if="expandedRules.includes(rule.id)" class="rule-body">
          <div class="grid grid-2">
            <div class="form-group">
              <label class="form-label">规则类型</label>
              <select class="form-select" v-model="rule.type">
                <option value="visibility">显隐控制</option>
                <option value="required">必填控制</option>
                <option value="validation">校验规则</option>
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label">目标字段</label>
              <select class="form-select" v-model="rule.targetField">
                <option value="">请选择字段</option>
                <option v-for="field in fields" :key="field.id" :value="field.id">
                  {{ field.name }}
                </option>
              </select>
            </div>
          </div>
          
          <div class="form-group">
            <div class="flex justify-between items-center mb-2">
              <label class="form-label mb-0">触发条件</label>
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray">所有条件满足方式：</span>
                <select class="form-select" style="width: auto;" v-model="rule.logicOperator">
                  <option value="and">全部满足 (AND)</option>
                  <option value="or">任一满足 (OR)</option>
                </select>
              </div>
            </div>
            
            <div v-if="rule.conditions.length === 0" class="text-sm text-gray text-center py-4 bg-gray-50 rounded">
              暂无条件，规则将始终触发
            </div>
            
            <div v-else>
              <div
                v-for="(condition, index) in rule.conditions"
                :key="condition.id"
                class="condition-item"
              >
                <select
                  class="form-select"
                  style="flex: 1;"
                  v-model="condition.fieldId"
                >
                  <option value="">选择字段</option>
                  <option v-for="field in fields" :key="field.id" :value="field.id">
                    {{ field.name }}
                  </option>
                </select>
                
                <select
                  class="form-select"
                  style="width: 150px;"
                  v-model="condition.operator"
                >
                  <option value="equals">等于</option>
                  <option value="notEquals">不等于</option>
                  <option value="contains">包含</option>
                  <option value="notContains">不包含</option>
                  <option value="greaterThan">大于</option>
                  <option value="lessThan">小于</option>
                  <option value="isEmpty">为空</option>
                  <option value="isNotEmpty">不为空</option>
                  <option value="isTrue">为真</option>
                  <option value="isFalse">为假</option>
                </select>
                
                <input
                  v-if="!['isEmpty', 'isNotEmpty', 'isTrue', 'isFalse'].includes(condition.operator)"
                  type="text"
                  class="form-input"
                  style="width: 150px;"
                  v-model="condition.value"
                  placeholder="值"
                />
                
                <button
                  class="btn btn-sm btn-danger"
                  @click="removeCondition(rule.id, condition.id)"
                >
                  ×
                </button>
                
                <div v-if="index < rule.conditions.length - 1" class="text-sm text-gray">
                  {{ rule.logicOperator === 'and' ? 'AND' : 'OR' }}
                </div>
              </div>
            </div>
            
            <button class="btn btn-sm btn-secondary mt-2" @click="addCondition(rule.id)">
              + 添加条件
            </button>
          </div>
          
          <div class="divider"></div>
          
          <div class="form-group">
            <label class="form-label">规则动作</label>
            
            <div v-if="rule.type === 'visibility'" class="flex items-center gap-4">
              <label class="radio-item">
                <input type="radio" v-model="rule.action.visible" :value="true" />
                <span>显示字段</span>
              </label>
              <label class="radio-item">
                <input type="radio" v-model="rule.action.visible" :value="false" />
                <span>隐藏字段</span>
              </label>
            </div>
            
            <div v-else-if="rule.type === 'required'" class="flex items-center gap-4">
              <label class="radio-item">
                <input type="radio" v-model="rule.action.required" :value="true" />
                <span>设为必填</span>
              </label>
              <label class="radio-item">
                <input type="radio" v-model="rule.action.required" :value="false" />
                <span>设为可选</span>
              </label>
            </div>
            
            <div v-else-if="rule.type === 'validation'" class="flex items-center gap-2">
              <span class="text-sm text-gray">条件满足时显示错误：</span>
              <input
                type="text"
                class="form-input"
                style="flex: 1;"
                v-model="rule.action.message"
                placeholder="请输入错误提示信息"
              />
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">优先级 (数字越小优先级越高)</label>
            <input
              type="number"
              class="form-input"
              style="width: 100px;"
              v-model.number="rule.priority"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { createRule, createCondition } from '../core/ruleEngine'

const props = defineProps({
  rules: {
    type: Array,
    required: true
  },
  fields: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['update:rules', 'select-rule'])

const selectedRuleId = ref(null)
const expandedRules = ref([])

const fieldMap = computed(() => {
  const map = new Map()
  props.fields.forEach(field => {
    map.set(field.id, field)
  })
  return map
})

function getRuleTypeLabel(type) {
  const labels = {
    visibility: '显隐',
    required: '必填',
    validation: '校验'
  }
  return labels[type] || type
}

function getRuleSummary(rule) {
  const targetField = fieldMap.value.get(rule.targetField)
  const targetName = targetField ? targetField.name : rule.targetField
  
  if (rule.type === 'visibility') {
    return `${targetName} → ${rule.action.visible ? '显示' : '隐藏'}`
  } else if (rule.type === 'required') {
    return `${targetName} → ${rule.action.required ? '必填' : '可选'}`
  } else if (rule.type === 'validation') {
    return `${targetName} → 校验: ${rule.action.message || '未设置提示'}`
  }
  
  return '未配置规则'
}

function toggleRule(ruleId) {
  const index = expandedRules.value.indexOf(ruleId)
  if (index === -1) {
    expandedRules.value.push(ruleId)
    selectedRuleId.value = ruleId
    const rule = props.rules.find(r => r.id === ruleId)
    emit('select-rule', rule)
  } else {
    expandedRules.value.splice(index, 1)
    if (selectedRuleId.value === ruleId) {
      selectedRuleId.value = null
      emit('select-rule', null)
    }
  }
}

function addNewRule() {
  if (props.fields.length === 0) {
    alert('请先添加字段')
    return
  }
  
  const newRule = createRule(
    'visibility',
    props.fields[0].id,
    [],
    { visible: true }
  )
  
  emit('update:rules', [...props.rules, newRule])
  expandedRules.value.push(newRule.id)
  selectedRuleId.value = newRule.id
}

function deleteRule(ruleId) {
  if (!confirm('确定要删除这条规则吗？')) return
  
  const newRules = props.rules.filter(r => r.id !== ruleId)
  emit('update:rules', newRules)
  
  const expandIndex = expandedRules.value.indexOf(ruleId)
  if (expandIndex !== -1) {
    expandedRules.value.splice(expandIndex, 1)
  }
  
  if (selectedRuleId.value === ruleId) {
    selectedRuleId.value = null
    emit('select-rule', null)
  }
}

function addCondition(ruleId) {
  if (props.fields.length === 0) return
  
  const rule = props.rules.find(r => r.id === ruleId)
  if (!rule) return
  
  const newCondition = createCondition(
    props.fields[0].id,
    'equals',
    ''
  )
  
  rule.conditions.push(newCondition)
  emit('update:rules', [...props.rules])
}

function removeCondition(ruleId, conditionId) {
  const rule = props.rules.find(r => r.id === ruleId)
  if (!rule) return
  
  const index = rule.conditions.findIndex(c => c.id === conditionId)
  if (index !== -1) {
    rule.conditions.splice(index, 1)
    emit('update:rules', [...props.rules])
  }
}
</script>
