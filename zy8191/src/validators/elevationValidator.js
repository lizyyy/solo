export class ElevationValidator {
  static validate(contexts, rules) {
    const issues = []
    const elevationRules = rules?.validation?.elevation

    if (!elevationRules?.enabled) {
      return issues
    }

    const tolerance = elevationRules.tolerance || 0.01
    const contextMap = new Map(contexts.map(c => [c.id, c]))

    contexts.forEach((context) => {
      const top = context.elevation.top
      const bottom = context.elevation.bottom

      if (top === null || bottom === null) {
        issues.push({
          type: 'warning',
          category: 'elevation',
          layerId: context.id,
          message: `地层 ${context.id} 高程数据不完整`,
          detail: `顶部高程: ${top !== null ? top : '缺失'}, 底部高程: ${bottom !== null ? bottom : '缺失'}`,
          severity: 'low'
        })
        return
      }

      if (!elevationRules.allowInversion && bottom > top + tolerance) {
        issues.push({
          type: 'error',
          category: 'elevation',
          layerId: context.id,
          message: `地层 ${context.id} 存在高程倒挂`,
          detail: `顶部高程 (${top}m) 低于底部高程 (${bottom}m)，差值: ${(bottom - top).toFixed(2)}m`,
          severity: 'high'
        })
      }

      if (Math.abs(top - bottom) < tolerance) {
        issues.push({
          type: 'warning',
          category: 'elevation',
          layerId: context.id,
          message: `地层 ${context.id} 厚度过小`,
          detail: `地层厚度仅为 ${Math.abs(top - bottom).toFixed(2)}m，可能存在数据错误`,
          severity: 'medium'
        })
      }
    })

    if (elevationRules.checkLayerOrder) {
      const orderedContexts = [...contexts]
        .filter(c => c.elevation.top !== null && c.elevation.bottom !== null)
        .sort((a, b) => b.elevation.top - a.elevation.top)

      for (let i = 1; i < orderedContexts.length; i++) {
        const upper = orderedContexts[i - 1]
        const lower = orderedContexts[i]

        if (upper.elevation.bottom < lower.elevation.top - tolerance) {
          issues.push({
            type: 'warning',
            category: 'elevation',
            layerId: null,
            message: `地层 ${upper.id} 与 ${lower.id} 之间存在间隙`,
            detail: `地层 ${upper.id} 底部高程 (${upper.elevation.bottom}m) 低于地层 ${lower.id} 顶部高程 (${lower.elevation.top}m)`,
            severity: 'medium'
          })
        }
      }
    }

    if (elevationRules.expectedOrder && elevationRules.expectedOrder.length > 0) {
      const expectedOrder = elevationRules.expectedOrder
      const actualOrder = contexts
        .filter(c => expectedOrder.includes(c.id))
        .map(c => c.id)

      let inOrder = true
      for (let i = 0; i < expectedOrder.length - 1; i++) {
        const id1 = expectedOrder[i]
        const id2 = expectedOrder[i + 1]
        const ctx1 = contextMap.get(id1)
        const ctx2 = contextMap.get(id2)

        if (ctx1 && ctx2 && ctx1.elevation.top !== null && ctx2.elevation.top !== null) {
          if (ctx1.elevation.top < ctx2.elevation.top) {
            inOrder = false
            issues.push({
              type: 'error',
              category: 'elevation',
              layerId: id1,
              message: `地层顺序与期望不符`,
              detail: `期望 ${id1} 在 ${id2} 之上，但实际 ${id1} 顶部高程 (${ctx1.elevation.top}m) 低于 ${id2} (${ctx2.elevation.top}m)`,
              severity: 'high'
            })
          }
        }
      }
    }

    return issues
  }
}

export default ElevationValidator
