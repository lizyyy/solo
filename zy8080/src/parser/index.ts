import yaml from 'js-yaml'
import { JobConfig, RulesConfig, Rule, Paper, Workpiece, PreflightIssue } from '../types'
import { parseDimension, toMM } from './unit'

export function parseJobJson(jsonString: string): { config: JobConfig; issues: PreflightIssue[] } {
  const issues: PreflightIssue[] = []
  
  try {
    const data = JSON.parse(jsonString)
    
    if (!data.id) {
      issues.push({ type: 'error', code: 'JOB_001', message: '缺少 job id' })
    }
    if (!data.name) {
      issues.push({ type: 'error', code: 'JOB_002', message: '缺少 job 名称' })
    }
    
    const paper = parsePaper(data.paper, issues)
    const bleed = parseDimension(data.bleed || '3mm')
    const safeMargin = parseDimension(data.safeMargin || '5mm')
    
    const workpieces: Workpiece[] = []
    if (data.workpieces && Array.isArray(data.workpieces)) {
      data.workpieces.forEach((wp: any, index: number) => {
        const workpiece = parseWorkpiece(wp, index, bleed, safeMargin, issues)
        if (workpiece) {
          workpieces.push(workpiece)
        }
      })
    }
    
    const config: JobConfig = {
      id: data.id || `job_${Date.now()}`,
      name: data.name || 'Unnamed Job',
      paper,
      bleed,
      safeMargin,
      workpieces
    }
    
    return { config, issues }
  } catch (e) {
    issues.push({ type: 'error', code: 'JOB_000', message: `JSON 解析错误: ${(e as Error).message}` })
    return { config: {} as JobConfig, issues }
  }
}

function parsePaper(data: any, issues: PreflightIssue[]): Paper {
  const width = parseDimension(data?.width || '700mm')
  const height = parseDimension(data?.height || '1000mm')
  
  if (toMM(width) <= 0 || toMM(height) <= 0) {
    issues.push({ type: 'error', code: 'PAPER_001', message: '纸张尺寸必须大于0' })
  }
  
  return {
    name: data?.name || 'Custom Paper',
    width,
    height
  }
}

function parseWorkpiece(data: any, index: number, defaultBleed: any, defaultSafe: any, issues: PreflightIssue[]): Workpiece | null {
  if (!data.width || !data.height) {
    issues.push({ type: 'error', code: `WP_${index}_001`, message: `作品 ${index} 缺少尺寸信息` })
    return null
  }
  
  const width = parseDimension(data.width)
  const height = parseDimension(data.height)
  const bleed = data.bleed ? parseDimension(data.bleed) : defaultBleed
  const safeMargin = data.safeMargin ? parseDimension(data.safeMargin) : defaultSafe
  
  if (toMM(width) <= 0 || toMM(height) <= 0) {
    issues.push({ type: 'error', code: `WP_${index}_002`, message: `作品 ${index} 尺寸必须大于0` })
    return null
  }
  
  if (data.copies && (data.copies < 1 || !Number.isInteger(data.copies))) {
    issues.push({ type: 'error', code: `WP_${index}_003`, message: `作品 ${index} 份数必须是正整数` })
  }
  
  return {
    id: data.id || `wp_${index}`,
    name: data.name || `Workpiece ${index + 1}`,
    width,
    height,
    bleed,
    safeMargin,
    rotation: (data.rotation || 0) % 360,
    copies: data.copies || 1,
    x: data.x || 0,
    y: data.y || 0
  }
}

export function parseRulesYaml(yamlString: string): { rules: Rule[]; issues: PreflightIssue[] } {
  const issues: PreflightIssue[] = []
  
  try {
    const data = yaml.load(yamlString) as any
    
    if (!data || !data.rules || !Array.isArray(data.rules)) {
      issues.push({ type: 'warning', code: 'RULES_001', message: 'rules.yaml 格式不正确，使用默认规则' })
      return { rules: getDefaultRules(), issues }
    }
    
    const rules: Rule[] = data.rules.map((rule: any, index: number) => {
      if (!rule.id || !rule.type) {
        issues.push({ type: 'warning', code: `RULE_${index}_001`, message: `规则 ${index} 缺少必要字段` })
      }
      
      return {
        id: rule.id || `rule_${index}`,
        name: rule.name || `Rule ${index + 1}`,
        type: rule.type as Rule['type'] || 'bleed',
        min: rule.min,
        max: rule.max,
        required: rule.required || false,
        message: rule.message
      }
    })
    
    return { rules, issues }
  } catch (e) {
    issues.push({ type: 'error', code: 'RULES_000', message: `YAML 解析错误: ${(e as Error).message}` })
    return { rules: getDefaultRules(), issues }
  }
}

export function getDefaultRules(): Rule[] {
  return [
    {
      id: 'bleed_min',
      name: '最小出血',
      type: 'bleed',
      min: 3,
      required: true,
      message: '出血不足可能导致切边问题'
    },
    {
      id: 'safe_min',
      name: '最小安全边距',
      type: 'safeMargin',
      min: 5,
      required: true,
      message: '安全边距不足可能导致内容被裁切'
    },
    {
      id: 'rotation_valid',
      name: '有效旋转角度',
      type: 'rotation',
      max: 360,
      required: true,
      message: '旋转角度应在 0-360 度之间'
    },
    {
      id: 'waste_max',
      name: '最大纸张浪费',
      type: 'waste',
      max: 30,
      required: false,
      message: '纸张浪费超过 30%，建议优化排版'
    }
  ]
}
