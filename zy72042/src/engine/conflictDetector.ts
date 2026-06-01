import type { ConflictRecord, NotebookEntry, GameSession } from '@/types'

export function detectConflicts(
  session: GameSession,
  notebookEntries: NotebookEntry[]
): ConflictRecord[] {
  const conflicts: ConflictRecord[] = []
  const matchingEntries = notebookEntries.filter(e => e.levelId === session.levelId)
  const now = Date.now()

  for (const entry of matchingEntries) {
    let conflictIndex = conflicts.length

    if (session.currentScore !== entry.score) {
      conflicts.push({
        id: `conflict-${now}-${conflictIndex}`,
        sessionId: session.id,
        field: 'score',
        notebookValue: String(entry.score),
        importedValue: String(session.currentScore),
        suggestion: '分数不一致，请核对会话得分与笔记记录，以实际计算结果为准',
        resolution: 'pending',
        detectedAt: now
      })
    }

    conflictIndex = conflicts.length

    const sessionFailReason = session.failReason ?? ''
    if (sessionFailReason !== entry.issue) {
      conflicts.push({
        id: `conflict-${now}-${conflictIndex}`,
        sessionId: session.id,
        field: 'failReason',
        notebookValue: entry.issue,
        importedValue: sessionFailReason,
        suggestion: '失败原因不一致，请核实实际失败原因与笔记描述',
        resolution: 'pending',
        detectedAt: now
      })
    }
  }

  return conflicts
}
