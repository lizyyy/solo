export class RelationshipValidator {
  static validate(contexts, rules) {
    const issues = []
    const relRules = rules?.validation?.relationships

    if (!relRules?.enabled) {
      return issues
    }

    const contextMap = new Map(contexts.map(c => [c.id, c]))
    const contextIds = new Set(contexts.map(c => c.id))

    contexts.forEach((context) => {
      const rel = context.relationships

      this.validateRelationshipReferences(rel, context, contextIds, issues)

      if (relRules.checkMutual) {
        this.validateMutualRelationships(context, rel, contextMap, issues)
      }
    })

    if (relRules.checkCyclic) {
      this.validateCyclicRelationships(contexts, issues)
    }

    if (relRules.validateCutLogic) {
      this.validateCutLogic(contexts, contextMap, issues)
    }

    return issues
  }

  static validateRelationshipReferences(rel, context, contextIds, issues) {
    const allRelatedIds = [
      ...rel.overlies,
      ...rel.underlies,
      ...rel.cuts,
      ...rel.cutBy,
      ...rel.equalTo
    ]

    allRelatedIds.forEach((relatedId) => {
      if (!contextIds.has(relatedId)) {
        issues.push({
          type: 'error',
          category: 'relationship',
          layerId: context.id,
          message: `地层 ${context.id} 引用了不存在的地层 ${relatedId}`,
          detail: `地层 ${context.id} 的关系记录中引用了地层 ${relatedId}，但该地层不存在于记录中`,
          severity: 'high'
        })
      }
    })
  }

  static validateMutualRelationships(context, rel, contextMap, issues) {
    rel.overlies.forEach((overliesId) => {
      const overliesCtx = contextMap.get(overliesId)
      if (overliesCtx && !overliesCtx.relationships.underlies.includes(context.id)) {
        issues.push({
          type: 'warning',
          category: 'relationship',
          layerId: context.id,
          message: `地层 ${context.id} 与 ${overliesId} 的叠压关系不完整`,
          detail: `地层 ${context.id} 记录叠压于 ${overliesId}，但 ${overliesId} 未记录被 ${context.id} 叠压`,
          severity: 'medium'
        })
      }
    })

    rel.underlies.forEach((underliesId) => {
      const underliesCtx = contextMap.get(underliesId)
      if (underliesCtx && !underliesCtx.relationships.overlies.includes(context.id)) {
        issues.push({
          type: 'warning',
          category: 'relationship',
          layerId: context.id,
          message: `地层 ${context.id} 与 ${underliesId} 的叠压关系不完整`,
          detail: `地层 ${context.id} 记录被 ${underliesId} 叠压，但 ${underliesId} 未记录叠压于 ${context.id}`,
          severity: 'medium'
        })
      }
    })

    rel.cuts.forEach((cutsId) => {
      const cutsCtx = contextMap.get(cutsId)
      if (cutsCtx && !cutsCtx.relationships.cutBy.includes(context.id)) {
        issues.push({
          type: 'warning',
          category: 'relationship',
          layerId: context.id,
          message: `地层 ${context.id} 与 ${cutsId} 的打破关系不完整`,
          detail: `地层 ${context.id} 记录打破 ${cutsId}，但 ${cutsId} 未记录被 ${context.id} 打破`,
          severity: 'medium'
        })
      }
    })

    rel.cutBy.forEach((cutById) => {
      const cutByCtx = contextMap.get(cutById)
      if (cutByCtx && !cutByCtx.relationships.cuts.includes(context.id)) {
        issues.push({
          type: 'warning',
          category: 'relationship',
          layerId: context.id,
          message: `地层 ${context.id} 与 ${cutById} 的打破关系不完整`,
          detail: `地层 ${context.id} 记录被 ${cutById} 打破，但 ${cutById} 未记录打破 ${context.id}`,
          severity: 'medium'
        })
      }
    })

    rel.equalTo.forEach((equalId) => {
      const equalCtx = contextMap.get(equalId)
      if (equalCtx && !equalCtx.relationships.equalTo.includes(context.id)) {
        issues.push({
          type: 'warning',
          category: 'relationship',
          layerId: context.id,
          message: `地层 ${context.id} 与 ${equalId} 的等同关系不完整`,
          detail: `地层 ${context.id} 记录等同于 ${equalId}，但 ${equalId} 未记录等同于 ${context.id}`,
          severity: 'low'
        })
      }
    })
  }

  static validateCyclicRelationships(contexts, issues) {
    const visited = new Set()
    const recursionStack = new Set()

    const buildGraph = () => {
      const graph = new Map()
      contexts.forEach((ctx) => {
        const dependencies = [
          ...ctx.relationships.overlies,
          ...ctx.relationships.cuts
        ]
        graph.set(ctx.id, dependencies)
      })
      return graph
    }

    const graph = buildGraph()

    const hasCycle = (nodeId, path = []) => {
      if (recursionStack.has(nodeId)) {
        const cycleStart = path.indexOf(nodeId)
        const cyclePath = [...path.slice(cycleStart), nodeId]
        issues.push({
          type: 'error',
          category: 'relationship',
          layerId: nodeId,
          message: `检测到循环关系: ${cyclePath.join(' → ')}`,
          detail: `地层关系存在循环: ${cyclePath.join(' → ')}，这在考古地层学中是不可能的`,
          severity: 'critical'
        })
        return true
      }

      if (visited.has(nodeId)) {
        return false
      }

      visited.add(nodeId)
      recursionStack.add(nodeId)
      path.push(nodeId)

      const dependencies = graph.get(nodeId) || []
      for (const dep of dependencies) {
        if (hasCycle(dep, path)) {
          return true
        }
      }

      recursionStack.delete(nodeId)
      path.pop()
      return false
    }

    contexts.forEach((ctx) => {
      if (!visited.has(ctx.id)) {
        hasCycle(ctx.id)
      }
    })
  }

  static validateCutLogic(contexts, contextMap, issues) {
    contexts.forEach((context) => {
      const cuts = context.relationships.cuts
      const cutBy = context.relationships.cutBy

      cuts.forEach((cutsId) => {
        const cutsCtx = contextMap.get(cutsId)
        if (cutsCtx) {
          if (context.elevation.top !== null && cutsCtx.elevation.top !== null) {
            if (context.elevation.top >= cutsCtx.elevation.top) {
              issues.push({
                type: 'error',
                category: 'relationship',
                layerId: context.id,
                message: `地层 ${context.id} 打破 ${cutsId} 的逻辑可能错误`,
                detail: `打破地层 ${context.id} 的顶部高程 (${context.elevation.top}m) 不应高于被打破地层 ${cutsId} 的顶部高程 (${cutsCtx.elevation.top}m)`,
                severity: 'high'
              })
            }
          }

          if (context.elevation.bottom !== null && cutsCtx.elevation.bottom !== null) {
            if (context.elevation.bottom <= cutsCtx.elevation.bottom) {
              issues.push({
                type: 'warning',
                category: 'relationship',
                layerId: context.id,
                message: `地层 ${context.id} 打破 ${cutsId} 的深度需复核`,
                detail: `打破地层 ${context.id} 的底部高程 (${context.elevation.bottom}m) 低于被打破地层 ${cutsId} 的底部高程 (${cutsCtx.elevation.bottom}m)，可能打破了更深的地层`,
                severity: 'medium'
              })
            }
          }
        }
      })

      cuts.forEach((cutsId) => {
        if (cutBy.includes(cutsId)) {
          issues.push({
            type: 'error',
            category: 'relationship',
            layerId: context.id,
            message: `地层 ${context.id} 与 ${cutsId} 存在矛盾的打破关系`,
            detail: `地层 ${context.id} 同时记录打破 ${cutsId} 和被 ${cutsId} 打破，这是矛盾的`,
            severity: 'critical'
          })
        }
      })
    })
  }
}

export default RelationshipValidator
