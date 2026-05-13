export function buildDependencyGraph(rules) {
  const nodes = new Set()
  const edges = []
  const dependencies = new Map()
  const dependents = new Map()
  
  rules.forEach(rule => {
    if (!rule.enabled) return
    
    const targetField = rule.targetField
    nodes.add(targetField)
    
    if (!dependencies.has(targetField)) {
      dependencies.set(targetField, new Set())
    }
    
    rule.conditions.forEach(condition => {
      const sourceField = condition.fieldId
      
      if (rule.type === 'validation' && sourceField === targetField) {
        return
      }
      
      nodes.add(sourceField)
      
      dependencies.get(targetField).add(sourceField)
      
      if (!dependents.has(sourceField)) {
        dependents.set(sourceField, new Set())
      }
      dependents.get(sourceField).add(targetField)
      
      edges.push({
        id: `${sourceField}_${targetField}_${rule.id}`,
        from: sourceField,
        to: targetField,
        ruleId: rule.id,
        ruleType: rule.type
      })
    })
  })
  
  return {
    nodes: Array.from(nodes),
    edges,
    dependencies,
    dependents
  }
}

export function detectCycles(graph) {
  const { nodes, dependencies } = graph
  const cycles = []
  const visited = new Set()
  const recStack = new Map()
  
  function dfs(node, path = []) {
    visited.add(node)
    recStack.set(node, path)
    
    const deps = dependencies.get(node) || new Set()
    
    for (const dep of deps) {
      const currentPath = [...path, node]
      
      if (recStack.has(dep)) {
        const cyclePath = [...currentPath, dep]
        const cycleStartIndex = cyclePath.indexOf(dep)
        const cycle = cyclePath.slice(cycleStartIndex)
        
        if (cycle.length >= 2) {
          cycles.push({
            path: cycle,
            description: `循环依赖: ${cycle.join(' -> ')}`
          })
        }
        continue
      }
      
      if (!visited.has(dep)) {
        dfs(dep, currentPath)
      }
    }
    
    recStack.delete(node)
  }
  
  nodes.forEach(node => {
    if (!visited.has(node)) {
      dfs(node)
    }
  })
  
  const uniqueCycles = []
  const seenCycles = new Set()
  
  cycles.forEach(cycle => {
    const pathKey = cycle.path.join('->')
    const reversedKey = [...cycle.path].reverse().join('->')
    
    if (!seenCycles.has(pathKey) && !seenCycles.has(reversedKey)) {
      seenCycles.add(pathKey)
      uniqueCycles.push(cycle)
    }
  })
  
  return uniqueCycles
}

export function detectConflicts(rules, fields) {
  const conflicts = []
  const fieldMap = new Map(fields.map(f => [f.id, f]))
  
  const groupedByTarget = new Map()
  rules.forEach(rule => {
    if (!rule.enabled) return
    
    if (!groupedByTarget.has(rule.targetField)) {
      groupedByTarget.set(rule.targetField, [])
    }
    groupedByTarget.get(rule.targetField).push(rule)
  })
  
  groupedByTarget.forEach((targetRules, targetField) => {
    const visibilityRules = targetRules.filter(r => r.type === 'visibility')
    const requiredRules = targetRules.filter(r => r.type === 'required')
    const validationRules = targetRules.filter(r => r.type === 'validation')
    
    if (visibilityRules.length > 1) {
      visibilityRules.forEach((rule1, i) => {
        visibilityRules.forEach((rule2, j) => {
          if (i >= j) return
          
          if (rule1.action.visible !== rule2.action.visible) {
            const fieldName = fieldMap.get(targetField)?.name || targetField
            conflicts.push({
              type: 'visibility_conflict',
              severity: 'high',
              fieldId: targetField,
              fieldName,
              rules: [rule1.id, rule2.id],
              message: `字段「${fieldName}」存在冲突的显隐规则，可能导致行为不确定`
            })
          }
        })
      })
    }
    
    if (requiredRules.length > 1) {
      requiredRules.forEach((rule1, i) => {
        requiredRules.forEach((rule2, j) => {
          if (i >= j) return
          
          if (rule1.action.required !== rule2.action.required) {
            const fieldName = fieldMap.get(targetField)?.name || targetField
            conflicts.push({
              type: 'required_conflict',
              severity: 'medium',
              fieldId: targetField,
              fieldName,
              rules: [rule1.id, rule2.id],
              message: `字段「${fieldName}」存在冲突的必填规则，可能导致行为不确定`
            })
          }
        })
      })
    }
    
    const hiddenAndRequired = visibilityRules.some(r => !r.action.visible) &&
                              requiredRules.some(r => r.action.required)
    if (hiddenAndRequired) {
      const fieldName = fieldMap.get(targetField)?.name || targetField
      conflicts.push({
        type: 'hidden_required_conflict',
        severity: 'warning',
        fieldId: targetField,
        fieldName,
        message: `字段「${fieldName}」同时被设置为隐藏和必填，隐藏字段不应要求必填`
      })
    }
  })
  
  rules.forEach(rule => {
    if (!rule.enabled) return
    
    if (rule.type === 'validation') {
      return
    }
    
    const hasSelfReference = rule.conditions.some(c => c.fieldId === rule.targetField)
    if (hasSelfReference) {
      const fieldName = fieldMap.get(rule.targetField)?.name || rule.targetField
      conflicts.push({
        type: 'self_reference',
        severity: 'high',
        fieldId: rule.targetField,
        fieldName,
        rules: [rule.id],
        message: `规则引用了自身字段「${fieldName}」，这会导致不可预测的行为`
      })
    }
    
    rule.conditions.forEach(condition => {
      const fieldExists = fieldMap.has(condition.fieldId)
      if (!fieldExists) {
        conflicts.push({
          type: 'missing_field',
          severity: 'error',
          fieldId: condition.fieldId,
          rules: [rule.id],
          message: `规则引用了不存在的字段 ID: ${condition.fieldId}`
        })
      }
    })
    
    const targetExists = fieldMap.has(rule.targetField)
    if (!targetExists) {
      conflicts.push({
        type: 'missing_target_field',
        severity: 'error',
        fieldId: rule.targetField,
        rules: [rule.id],
        message: `规则目标字段不存在: ${rule.targetField}`
      })
    }
  })
  
  return conflicts
}

export function analyzeAll(rules, fields) {
  const graph = buildDependencyGraph(rules)
  const cycles = detectCycles(graph)
  const conflicts = detectConflicts(rules, fields)
  
  const errors = [
    ...cycles.map(cycle => ({
      type: 'cycle',
      severity: 'high',
      message: cycle.description,
      path: cycle.path
    })),
    ...conflicts
  ]
  
  const hasErrors = errors.some(e => e.severity === 'error' || e.severity === 'high')
  const hasWarnings = errors.some(e => e.severity === 'warning' || e.severity === 'medium')
  
  return {
    graph,
    cycles,
    conflicts,
    errors,
    hasErrors,
    hasWarnings,
    isValid: !hasErrors
  }
}

export function getFieldDependencyChain(fieldId, graph) {
  const { dependencies } = graph
  const chain = []
  const visited = new Set()
  
  function collectDeps(id) {
    if (visited.has(id)) return
    visited.add(id)
    
    const deps = dependencies.get(id) || new Set()
    deps.forEach(dep => {
      if (!visited.has(dep)) {
        chain.push(dep)
        collectDeps(dep)
      }
    })
  }
  
  collectDeps(fieldId)
  return chain
}

export function getFieldDependentChain(fieldId, graph) {
  const { dependents } = graph
  const chain = []
  const visited = new Set()
  
  function collectDependents(id) {
    if (visited.has(id)) return
    visited.add(id)
    
    const deps = dependents.get(id) || new Set()
    deps.forEach(dep => {
      if (!visited.has(dep)) {
        chain.push(dep)
        collectDependents(dep)
      }
    })
  }
  
  collectDependents(fieldId)
  return chain
}
