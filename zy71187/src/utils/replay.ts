import type { PlayerAction } from '@/types'

export interface ReplayEvent {
  timestamp: number
  actionType: string
  description: string
  isCorrect: boolean
}

export function generateReplayEvents(
  actions: PlayerAction[],
  correctMatches: Record<string, string>,
  correctDamages: Record<string, string>,
): ReplayEvent[] {
  return actions.map((action) => {
    let description = ''
    let isCorrect = action.isCorrect !== undefined ? action.isCorrect : true

    switch (action.actionType) {
      case 'match_accessory':
        description = `匹配配件：${action.targetId}`
        if (action.details && correctMatches[action.targetId] !== undefined) {
          isCorrect = action.details === correctMatches[action.targetId]
        }
        break
      case 'unmatch_accessory':
        description = `取消匹配：${action.targetId}`
        break
      case 'mark_damage':
        description = `标记损伤：${action.targetId}`
        if (action.details && correctDamages[action.details] !== undefined) {
          isCorrect = true
        }
        break
      case 'unmark_damage':
        description = `取消标记：${action.targetId}`
        break
      case 'calculate_deposit':
        description = `计算押金：${action.targetId} = ${action.details || ''}`
        break
      case 'identify_red_herring':
        description = `识别干扰物品：${action.targetId}`
        break
      case 'mark_normal_wear':
        description = `标记正常使用痕迹：${action.targetId}`
        isCorrect = true
        break
      case 'submit':
        description = '提交检查报告'
        break
      default:
        description = `${action.actionType}: ${action.targetId}`
    }

    return {
      timestamp: action.timestamp,
      actionType: action.actionType,
      description,
      isCorrect,
    }
  })
}
