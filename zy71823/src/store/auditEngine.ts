import type { EvidenceItem, AuditResult, JudgmentType, AuditStatus } from '@/types'

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function findRelatedEvidences(
  evidences: EvidenceItem[],
  item: EvidenceItem
): EvidenceItem[] {
  return evidences.filter(
    (e) => e.id !== item.id && e.activityName === item.activityName
  )
}

function hasDuplicateDraft(
  evidences: EvidenceItem[],
  item: EvidenceItem
): boolean {
  if (item.type !== 'draft') return false
  return evidences.some(
    (e) =>
      e.id !== item.id &&
      e.type === 'draft' &&
      e.activityName === item.activityName &&
      e.content === item.content
  )
}

function reviewMentionsConclusionChange(content: string): boolean {
  const keywords = ['改了结论', '结论变更', '排名变化', '结果不同', '更正', '修正结论', '排名调整', '重新计算']
  return keywords.some((k) => content.includes(k))
}

function draftAffectsRanking(item: EvidenceItem): boolean {
  if (item.changeType === 'modify') {
    const rankKeywords = ['排名', '积分', '分数', '得分', '成绩', '评级']
    return rankKeywords.some((k) => (item.changeNote || item.content).includes(k))
  }
  return item.changeType === 'delete'
}

function judgeEvidence(
  evidences: EvidenceItem[],
  item: EvidenceItem
): { judgment: JudgmentType; reasoning: string; nextStep: string } | null {
  if (item.type === 'screenshot') {
    const hasReview = evidences.some(
      (e) => e.type === 'review' && e.activityName === item.activityName
    )
    if (!hasReview) {
      return {
        judgment: 'supplementary',
        reasoning: `排行榜截图「${item.activityName}」已入库，但尚未收到活动复盘，暂时标记为仅补材料。当前无法判断是否存在结论变更。`,
        nextStep: '等待对应活动复盘补录后，系统将自动重新对账。如复盘提及结论变更，会升级为"改了结论"。',
      }
    }
    return null
  }

  if (item.type === 'review') {
    const hasScreenshot = evidences.some(
      (e) => e.type === 'screenshot' && e.activityName === item.activityName
    )
    if (!hasScreenshot) {
      return {
        judgment: 'supplementary',
        reasoning: `活动复盘「${item.activityName}」无对应排行榜截图，无法交叉验证。暂时标记为仅补材料。`,
        nextStep: '请确认是否遗漏上传排行榜截图，或该活动确实没有排行榜记录。补齐截图后系统会自动重新对账。',
      }
    }
    if (reviewMentionsConclusionChange(item.content)) {
      return {
        judgment: 'conclusion_changed',
        reasoning: `活动复盘「${item.activityName}」提及了结论变更，复盘内容中包含结论变更关键词。原有排行榜结果可能与复盘结论不一致，需要人工确认。`,
        nextStep: '请核对排行榜截图与复盘内容是否矛盾，确认后点击"确认"。如判断有误，点击"驳回"并填写正确结论。',
      }
    }
    return {
      judgment: 'supplementary',
      reasoning: `活动复盘「${item.activityName}」为补充说明，复盘内容未提及结论变更，原有排行榜结果不受影响。`,
      nextStep: '如确认无误，点击"确认"完成对账。',
    }
  }

  if (item.type === 'draft') {
    if (hasDuplicateDraft(evidences, item)) {
      return {
        judgment: 'supplementary',
        reasoning: `关卡草表「${item.activityName}」发现重复记录（同关卡名同内容），可能是误录入。`,
        nextStep: '请人工确认是否为重复数据。如是误录请删除重复项，如确有需要请说明原因后确认。',
      }
    }
    if (item.changeType === 'new') {
      return {
        judgment: 'supplementary',
        reasoning: `新增关卡草表「${item.activityName}」为补充材料，未影响已有结论。`,
        nextStep: '确认新增草表无误后，点击"确认"完成对账。',
      }
    }
    if (item.changeType === 'delete') {
      return {
        judgment: 'conclusion_changed',
        reasoning: `关卡草表「${item.activityName}」执行了删除操作，关卡删除改变了活动结构，可能影响排名和结论。`,
        nextStep: '请确认删除是否正确，并评估对排名的影响。确认后点击"确认"，如判断有误请驳回并填写修正结论。',
      }
    }
    if (item.changeType === 'modify') {
      if (draftAffectsRanking(item)) {
        return {
          judgment: 'conclusion_changed',
          reasoning: `关卡草表「${item.activityName}」的修改涉及排名相关字段（积分/分数/成绩等），可能影响最终排名结果。`,
          nextStep: '请核对修改前后的排名差异，确认后点击"确认"。如修改不影响结论，请驳回并说明。',
        }
      }
      return {
        judgment: 'supplementary',
        reasoning: `关卡草表「${item.activityName}」的修改为非排名相关内容调整，不改变已有结论。`,
        nextStep: '确认修改无误后，点击"确认"完成对账。',
      }
    }
  }

  return null
}

export function runAuditEngine(
  evidences: EvidenceItem[],
  existingResults: AuditResult[]
): AuditResult[] {
  const results: AuditResult[] = [...existingResults]
  const auditedIds = new Set(results.map((r) => r.evidenceId))

  for (const item of evidences) {
    if (auditedIds.has(item.id)) {
      const existingIdx = results.findIndex((r) => r.evidenceId === item.id)
      if (existingIdx >= 0 && results[existingIdx].status === 'pending') {
        const judgment = judgeEvidence(evidences, item)
        if (judgment) {
          results[existingIdx] = {
            ...results[existingIdx],
            ...judgment,
          }
        }
      }
      continue
    }

    const judgment = judgeEvidence(evidences, item)
    if (judgment) {
      results.push({
        id: generateId(),
        evidenceId: item.id,
        ...judgment,
        status: 'pending' as AuditStatus,
      })
    }
  }

  return results.filter((r) => evidences.some((e) => e.id === r.evidenceId))
}

export function createAuditEngine() {
  return { runAuditEngine, generateId }
}
