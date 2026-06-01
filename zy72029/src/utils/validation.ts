import type { MaterialPack, ConfigError } from '@/types'

export function validateMaterialPack(pack: any): { valid: boolean; errors: ConfigError[] } {
  const errors: ConfigError[] = []

  if (!pack) {
    errors.push({
      field: 'materialPack',
      technicalMessage: 'Material pack is null or undefined',
      userMessage: '材料包为空，请检查导入的文件',
    })
    return { valid: false, errors }
  }

  if (!pack.id) {
    errors.push({
      field: 'materialPack.id',
      technicalMessage: 'Missing required field: id',
      userMessage: '材料包缺少唯一标识，请确认材料包格式正确',
    })
  }

  if (!pack.name) {
    errors.push({
      field: 'materialPack.name',
      technicalMessage: 'Missing required field: name',
      userMessage: '材料包缺少名称，请填写材料包名称',
    })
  }

  if (!pack.source) {
    errors.push({
      field: 'materialPack.source',
      technicalMessage: 'Missing required field: source',
      userMessage: '材料包缺少来源信息，交接时无法追溯，请补充材料来源',
    })
  }

  if (!pack.materials || !Array.isArray(pack.materials) || pack.materials.length === 0) {
    errors.push({
      field: 'materialPack.materials',
      technicalMessage: 'Missing or empty materials array',
      userMessage: '材料包中没有任何材料，请添加至少一份理赔材料',
    })
  } else {
    const materialIds = new Set<string>()
    pack.materials.forEach((mat: any, idx: number) => {
      if (!mat.id) {
        errors.push({
          field: `materials[${idx}].id`,
          technicalMessage: `Material at index ${idx} missing id`,
          userMessage: `第${idx + 1}份材料缺少ID标识`,
        })
      } else if (materialIds.has(mat.id)) {
        errors.push({
          field: `materials[${idx}].id`,
          technicalMessage: `Duplicate material id: ${mat.id}`,
          userMessage: `材料ID重复：${mat.id}，请检查材料包数据`,
        })
      } else {
        materialIds.add(mat.id)
      }

      if (!mat.title) {
        errors.push({
          field: `materials[${idx}].title`,
          technicalMessage: `Material at index ${idx} missing title`,
          userMessage: `第${idx + 1}份材料缺少标题`,
        })
      }

      if (!mat.correctSlot) {
        errors.push({
          field: `materials[${idx}].correctSlot`,
          technicalMessage: `Material at index ${idx} missing correctSlot`,
          userMessage: `第${idx + 1}份材料"${mat.title || '未命名'}"缺少正确匹配的槽位配置`,
        })
      }
    })
  }

  if (!pack.slots || !Array.isArray(pack.slots) || pack.slots.length === 0) {
    errors.push({
      field: 'materialPack.slots',
      technicalMessage: 'Missing or empty slots array',
      userMessage: '材料包中没有配置匹配槽位，请至少添加一个槽位',
    })
  } else {
    const slotIds = new Set<string>()
    pack.slots.forEach((slot: any, idx: number) => {
      if (!slot.id) {
        errors.push({
          field: `slots[${idx}].id`,
          technicalMessage: `Slot at index ${idx} missing id`,
          userMessage: `第${idx + 1}个槽位缺少ID标识`,
        })
      } else if (slotIds.has(slot.id)) {
        errors.push({
          field: `slots[${idx}].id`,
          technicalMessage: `Duplicate slot id: ${slot.id}`,
          userMessage: `槽位ID重复：${slot.id}`,
        })
      } else {
        slotIds.add(slot.id)
      }

      if (!slot.label) {
        errors.push({
          field: `slots[${idx}].label`,
          technicalMessage: `Slot at index ${idx} missing label`,
          userMessage: `第${idx + 1}个槽位缺少标签名称`,
        })
      }
    })

    if (pack.materials) {
      pack.materials.forEach((mat: any, idx: number) => {
        if (mat.correctSlot && !slotIds.has(mat.correctSlot)) {
          errors.push({
            field: `materials[${idx}].correctSlot`,
            technicalMessage: `Material correctSlot "${mat.correctSlot}" not found in slots`,
            userMessage: `材料"${mat.title}"的正确槽位"${mat.correctSlot}"不存在，请检查槽位配置`,
          })
        }
      })
    }
  }

  return { valid: errors.length === 0, errors }
}

export function validateGameConfig(config: any): { valid: boolean; errors: ConfigError[] } {
  const errors: ConfigError[] = []

  if (config.riskThreshold !== undefined) {
    if (typeof config.riskThreshold !== 'number' || config.riskThreshold <= 0) {
      errors.push({
        field: 'riskThreshold',
        technicalMessage: `Invalid riskThreshold: ${config.riskThreshold}`,
        userMessage: `风险阈值必须是大于0的数字，当前值：${config.riskThreshold}`,
      })
    }
  }

  if (config.totalTime !== undefined) {
    if (typeof config.totalTime !== 'number' || config.totalTime < 30 || config.totalTime > 3600) {
      errors.push({
        field: 'totalTime',
        technicalMessage: `Invalid totalTime: ${config.totalTime}`,
        userMessage: `游戏时长必须在30秒到3600秒之间，当前值：${config.totalTime}秒`,
      })
    }
  }

  return { valid: errors.length === 0, errors }
}

export function formatConfigErrors(errors: ConfigError[]): string {
  if (errors.length === 0) return ''
  
  return errors.map(err => 
    `⚠️ ${err.userMessage}\n   （技术信息：${err.field} - ${err.technicalMessage}）`
  ).join('\n\n')
}

export function tryParseJSON(jsonString: string): { success: boolean; data?: any; error?: string } {
  try {
    const data = JSON.parse(jsonString)
    return { success: true, data }
  } catch (e) {
    if (e instanceof Error) {
      return { 
        success: false, 
        error: `JSON解析失败：${e.message}\n请检查文件格式是否正确，确保没有语法错误` 
      }
    }
    return { success: false, error: '未知的JSON解析错误' }
  }
}
