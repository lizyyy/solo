const STORAGE_KEY = 'audio_marker_project'

export const saveProject = (projectData) => {
  try {
    const data = JSON.stringify(projectData)
    localStorage.setItem(STORAGE_KEY, data)
    return true
  } catch (error) {
    console.error('保存项目失败:', error)
    return false
  }
}

export const loadProject = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return null
    return JSON.parse(data)
  } catch (error) {
    console.error('加载项目失败:', error)
    return null
  }
}

export const clearProject = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
    return true
  } catch (error) {
    console.error('清除项目失败:', error)
    return false
  }
}

export const exportProjectToJSON = (projectData) => {
  return JSON.stringify(projectData, null, 2)
}

export const importProjectFromJSON = (jsonString) => {
  try {
    return JSON.parse(jsonString)
  } catch (error) {
    console.error('解析JSON解析失败:', error)
    return null
  }
}
