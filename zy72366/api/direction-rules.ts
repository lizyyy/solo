type DirectionRule = {
  pattern: RegExp
  normalizedValue: string | null
  action: "auto_fix" | "mark_invalid" | "pending_review"
  description: string
}

const DIRECTION_RULES: DirectionRule[] = [
  {
    pattern: /^(正方向|正向|正|positive|\+)$/i,
    normalizedValue: "positive",
    action: "auto_fix",
    description: "正方向标准值，自动标准化",
  },
  {
    pattern: /^(负方向|负向|负|negative|-)$/i,
    normalizedValue: "negative",
    action: "auto_fix",
    description: "负方向标准值，自动标准化",
  },
  {
    pattern: /^(向左|左|left|向右|右|right|反方向|反向|反转|reverse|backward)$/i,
    normalizedValue: null,
    action: "pending_review",
    description: "口语化方向表达，进入实验老师待复核链路，不可直接判无效",
  },
]

export type { DirectionRule }
export { DIRECTION_RULES }

export function evaluateDirection(direction: string): {
  normalizedValue: string | null
  status: "normal" | "abnormal" | "pending_review"
  reason: string
} {
  if (!direction || typeof direction !== "string") {
    return { normalizedValue: null, status: "abnormal", reason: "无效：方向字段为空" }
  }

  const trimmed = direction.trim()

  for (const rule of DIRECTION_RULES) {
    if (rule.pattern.test(trimmed)) {
      if (rule.action === "auto_fix") {
        return {
          normalizedValue: rule.normalizedValue,
          status: "normal",
          reason: rule.description,
        }
      }
      if (rule.action === "mark_invalid") {
        return {
          normalizedValue: null,
          status: "abnormal",
          reason: "无效：" + rule.description,
        }
      }
      if (rule.action === "pending_review") {
        return {
          normalizedValue: null,
          status: "pending_review",
          reason: "待复核：" + rule.description,
        }
      }
    }
  }

  return {
    normalizedValue: null,
    status: "abnormal",
    reason: `无效：未识别的方向值 "${trimmed}"，不在标准值/待复核列表中`,
  }
}
