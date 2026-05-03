import { ProjectState } from '../types'

const STORAGE_KEY = 'subtitle-align-verifier-project'
const MAX_HISTORY = 10

export function saveProject(state: ProjectState): void {
  try {
    const data = JSON.stringify({
      state,
      savedAt: new Date().toISOString(),
      version: '1.0',
    })
    localStorage.setItem(STORAGE_KEY, data)
    
    saveToHistory(state)
  } catch (e) {
    console.error('保存项目失败:', e)
  }
}

export function loadProject(): ProjectState | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return null

    const parsed = JSON.parse(data)
    return parsed.state
  } catch (e) {
    console.error('加载项目失败:', e)
    return null
  }
}

export function clearProject(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    console.error('清除项目失败:', e)
  }
}

function saveToHistory(state: ProjectState): void {
  try {
    const historyKey = `${STORAGE_KEY}-history`
    const historyData = localStorage.getItem(historyKey)
    const history: Array<{ state: ProjectState; savedAt: string }> = historyData
      ? JSON.parse(historyData)
      : []

    history.unshift({
      state,
      savedAt: new Date().toISOString(),
    })

    if (history.length > MAX_HISTORY) {
      history.splice(MAX_HISTORY)
    }

    localStorage.setItem(historyKey, JSON.stringify(history))
  } catch (e) {
    console.error('保存历史失败:', e)
  }
}

export function getHistory(): Array<{ state: ProjectState; savedAt: string }> {
  try {
    const historyKey = `${STORAGE_KEY}-history`
    const historyData = localStorage.getItem(historyKey)
    return historyData ? JSON.parse(historyData) : []
  } catch (e) {
    console.error('获取历史失败:', e)
    return []
  }
}

export function exportProjectToJSON(state: ProjectState): string {
  const data = {
    state,
    exportedAt: new Date().toISOString(),
    version: '1.0',
  }
  return JSON.stringify(data, null, 2)
}

export function importProjectFromJSON(jsonString: string): ProjectState | null {
  try {
    const parsed = JSON.parse(jsonString)
    if (parsed.state) {
      return parsed.state
    }
    return parsed
  } catch (e) {
    console.error('导入项目失败:', e)
    return null
  }
}
