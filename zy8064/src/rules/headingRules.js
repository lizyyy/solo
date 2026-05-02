import { Rules, RuleSeverity } from './index.js'

export function checkHeadingRules(chapter, chapterId) {
  const issues = []
  const { headings } = chapter.accessibility || {}

  if (!headings || headings.length === 0) return issues

  const sortedByPosition = [...headings].sort((a, b) => {
    const aLevel = a.level
    const bLevel = b.level
    return aLevel - bLevel
  })

  for (let i = 1; i < sortedByPosition.length; i++) {
    const prev = sortedByPosition[i - 1]
    const curr = sortedByPosition[i]
    const gap = curr.level - prev.level

    if (gap > 1) {
      issues.push({
        rule: Rules.HEADING_001,
        chapterId,
        chapterTitle: chapter.title,
        element: curr.tag,
        location: `"${curr.text.substring(0, 30)}"`,
        details: { from: `h${prev.level}`, to: `h${curr.level}`, text: curr.text },
        message: `标题层级跳跃: 从 h${prev.level} 直接跳到 h${curr.level}，文本: "${curr.text.substring(0, 30)}"`
      })
    }
  }

  const levels = new Set(headings.map(h => h.level))
  const minLevel = Math.min(...levels)
  for (let l = minLevel; l <= minLevel + 2; l++) {
    if (l > minLevel && l <= minLevel + 2 && !levels.has(l) && levels.has(l + 1)) {
      const text = headings.find(h => h.level === l + 1)?.text || ''
      issues.push({
        rule: Rules.HEADING_002,
        chapterId,
        chapterTitle: chapter.title,
        element: `h${l}`,
        location: `缺少 h${l}`,
        details: { missing: `h${l}`, found: Array.from(levels).sort() },
        message: `缺少 h${l} 层级标题，当前有 ${Array.from(levels).sort().join(', ')}`
      })
    }
  }

  return issues
}
