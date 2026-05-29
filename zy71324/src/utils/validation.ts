import {
  Material,
  ValidationIssue,
  FrequencyBand,
  FREQUENCY_BANDS,
  LOW_FREQ_BANDS,
} from '@/types'

export function validateMaterial(material: Material): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  FREQUENCY_BANDS.forEach((freq) => {
    const val = material.coefficients[freq]
    if (val === null) {
      issues.push({
        materialId: material.id,
        materialName: material.name,
        type: 'frequency_missing',
        frequency: freq,
        detail: `${material.name} 缺少 ${freq} 吸声系数数据`,
        severity: LOW_FREQ_BANDS.includes(freq) ? 'error' : 'warning',
      })
    } else if (val < 0 || val > 1) {
      issues.push({
        materialId: material.id,
        materialName: material.name,
        type: 'coefficient_out_of_range',
        frequency: freq,
        detail: `${material.name} 的 ${freq} 系数为 ${val}，超出有效范围 [0, 1]`,
        severity: 'error',
      })
    }
  })

  if (!material.name.trim()) {
    issues.push({
      materialId: material.id,
      materialName: material.name || '(未命名)',
      type: 'field_empty',
      detail: '材料名称不能为空',
      severity: 'error',
    })
  }

  if (material.unitPrice <= 0) {
    issues.push({
      materialId: material.id,
      materialName: material.name,
      type: 'field_empty',
      detail: `${material.name} 的单价必须大于 0`,
      severity: 'error',
    })
  }

  return issues
}

export function validateAllMaterials(materials: Material[]): ValidationIssue[] {
  return materials.flatMap((m) => validateMaterial(m))
}

export function getIssuesByType(issues: ValidationIssue[]) {
  return {
    outOfRange: issues.filter((i) => i.type === 'coefficient_out_of_range'),
    missing: issues.filter((i) => i.type === 'frequency_missing'),
    emptyField: issues.filter((i) => i.type === 'field_empty'),
    budgetOverrun: issues.filter((i) => i.type === 'budget_overrun'),
  }
}

export function hasAnomaly(material: Material, issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.materialId === material.id)
}

export function getCoefficientStatus(
  material: Material,
  freq: FrequencyBand,
  issues: ValidationIssue[]
): 'normal' | 'out_of_range' | 'missing' {
  const val = material.coefficients[freq]
  if (val === null) return 'missing'
  if (val < 0 || val > 1) return 'out_of_range'
  return 'normal'
}
