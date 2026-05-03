import dayjs from 'dayjs'

export const RISK_LEVELS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
}

export const RISK_LEVEL_LABELS = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
}

export const RISK_TYPES = {
  PLATFORM_MISMATCH: 'platform_mismatch',
  COMMERCIAL_NOT_ALLOWED: 'commercial_not_allowed',
  LICENSE_EXPIRED: 'license_expired',
  LICENSE_EXPIRING_SOON: 'license_expiring_soon',
  CLIENT_OUT_OF_SCOPE: 'client_out_of_scope',
  ATTRIBUTION_MISSING: 'attribution_missing',
  UNKNOWN_MATERIAL: 'unknown_material',
}

export const RISK_TYPE_LABELS = {
  platform_mismatch: '平台不匹配',
  commercial_not_allowed: '商用不允许',
  license_expired: '授权已过期',
  license_expiring_soon: '授权即将过期',
  client_out_of_scope: '客户超范围',
  attribution_missing: '缺少署名',
  unknown_material: '未知素材',
}

export const checkPlatformMismatch = (timeline, material) => {
  if (!material || !material.allowed_platforms) return null
  
  const targetPlatform = timeline.target_platform
  if (!targetPlatform) return null
  
  const allowedPlatforms = material.allowed_platforms
  if (allowedPlatforms.length === 0) return null
  
  const platformMatch = allowedPlatforms.some(p => 
    p.toLowerCase() === targetPlatform.toLowerCase()
  )
  
  if (!platformMatch) {
    return {
      type: RISK_TYPES.PLATFORM_MISMATCH,
      level: RISK_LEVELS.CRITICAL,
      title: '平台不匹配',
      message: `素材「${material.name}」不允许在「${targetPlatform}」发布`,
      detail: `素材授权平台: ${allowedPlatforms.join('、')}，目标平台: ${targetPlatform}`,
      suggestion: `建议更换为允许在${targetPlatform}发布的素材，或联系授权方确认平台限制`,
      timeline_id: timeline.id,
      material_id: material.id,
      material_name: material.name,
    }
  }
  
  return null
}

export const checkCommercialNotAllowed = (timeline, material, isCommercial = true) => {
  if (!material) return null
  
  if (!material.commercial_allowed && isCommercial) {
    return {
      type: RISK_TYPES.COMMERCIAL_NOT_ALLOWED,
      level: RISK_LEVELS.CRITICAL,
      title: '商用不允许',
      message: `素材「${material.name}」不允许商业使用`,
      detail: '该素材仅允许个人非商业使用，当前项目为商业用途',
      suggestion: '建议更换为允许商用的素材，或联系授权方获取商用授权',
      timeline_id: timeline.id,
      material_id: material.id,
      material_name: material.name,
    }
  }
  
  return null
}

export const checkLicenseExpired = (timeline, material) => {
  if (!material || !material.expire_date) return null
  
  const expireDate = dayjs(material.expire_date)
  const today = dayjs()
  const daysUntilExpire = expireDate.diff(today, 'day')
  
  if (daysUntilExpire < 0) {
    return {
      type: RISK_TYPES.LICENSE_EXPIRED,
      level: RISK_LEVELS.CRITICAL,
      title: '授权已过期',
      message: `素材「${material.name}」授权已过期`,
      detail: `授权到期日: ${material.expire_date}，已过期 ${Math.abs(daysUntilExpire)} 天`,
      suggestion: '立即更换素材或联系授权方续期，否则可能面临版权风险',
      timeline_id: timeline.id,
      material_id: material.id,
      material_name: material.name,
      expire_date: material.expire_date,
      days_until_expire: daysUntilExpire,
    }
  }
  
  if (daysUntilExpire <= 14 && daysUntilExpire >= 0) {
    return {
      type: RISK_TYPES.LICENSE_EXPIRING_SOON,
      level: RISK_LEVELS.HIGH,
      title: '授权即将过期',
      message: `素材「${material.name}」授权将在 ${daysUntilExpire} 天后过期`,
      detail: `授权到期日: ${material.expire_date}，剩余 ${daysUntilExpire} 天`,
      suggestion: '建议提前规划素材替换，或联系授权方续期',
      timeline_id: timeline.id,
      material_id: material.id,
      material_name: material.name,
      expire_date: material.expire_date,
      days_until_expire: daysUntilExpire,
    }
  }
  
  return null
}

export const checkClientOutOfScope = (timeline, material) => {
  if (!material || !material.allowed_clients || material.allowed_clients.length === 0) {
    return null
  }
  
  const clientName = timeline.client_name
  if (!clientName) return null
  
  const clientMatch = material.allowed_clients.some(c => 
    c.toLowerCase() === clientName.toLowerCase()
  )
  
  if (!clientMatch) {
    return {
      type: RISK_TYPES.CLIENT_OUT_OF_SCOPE,
      level: RISK_LEVELS.HIGH,
      title: '客户超范围',
      message: `素材「${material.name}」仅限指定客户使用`,
      detail: `素材仅限客户: ${material.allowed_clients.join('、')}，当前客户: ${clientName}`,
      suggestion: `建议更换为允许客户「${clientName}」使用的素材，或确认授权范围`,
      timeline_id: timeline.id,
      material_id: material.id,
      material_name: material.name,
      current_client: clientName,
      allowed_clients: material.allowed_clients,
    }
  }
  
  return null
}

export const checkAttributionMissing = (timeline, material, attributionNotes = []) => {
  if (!material || !material.requires_attribution) return null
  
  const hasAttribution = attributionNotes.some(note => 
    note.includes(material.name) || 
    (material.attribution_text && note.includes(material.attribution_text))
  )
  
  if (!hasAttribution) {
    return {
      type: RISK_TYPES.ATTRIBUTION_MISSING,
      level: RISK_LEVELS.MEDIUM,
      title: '缺少署名',
      message: `素材「${material.name}」需要署名但未在交付清单中添加`,
      detail: material.attribution_text 
        ? `建议署名文本: ${material.attribution_text}` 
        : '需要在片尾或描述中标注素材来源',
      suggestion: material.attribution_text 
        ? `建议在片尾添加: ${material.attribution_text}` 
        : '建议补充素材来源署名',
      timeline_id: timeline.id,
      material_id: material.id,
      material_name: material.name,
      attribution_text: material.attribution_text,
    }
  }
  
  return null
}

export const checkUnknownMaterial = (timeline, materialsById) => {
  if (!timeline.material_id) {
    return {
      type: RISK_TYPES.UNKNOWN_MATERIAL,
      level: RISK_LEVELS.HIGH,
      title: '未知素材',
      message: `时间轴片段「${timeline.material_name || '未命名'}」未关联素材库中的素材`,
      detail: '该片段没有关联素材库中的任何素材，无法验证授权信息',
      suggestion: '建议在素材库中添加该素材的授权信息，或确认素材来源',
      timeline_id: timeline.id,
      material_id: null,
      material_name: timeline.material_name || '未命名',
    }
  }
  
  const material = materialsById[timeline.material_id]
  if (!material) {
    return {
      type: RISK_TYPES.UNKNOWN_MATERIAL,
      level: RISK_LEVELS.HIGH,
      title: '未知素材',
      message: `时间轴片段引用的素材不存在于素材库中`,
      detail: `素材 ID: ${timeline.material_id}，素材名称: ${timeline.material_name || '未命名'}`,
      suggestion: '建议检查素材库，补充该素材的授权信息',
      timeline_id: timeline.id,
      material_id: timeline.material_id,
      material_name: timeline.material_name || '未命名',
    }
  }
  
  return null
}

export const runAllChecks = (project, timelines, materials, options = {}) => {
  const {
    isCommercial = true,
    attributionNotes = [],
  } = options
  
  const risks = []
  const materialsById = {}
  materials.forEach(m => {
    materialsById[m.id] = m
  })
  
  for (const timeline of timelines) {
    const material = timeline.material_id ? materialsById[timeline.material_id] : null
    
    const unknownRisk = checkUnknownMaterial(timeline, materialsById)
    if (unknownRisk) {
      risks.push(unknownRisk)
    }
    
    if (material) {
      const platformRisk = checkPlatformMismatch(timeline, material)
      if (platformRisk) risks.push(platformRisk)
      
      const commercialRisk = checkCommercialNotAllowed(timeline, material, isCommercial)
      if (commercialRisk) risks.push(commercialRisk)
      
      const expireRisk = checkLicenseExpired(timeline, material)
      if (expireRisk) risks.push(expireRisk)
      
      const clientRisk = checkClientOutOfScope(timeline, material)
      if (clientRisk) risks.push(clientRisk)
      
      const attributionRisk = checkAttributionMissing(timeline, material, attributionNotes)
      if (attributionRisk) risks.push(attributionRisk)
    }
  }
  
  const stats = {
    total: risks.length,
    critical: risks.filter(r => r.level === RISK_LEVELS.CRITICAL).length,
    high: risks.filter(r => r.level === RISK_LEVELS.HIGH).length,
    medium: risks.filter(r => r.level === RISK_LEVELS.MEDIUM).length,
    low: risks.filter(r => r.level === RISK_LEVELS.LOW).length,
  }
  
  const groupedByMaterial = {}
  const groupedByTimeline = {}
  const groupedByType = {}
  
  for (const risk of risks) {
    if (risk.material_id) {
      if (!groupedByMaterial[risk.material_id]) {
        groupedByMaterial[risk.material_id] = {
          material_name: risk.material_name,
          material_id: risk.material_id,
          risks: [],
        }
      }
      groupedByMaterial[risk.material_id].risks.push(risk)
    }
    
    if (risk.timeline_id) {
      if (!groupedByTimeline[risk.timeline_id]) {
        groupedByTimeline[risk.timeline_id] = {
          timeline_id: risk.timeline_id,
          risks: [],
        }
      }
      groupedByTimeline[risk.timeline_id].risks.push(risk)
    }
    
    if (!groupedByType[risk.type]) {
      groupedByType[risk.type] = {
        type: risk.type,
        type_label: RISK_TYPE_LABELS[risk.type],
        risks: [],
      }
    }
    groupedByType[risk.type].risks.push(risk)
  }
  
  const needsAttribution = materials.filter(m => m.requires_attribution)
  const attributionList = needsAttribution.map(m => ({
    material_id: m.id,
    material_name: m.name,
    attribution_text: m.attribution_text || `素材来源: ${m.name}`,
  }))
  
  const materialStats = {
    total: materials.length,
    byType: {},
    expiringSoon: materials.filter(m => {
      if (!m.expire_date) return false
      const days = dayjs(m.expire_date).diff(dayjs(), 'day')
      return days >= 0 && days <= 30
    }).length,
    expired: materials.filter(m => {
      if (!m.expire_date) return false
      return dayjs(m.expire_date).diff(dayjs(), 'day') < 0
    }).length,
    needsAttribution: needsAttribution.length,
    nonCommercial: materials.filter(m => !m.commercial_allowed).length,
  }
  
  materials.forEach(m => {
    if (!materialStats.byType[m.type]) {
      materialStats.byType[m.type] = 0
    }
    materialStats.byType[m.type]++
  })
  
  return {
    project,
    risks,
    stats,
    grouped: {
      byMaterial: Object.values(groupedByMaterial),
      byTimeline: Object.values(groupedByTimeline),
      byType: Object.values(groupedByType),
    },
    attributionList,
    materialStats,
    checkTime: new Date().toISOString(),
  }
}

export const sortRisksByPriority = (risks) => {
  const levelOrder = {
    [RISK_LEVELS.CRITICAL]: 0,
    [RISK_LEVELS.HIGH]: 1,
    [RISK_LEVELS.MEDIUM]: 2,
    [RISK_LEVELS.LOW]: 3,
  }
  
  return [...risks].sort((a, b) => {
    return levelOrder[a.level] - levelOrder[b.level]
  })
}
