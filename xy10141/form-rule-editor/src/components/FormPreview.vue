<template>
  <div class="card">
    <div class="card-header">
      <h2>实时预览</h2>
      <div class="flex gap-2">
        <button
          class="btn btn-sm btn-secondary"
          @click="resetForm"
        >
          重置表单
        </button>
      </div>
    </div>
    
    <div class="preview-form">
      <div
        v-for="field in fields"
        :key="field.id"
        :class="['form-group', !isFieldVisible(field.id) ? 'field-hidden' : '']"
      >
        <label
          :class="['form-label', isFieldRequired(field.id) ? 'required' : '']"
        >
          {{ field.label }}
        </label>
        
        <input
          v-if="field.type === 'text'"
          :class="['form-input', getFieldErrors(field.id).length > 0 ? 'field-error' : '']"
          type="text"
          :value="field.value"
          @input="updateFieldValue(field.id, $event.target.value)"
        />
        
        <input
          v-else-if="field.type === 'number'"
          :class="['form-input', getFieldErrors(field.id).length > 0 ? 'field-error' : '']"
          type="number"
          :value="field.value"
          @input="updateFieldValue(field.id, $event.target.value)"
        />
        
        <input
          v-else-if="field.type === 'email'"
          :class="['form-input', getFieldErrors(field.id).length > 0 ? 'field-error' : '']"
          type="email"
          :value="field.value"
          @input="updateFieldValue(field.id, $event.target.value)"
        />
        
        <input
          v-else-if="field.type === 'date'"
          :class="['form-input', getFieldErrors(field.id).length > 0 ? 'field-error' : '']"
          type="date"
          :value="field.value"
          @input="updateFieldValue(field.id, $event.target.value)"
        />
        
        <input
          v-else-if="field.type === 'file'"
          :class="['form-input', getFieldErrors(field.id).length > 0 ? 'field-error' : '']"
          type="file"
          @change="handleFileChange(field.id, $event)"
        />
        
        <select
          v-else-if="field.type === 'select'"
          :class="['form-select', getFieldErrors(field.id).length > 0 ? 'field-error' : '']"
          :value="field.value"
          @change="updateFieldValue(field.id, $event.target.value)"
        >
          <option v-for="option in field.options" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        
        <div v-else-if="field.type === 'radio'" class="radio-group">
          <label
            v-for="option in field.options"
            :key="option.value"
            class="radio-item"
          >
            <input
              type="radio"
              :name="field.id"
              :value="option.value"
              :checked="field.value === option.value"
              @change="updateFieldValue(field.id, option.value)"
            />
            <span>{{ option.label }}</span>
          </label>
        </div>
        
        <div v-else-if="field.type === 'checkbox'" class="checkbox-group">
          <label
            v-for="option in field.options"
            :key="option.value"
            class="checkbox-item"
          >
            <input
              type="checkbox"
              :checked="field.value.includes(option.value)"
              @change="handleCheckboxChange(field.id, option.value, $event.target.checked)"
            />
            <span>{{ option.label }}</span>
          </label>
        </div>
        
        <textarea
          v-else-if="field.type === 'textarea'"
          :class="['form-textarea', getFieldErrors(field.id).length > 0 ? 'field-error' : '']"
          :value="field.value"
          @input="updateFieldValue(field.id, $event.target.value)"
        ></textarea>
        
        <div
          v-for="error in getFieldErrors(field.id)"
          :key="error.ruleId"
          class="error-message"
        >
          {{ error.message }}
        </div>
      </div>
      
      <div v-if="fields.length === 0" class="text-center text-gray py-8">
        <p>暂无字段</p>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  fields: {
    type: Array,
    required: true
  },
  executionResult: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update:fields'])

function isFieldVisible(fieldId) {
  if (!props.executionResult.fieldStates) return true
  const state = props.executionResult.fieldStates[fieldId]
  return state ? state.visible : true
}

function isFieldRequired(fieldId) {
  if (!props.executionResult.fieldStates) return false
  const state = props.executionResult.fieldStates[fieldId]
  return state ? state.required : false
}

function getFieldErrors(fieldId) {
  if (!props.executionResult.fieldStates) return []
  const state = props.executionResult.fieldStates[fieldId]
  return state ? state.errors : []
}

function updateFieldValue(fieldId, value) {
  const newFields = props.fields.map(field => {
    if (field.id === fieldId) {
      return { ...field, value }
    }
    return field
  })
  emit('update:fields', newFields)
}

function handleCheckboxChange(fieldId, optionValue, checked) {
  const field = props.fields.find(f => f.id === fieldId)
  if (!field) return
  
  let newValue = [...(field.value || [])]
  
  if (checked) {
    if (!newValue.includes(optionValue)) {
      newValue.push(optionValue)
    }
  } else {
    const index = newValue.indexOf(optionValue)
    if (index !== -1) {
      newValue.splice(index, 1)
    }
  }
  
  updateFieldValue(fieldId, newValue)
}

function handleFileChange(fieldId, event) {
  const file = event.target.files[0]
  if (file) {
    updateFieldValue(fieldId, file.name)
  }
}

function resetForm() {
  const newFields = props.fields.map(field => ({
    ...field,
    value: field.type === 'checkbox' ? [] : ''
  }))
  emit('update:fields', newFields)
}
</script>
