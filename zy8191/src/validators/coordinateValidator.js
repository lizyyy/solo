export class CoordinateValidator {
  static validate(finds, contexts, rules) {
    const issues = []
    const coordRules = rules?.validation?.coordinates

    if (!coordRules?.enabled) {
      return issues
    }

    const trench = rules?.trench
    const contextMap = new Map(contexts.map(c => [c.id, c]))
    const tolerance = coordRules.tolerance || 0.01

    if (coordRules.checkBounds && trench) {
      const dim = trench.dimensions

      finds.forEach((find) => {
        const coords = find.coordinates

        if (coords.x === null || coords.y === null || coords.z === null) {
          issues.push({
            type: 'warning',
            category: 'coordinate',
            findId: find.id,
            layerId: find.layerId,
            message: `出土物 ${find.id} 坐标数据不完整`,
            detail: `X: ${coords.x}, Y: ${coords.y}, Z: ${coords.z}`,
            severity: 'low'
          })
          return
        }

        if (coords.x < dim.x_min - tolerance || coords.x > dim.x_max + tolerance) {
          issues.push({
            type: 'error',
            category: 'coordinate',
            findId: find.id,
            layerId: find.layerId,
            message: `出土物 ${find.id} X坐标越界`,
            detail: `X坐标 ${coords.x} 超出探方范围 [${dim.x_min}, ${dim.x_max}]`,
            severity: 'high'
          })
        }

        if (coords.y < dim.y_min - tolerance || coords.y > dim.y_max + tolerance) {
          issues.push({
            type: 'error',
            category: 'coordinate',
            findId: find.id,
            layerId: find.layerId,
            message: `出土物 ${find.id} Y坐标越界`,
            detail: `Y坐标 ${coords.y} 超出探方范围 [${dim.y_min}, ${dim.y_max}]`,
            severity: 'high'
          })
        }

        if (coords.z < dim.z_min - tolerance || coords.z > dim.z_max + tolerance) {
          issues.push({
            type: 'error',
            category: 'coordinate',
            findId: find.id,
            layerId: find.layerId,
            message: `出土物 ${find.id} Z坐标越界`,
            detail: `Z坐标 ${coords.z} 超出探方范围 [${dim.z_min}, ${dim.z_max}]`,
            severity: 'high'
          })
        }
      })
    }

    if (coordRules.checkElevationMatch) {
      finds.forEach((find) => {
        if (!find.layerId) {
          if (!coordRules.allowOrphanFinds) {
            issues.push({
              type: 'warning',
              category: 'coordinate',
              findId: find.id,
              layerId: null,
              message: `出土物 ${find.id} 未关联地层`,
              detail: `该出土物没有关联的地层编号，建议检查记录`,
              severity: 'medium'
            })
          }
          return
        }

        const context = contextMap.get(find.layerId)
        if (!context) {
          issues.push({
            type: 'error',
            category: 'coordinate',
            findId: find.id,
            layerId: find.layerId,
            message: `出土物 ${find.id} 关联的地层 ${find.layerId} 不存在`,
            detail: `出土物记录关联地层 ${find.layerId}，但该地层不存在于 contexts.csv 中`,
            severity: 'high'
          })
          return
        }

        const coords = find.coordinates
        if (coords.z !== null && context.elevation.top !== null && context.elevation.bottom !== null) {
          if (coords.z > context.elevation.top + tolerance) {
            issues.push({
              type: 'warning',
              category: 'coordinate',
              findId: find.id,
              layerId: find.layerId,
              message: `出土物 ${find.id} 高程高于所属地层 ${find.layerId}`,
              detail: `出土物高程 ${coords.z}m 高于地层 ${find.layerId} 顶部高程 ${context.elevation.top}m`,
              severity: 'medium'
            })
          }

          if (coords.z < context.elevation.bottom - tolerance) {
            issues.push({
              type: 'warning',
              category: 'coordinate',
              findId: find.id,
              layerId: find.layerId,
              message: `出土物 ${find.id} 高程低于所属地层 ${find.layerId}`,
              detail: `出土物高程 ${coords.z}m 低于地层 ${find.layerId} 底部高程 ${context.elevation.bottom}m`,
              severity: 'medium'
            })
          }
        }

        if (coords.x !== null && coords.y !== null) {
          const geo = context.geometry
          if (geo.x_min !== null && geo.x_max !== null) {
            if (coords.x < geo.x_min - tolerance || coords.x > geo.x_max + tolerance) {
              issues.push({
                type: 'warning',
                category: 'coordinate',
                findId: find.id,
                layerId: find.layerId,
                message: `出土物 ${find.id} X坐标超出地层 ${find.layerId} 范围`,
                detail: `X坐标 ${coords.x} 超出地层范围 [${geo.x_min}, ${geo.x_max}]`,
                severity: 'medium'
              })
            }
          }

          if (geo.y_min !== null && geo.y_max !== null) {
            if (coords.y < geo.y_min - tolerance || coords.y > geo.y_max + tolerance) {
              issues.push({
                type: 'warning',
                category: 'coordinate',
                findId: find.id,
                layerId: find.layerId,
                message: `出土物 ${find.id} Y坐标超出地层 ${find.layerId} 范围`,
                detail: `Y坐标 ${coords.y} 超出地层范围 [${geo.y_min}, ${geo.y_max}]`,
                severity: 'medium'
              })
            }
          }
        }
      })
    }

    if (!coordRules.allowOrphanFinds) {
      const referencedLayerIds = new Set(finds.map(f => f.layerId).filter(id => id))
      const existingLayerIds = new Set(contexts.map(c => c.id))

      referencedLayerIds.forEach((layerId) => {
        if (!existingLayerIds.has(layerId)) {
          const orphanFinds = finds.filter(f => f.layerId === layerId)
          issues.push({
            type: 'error',
            category: 'coordinate',
            findId: null,
            layerId: layerId,
            message: `存在孤立出土物关联不存在的地层 ${layerId}`,
            detail: `共 ${orphanFinds.length} 件出土物关联不存在的地层 ${layerId}`,
            severity: 'high'
          })
        }
      })
    }

    const layerFindsMap = new Map()
    finds.forEach((find) => {
      if (find.layerId) {
        if (!layerFindsMap.has(find.layerId)) {
          layerFindsMap.set(find.layerId, [])
        }
        layerFindsMap.get(find.layerId).push(find)
      }
    })

    contexts.forEach((context) => {
      const layerFinds = layerFindsMap.get(context.id) || []
      if (layerFinds.length === 0) {
        issues.push({
          type: 'info',
          category: 'coordinate',
          findId: null,
          layerId: context.id,
          message: `地层 ${context.id} 无出土物记录`,
          detail: `该地层没有关联的出土物`,
          severity: 'low'
        })
      }
    })

    return issues
  }
}

export default CoordinateValidator
