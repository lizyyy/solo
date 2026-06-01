import type { ExceptionType, ExceptionRecord, GameSession, LevelConfig, ActionRecord } from '@/types'
import { FUND_ASSETS } from '@/data/funds'

function makeException(
  sessionId: string,
  exceptionType: ExceptionType,
  description: string,
  context: string
): ExceptionRecord {
  return {
    id: `exc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    exceptionType,
    description,
    context,
    visible: true,
    timestamp: Date.now()
  }
}

export function detectMisoperation(
  action: ActionRecord,
  session: GameSession,
  level: LevelConfig
): ExceptionRecord | null {
  if (action.deltaRatio <= 0) return null

  const fund = FUND_ASSETS.find(f => f.id === action.fundId)
  if (!fund) return null

  if (action.riskBefore > level.riskLimit && fund.category === 'equity' && action.deltaRatio > 0) {
    return makeException(
      session.id,
      'misoperation',
      '在风险已超限时仍然加仓股票型，违反风险控制规则',
      `操作前风险${action.riskBefore.toFixed(2)}超过限制${level.riskLimit}，加仓基金${fund.name}，增量${action.deltaRatio}`
    )
  }

  return null
}

export function detectBoundaryScore(
  session: GameSession,
  level: LevelConfig
): ExceptionRecord | null {
  if (Math.abs(session.currentScore - level.targetScore) <= 2) {
    return makeException(
      session.id,
      'boundary_score',
      '当前得分接近目标得分，处于边界分数区域',
      `当前得分${session.currentScore.toFixed(2)}，目标得分${level.targetScore}，差距${Math.abs(session.currentScore - level.targetScore).toFixed(2)}`
    )
  }

  return null
}

export function detectPauseInterrupt(
  pauseRecord: { reason: string; duration: number | null },
  session: GameSession
): ExceptionRecord | null {
  if (pauseRecord.reason.includes('intentional') || pauseRecord.reason.includes('故意')) {
    return makeException(
      session.id,
      'pause_interrupt',
      '检测到故意中断暂停行为',
      `暂停原因：${pauseRecord.reason}，暂停时长：${pauseRecord.duration ?? '未知'}`
    )
  }

  return null
}

export function detectDirtyData(
  data: { score?: number; risk?: number; holdings?: unknown }
): ExceptionRecord | null {
  if (data.score !== undefined && data.score < 0) {
    return makeException(
      '',
      'dirty_data',
      '分数数据异常：分数为负数',
      `score=${data.score}`
    )
  }

  if (data.risk !== undefined && (data.risk < 0 || data.risk > 1)) {
    return makeException(
      '',
      'dirty_data',
      '风险数据异常：风险值超出有效范围[0,1]',
      `risk=${data.risk}`
    )
  }

  if (data.holdings !== undefined && !Array.isArray(data.holdings)) {
    return makeException(
      '',
      'dirty_data',
      '持仓数据异常：持仓不是数组',
      `holdings类型为${typeof data.holdings}`
    )
  }

  return null
}
