import type { ParamState, AnomalyType } from "@/types"

export interface ValidationResult {
  valid: boolean
  errors: { field: keyof ParamState; type: AnomalyType | "invalid"; message: string }[]
}

export function validateParams(params: ParamState): ValidationResult {
  const errors: ValidationResult["errors"] = []

  if (params.magnetSpacing <= 0) {
    errors.push({
      field: "magnetSpacing",
      type: "negative_spacing",
      message: "磁铁间距不能为负或零，请调整间距",
    })
  }

  if (params.current < 0.1 || params.current > 50) {
    errors.push({
      field: "current",
      type: "current_exceed",
      message: "电流超出安全范围(0.1~50A)，请调整",
    })
  }

  if (params.vehicleMass <= 0) {
    errors.push({
      field: "vehicleMass",
      type: "invalid",
      message: "车体质量须为正数",
    })
  }

  if (params.trackLength <= 0) {
    errors.push({
      field: "trackLength",
      type: "invalid",
      message: "轨道长度须为正数",
    })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
