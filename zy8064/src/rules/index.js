export const RuleSeverity = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info'
}

export const RuleType = {
  ALT: 'alt',
  HEADING: 'heading',
  TOC: 'toc',
  MANIFEST: 'manifest',
  SPINE: 'spine',
  IMAGE: 'image'
}

export const Rules = {
  ALT_001: {
    id: 'ALT_001',
    name: '缺少 alt 属性',
    severity: RuleSeverity.CRITICAL,
    type: RuleType.ALT,
    description: '<img> 标签缺少 alt 属性'
  },
  ALT_002: {
    id: 'ALT_002',
    name: 'alt 为空字符串',
    severity: RuleSeverity.WARNING,
    type: RuleType.ALT,
    description: '<img> 标签的 alt 属性为空字符串 (alt="")，需确认是否为刻意设置'
  },
  HEADING_001: {
    id: 'HEADING_001',
    name: '标题层级跳跃',
    severity: RuleSeverity.CRITICAL,
    type: RuleType.HEADING,
    description: '标题层级跨度超过一级，如 h1 直接到 h3'
  },
  HEADING_002: {
    id: 'HEADING_002',
    name: '标题层级缺失',
    severity: RuleSeverity.WARNING,
    type: RuleType.HEADING,
    description: '缺少中间层级标题，如只有 h1 和 h3 却没有 h2'
  },
  TOC_001: {
    id: 'TOC_001',
    name: '目录指向不存在文件',
    severity: RuleSeverity.CRITICAL,
    type: RuleType.TOC,
    description: '目录中的链接指向 manifest 或 spine 中不存在的文件'
  },
  TOC_002: {
    id: 'TOC_002',
    name: 'spine 引用不存在的 manifest 项',
    severity: RuleSeverity.CRITICAL,
    type: RuleType.SPINE,
    description: 'spine 中的 itemref 指向 manifest 中不存在的 id'
  },
  MANIFEST_001: {
    id: 'MANIFEST_001',
    name: 'manifest 重复项',
    severity: RuleSeverity.WARNING,
    type: RuleType.MANIFEST,
    description: 'manifest 中存在重复的 id'
  },
  MANIFEST_002: {
    id: 'MANIFEST_002',
    name: 'manifest 缺失 item',
    severity: RuleSeverity.WARNING,
    type: RuleType.MANIFEST,
    description: 'spine 引用了 manifest 中未定义的 item'
  },
  SPINE_001: {
    id: 'SPINE_001',
    name: 'spine 章节文件缺失',
    severity: RuleSeverity.CRITICAL,
    type: RuleType.SPINE,
    description: 'spine 中的 itemref 对应的文件不存在'
  },
  IMAGE_001: {
    id: 'IMAGE_001',
    name: '图片资源缺失',
    severity: RuleSeverity.WARNING,
    type: RuleType.IMAGE,
    description: 'manifest 引用了不存在的图片文件'
  }
}

export function getRuleById(id) {
  return Rules[id] || null
}

export function getRulesBySeverity(severity) {
  return Object.values(Rules).filter(r => r.severity === severity)
}

export function getRulesByType(type) {
  return Object.values(Rules).filter(r => r.type === type)
}
