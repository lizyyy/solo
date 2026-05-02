import { reactive, computed } from 'vue'
import { checkAltRules } from '../rules/altRules.js'
import { checkHeadingRules } from '../rules/headingRules.js'
import { checkManifestRules, checkSpineRules } from '../rules/manifestRules.js'
import { checkTocRules } from '../rules/tocRules.js'
import { RuleSeverity } from '../rules/index.js'

const state = reactive({
  epubData: null,
  parsedData: null,
  issues: [],
  warnings: [],
  selectedChapterId: null,
  selectedIssueId: null,
  filters: {
    severity: null,
    type: null,
    chapterId: null,
    searchText: ''
  },
  loading: false,
  error: null,
  fileName: ''
})

function runAllRules(parsedData) {
  const allIssues = []
  const allWarnings = []

  for (const chapter of parsedData.chapters) {
    allIssues.push(...checkAltRules(chapter, chapter.id))
    allIssues.push(...checkHeadingRules(chapter, chapter.id))
  }

  allIssues.push(...checkManifestRules(parsedData))
  allIssues.push(...checkSpineRules(parsedData))
  allIssues.push(...checkTocRules(parsedData))

  return { issues: allIssues, warnings: allWarnings }
}

export const useInspectorStore = () => {
  const setEpubData = async (file) => {
    state.loading = true
    state.error = null
    state.fileName = file.name

    try {
      const { parseEPUB } = await import('../parsers/EPUBParser.js')
      const parsed = await parseEPUB(file)

      state.epubData = parsed
      state.parsedData = parsed

      const { issues } = runAllRules(parsed)
      state.issues = issues.map((issue, index) => ({
        ...issue,
        id: `issue-${index}`
      }))

      state.warnings = parsed.warnings || []

      state.loading = false
    } catch (err) {
      state.loading = false
      state.error = {
        message: err.message,
        type: err.type || 'generic'
      }
      throw err
    }
  }

  const setSelectedChapter = (chapterId) => {
    state.selectedChapterId = chapterId
  }

  const setSelectedIssue = (issueId) => {
    state.selectedIssueId = issueId
  }

  const setFilter = (key, value) => {
    state.filters[key] = value
  }

  const clearFilters = () => {
    state.filters.severity = null
    state.filters.type = null
    state.filters.chapterId = null
    state.filters.searchText = ''
  }

  const clearAll = () => {
    state.epubData = null
    state.parsedData = null
    state.issues = []
    state.warnings = []
    state.selectedChapterId = null
    state.selectedIssueId = null
    state.loading = false
    state.error = null
    state.fileName = ''
    clearFilters()
  }

  const filteredIssues = computed(() => {
    let result = state.issues

    if (state.filters.severity) {
      result = result.filter(i => i.rule?.severity === state.filters.severity)
    }

    if (state.filters.type) {
      result = result.filter(i => i.rule?.type === state.filters.type)
    }

    if (state.filters.chapterId) {
      result = result.filter(i => i.chapterId === state.filters.chapterId)
    }

    if (state.filters.searchText) {
      const search = state.filters.searchText.toLowerCase()
      result = result.filter(i =>
        i.message?.toLowerCase().includes(search) ||
        i.rule?.name?.toLowerCase().includes(search)
      )
    }

    return result
  })

  const issuesBySeverity = computed(() => {
    const counts = {
      critical: 0,
      warning: 0,
      info: 0
    }
    for (const issue of state.issues) {
      const sev = issue.rule?.severity || 'info'
      counts[sev]++
    }
    return counts
  })

  const issuesByChapter = computed(() => {
    const map = {}
    for (const issue of state.issues) {
      const cid = issue.chapterId || 'general'
      if (!map[cid]) {
        map[cid] = {
          chapterId: cid,
          chapterTitle: issue.chapterTitle || '全局问题',
          count: 0,
          critical: 0,
          warning: 0
        }
      }
      map[cid].count++
      const sev = issue.rule?.severity || 'info'
      if (sev === 'critical') map[cid].critical++
      else if (sev === 'warning') map[cid].warning++
    }
    return Object.values(map).sort((a, b) => b.count - a.count)
  })

  const selectedChapter = computed(() => {
    if (!state.selectedChapterId || !state.parsedData) return null
    return state.parsedData.chapters.find(c => c.id === state.selectedChapterId)
  })

  const selectedIssue = computed(() => {
    if (!state.selectedIssueId) return null
    return state.issues.find(i => i.id === state.selectedIssueId)
  })

  return {
    state,
    setEpubData,
    setSelectedChapter,
    setSelectedIssue,
    setFilter,
    clearFilters,
    clearAll,
    filteredIssues,
    issuesBySeverity,
    issuesByChapter,
    selectedChapter,
    selectedIssue
  }
}

export { state }
