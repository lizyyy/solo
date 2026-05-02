import { Rules } from './index.js'

export function checkTocRules(parsedData) {
  const issues = []
  const { toc, manifest, files, opfPath } = parsedData
  const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1)

  if (!toc || toc.length === 0) return issues

  function normalizePath(path) {
    const parts = path.split('/')
    const normalized = []
    for (const part of parts) {
      if (part === '..') {
        normalized.pop()
      } else if (part !== '.' && part !== '') {
        normalized.push(part)
      }
    }
    return normalized.join('/')
  }

  for (const np of toc) {
    if (!np.src) continue

    const srcFile = np.src.split('#')[0]
    if (!srcFile) continue

    const targetPath = normalizePath(opfDir + srcFile)

    if (!files[targetPath]) {
      issues.push({
        rule: Rules.TOC_001,
        chapterId: null,
        chapterTitle: np.label,
        element: 'nav point',
        location: `"${np.label}" -> ${np.src}`,
        details: { src: np.src, targetPath },
        message: `目录指向不存在的文件: ${np.src}`
      })
    }
  }

  return issues
}
