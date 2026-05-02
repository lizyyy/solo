import { Rules } from './index.js'

export function checkManifestRules(parsedData) {
  const issues = []
  const { manifest, spine, manifestMap, files, opfPath } = parsedData
  const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1)

  const idCount = {}
  for (const item of manifest) {
    idCount[item.id] = (idCount[item.id] || 0) + 1
  }
  for (const [id, count] of Object.entries(idCount)) {
    if (count > 1) {
      issues.push({
        rule: Rules.MANIFEST_001,
        chapterId: null,
        chapterTitle: null,
        element: 'manifest item',
        location: `id="${id}"`,
        details: { id, count },
        message: `manifest 中 id="${id}" 重复出现 ${count} 次`
      })
    }
  }

  const manifestIds = new Set(manifest.map(i => i.id))
  for (const ref of spine) {
    if (!manifestIds.has(ref.idref)) {
      issues.push({
        rule: Rules.MANIFEST_002,
        chapterId: ref.idref,
        chapterTitle: null,
        element: 'spine itemref',
        location: `idref="${ref.idref}"`,
        details: { idref: ref.idref },
        message: `spine 引用了 manifest 中不存在的 id: ${ref.idref}`
      })
    }
  }

  return issues
}

export function checkSpineRules(parsedData) {
  const issues = []
  const { manifest, spine, manifestMap, chapters, files, opfPath } = parsedData
  const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1)

  for (const chapter of chapters) {
    if (chapter.error && chapter.error.includes('找不到文件')) {
      issues.push({
        rule: Rules.SPINE_001,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        element: 'spine itemref',
        location: `id="${chapter.id}"`,
        details: { href: chapter.href },
        message: `spine 章节文件不存在: ${chapter.href}`
      })
    }
  }

  return issues
}
