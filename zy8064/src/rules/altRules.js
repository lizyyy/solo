import { Rules, RuleSeverity } from './index.js'

export function checkAltRules(chapter, chapterId) {
  const issues = []
  const { images } = chapter.accessibility || {}

  if (!images || images.length === 0) return issues

  for (let i = 0; i < images.length; i++) {
    const img = images[i]

    if (!img.hasAlt) {
      issues.push({
        rule: Rules.ALT_001,
        chapterId,
        chapterTitle: chapter.title,
        element: 'img',
        location: `第 ${i + 1} 个图片`,
        details: { src: img.src },
        message: `图片缺少 alt 属性，src: ${img.src}`
      })
    } else if (img.altIsEmpty) {
      issues.push({
        rule: Rules.ALT_002,
        chapterId,
        chapterTitle: chapter.title,
        element: 'img',
        location: `第 ${i + 1} 个图片`,
        details: { src: img.src },
        message: `图片 alt 为空字符串，src: ${img.src}`
      })
    }
  }

  return issues
}
