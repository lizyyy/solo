export const RULE_TYPES = {
  VISIBILITY: 'visibility',
  REQUIRED: 'required',
  VALIDATION: 'validation'
}

export const OPERATORS = {
  EQUALS: 'equals',
  NOT_EQUALS: 'notEquals',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'notContains',
  GREATER_THAN: 'greaterThan',
  LESS_THAN: 'lessThan',
  IS_EMPTY: 'isEmpty',
  IS_NOT_EMPTY: 'isNotEmpty',
  IS_TRUE: 'isTrue',
  IS_FALSE: 'isFalse'
}

export const LOGIC_OPERATORS = {
  AND: 'and',
  OR: 'or'
}

export function createField(name, label, type = 'text', options = []) {
  return {
    id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    label,
    type,
    options,
    value: type === 'checkbox' ? [] : ''
  }
}

export function createRule(type, targetField, conditions = [], action = {}) {
  return {
    id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    targetField,
    conditions,
    logicOperator: LOGIC_OPERATORS.AND,
    action,
    enabled: true,
    priority: 0
  }
}

export function createCondition(fieldId, operator, value = null) {
  return {
    id: `condition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    fieldId,
    operator,
    value
  }
}

export function evaluateCondition(fieldValue, condition, fields) {
  const { operator, value } = condition
  
  switch (operator) {
    case OPERATORS.EQUALS:
      return fieldValue === value
    case OPERATORS.NOT_EQUALS:
      return fieldValue !== value
    case OPERATORS.CONTAINS:
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(value)
      }
      return String(fieldValue).includes(String(value))
    case OPERATORS.NOT_CONTAINS:
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(value)
      }
      return !String(fieldValue).includes(String(value))
    case OPERATORS.GREATER_THAN:
      return Number(fieldValue) > Number(value)
    case OPERATORS.LESS_THAN:
      return Number(fieldValue) < Number(value)
    case OPERATORS.IS_EMPTY:
      return fieldValue === '' || fieldValue === null || fieldValue === undefined || 
             (Array.isArray(fieldValue) && fieldValue.length === 0)
    case OPERATORS.IS_NOT_EMPTY:
      return fieldValue !== '' && fieldValue !== null && fieldValue !== undefined && 
             !(Array.isArray(fieldValue) && fieldValue.length === 0)
    case OPERATORS.IS_TRUE:
      if (Array.isArray(fieldValue)) {
        return fieldValue.length > 0 && fieldValue.some(v => v === true || v === 'true')
      }
      return fieldValue === true || fieldValue === 'true'
    case OPERATORS.IS_FALSE:
      if (Array.isArray(fieldValue)) {
        return fieldValue.length === 0 || !fieldValue.some(v => v === true || v === 'true')
      }
      return fieldValue === false || fieldValue === 'false'
    default:
      return false
  }
}

export function evaluateRule(rule, fieldValues, fields) {
  if (!rule.enabled) return null
  
  const fieldMap = new Map(fields.map(f => [f.id, f]))
  
  if (rule.conditions.length === 0) {
    return {
      triggered: true,
      targetField: rule.targetField,
      action: rule.action,
      ruleId: rule.id,
      conditions: []
    }
  }
  
  const results = rule.conditions.map(condition => {
    const fieldValue = fieldValues[condition.fieldId]
    const triggered = evaluateCondition(fieldValue, condition, fields)
    return {
      conditionId: condition.id,
      fieldId: condition.fieldId,
      fieldName: fieldMap.get(condition.fieldId)?.name || condition.fieldId,
      triggered
    }
  })
  
  let triggered
  if (rule.logicOperator === LOGIC_OPERATORS.AND) {
    triggered = results.every(r => r.triggered)
  } else {
    triggered = results.some(r => r.triggered)
  }
  
  return {
    triggered,
    targetField: rule.targetField,
    action: rule.action,
    ruleId: rule.id,
    conditions: results
  }
}

export function executeRules(rules, fields) {
  const fieldValues = {}
  const fieldStates = {}
  
  fields.forEach(field => {
    fieldValues[field.id] = field.value
    fieldStates[field.id] = {
      visible: true,
      required: false,
      errors: [],
      warnings: []
    }
  })
  
  const executionResults = []
  
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority)
  
  for (const rule of sortedRules) {
    const result = evaluateRule(rule, fieldValues, fields)
    executionResults.push(result)
    
    const targetState = fieldStates[rule.targetField]
    if (!targetState) continue
    
    switch (rule.type) {
      case RULE_TYPES.VISIBILITY:
        const wantsVisible = rule.action.visible !== false
        if (result.triggered) {
          targetState.visible = wantsVisible
        } else {
          targetState.visible = !wantsVisible
        }
        break
      case RULE_TYPES.REQUIRED:
        if (!result.triggered) continue
        targetState.required = rule.action.required !== false
        break
      case RULE_TYPES.VALIDATION:
        if (!result.triggered) continue
        if (rule.action.message) {
          targetState.errors.push({
            ruleId: rule.id,
            message: rule.action.message
          })
        }
        break
    }
  }
  
  return {
    fieldStates,
    executionResults
  }
}
