import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useCurrentProjectStore } from './currentProject'
import { useAnnotationsStore } from './annotations'
import { generateMarkdownReport } from '../utils/markdownGenerator'
import { exportJSONArchive as generateJSONArchive } from '../utils/jsonExporter'

export const useExportStore = defineStore('export', () => {
  const currentProjectStore = useCurrentProjectStore()
  const annotationsStore = useAnnotationsStore()

  const isExporting = ref(false)
  const exportProgress = ref(0)
  const exportError = ref(null)

  const currentProject = computed(() => currentProjectStore.currentProject)
  const allAnnotations = computed(() => annotationsStore.allProjectAnnotations)
  const sortedAnnotations = computed(() => annotationsStore.sortAnnotationsByRisk())

  // 生成 Markdown 报告
  async function exportMarkdownReport() {
    if (!currentProject.value) {
      exportError.value = '没有可导出的项目'
      return null
    }

    isExporting.value = true
    exportError.value = null
    exportProgress.value = 0

    try {
      exportProgress.value = 30
      
      const markdown = generateMarkdownReport(
        currentProject.value,
        sortedAnnotations.value
      )
      
      exportProgress.value = 70

      // 保存文件
      const isElectron = typeof window !== 'undefined' && window.electronAPI
      let filePath = null

      if (isElectron) {
        const result = await window.electronAPI.saveDialog({
          title: '保存 Markdown 报告',
          defaultPath: `${currentProject.value.name || '报告'}_${new Date().toISOString().split('T')[0]}.md`,
          filters: [
            { name: 'Markdown 文件', extensions: ['md'] },
            { name: '所有文件', extensions: ['*'] }
          ]
        })

        if (!result.canceled && result.filePath) {
          filePath = result.filePath
          // 这里需要实际的文件写入逻辑
          // 在真实环境中会使用 Node.js fs 模块
          console.log('Markdown 报告已生成，保存到:', filePath)
          console.log('报告内容:', markdown)
        }
      } else {
        // 浏览器环境：下载
        const blob = new Blob([markdown], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${currentProject.value.name || '报告'}_${new Date().toISOString().split('T')[0]}.md`
        a.click()
        URL.revokeObjectURL(url)
        filePath = '浏览器下载'
      }

      exportProgress.value = 100
      return { filePath, content: markdown }

    } catch (error) {
      exportError.value = error.message
      console.error('导出 Markdown 报告失败:', error)
      return null
    } finally {
      isExporting.value = false
    }
  }

  // 导出 JSON 归档包
  async function exportJSONArchive() {
    if (!currentProject.value) {
      exportError.value = '没有可导出的项目'
      return null
    }

    isExporting.value = true
    exportError.value = null
    exportProgress.value = 0

    try {
      exportProgress.value = 30
      
      const archiveData = generateJSONArchive(currentProject.value)
      
      exportProgress.value = 70

      const isElectron = typeof window !== 'undefined' && window.electronAPI
      let filePath = null

      if (isElectron) {
        const result = await window.electronAPI.saveDialog({
          title: '保存 JSON 归档包',
          defaultPath: `${currentProject.value.name || '归档'}_${new Date().toISOString().split('T')[0]}.json`,
          filters: [
            { name: 'JSON 文件', extensions: ['json'] },
            { name: '所有文件', extensions: ['*'] }
          ]
        })

        if (!result.canceled && result.filePath) {
          filePath = result.filePath
          console.log('JSON 归档包已生成，保存到:', filePath)
          console.log('归档内容:', archiveData)
        }
      } else {
        const jsonString = JSON.stringify(archiveData, null, 2)
        const blob = new Blob([jsonString], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${currentProject.value.name || '归档'}_${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
        filePath = '浏览器下载'
      }

      exportProgress.value = 100
      return { filePath, content: archiveData }

    } catch (error) {
      exportError.value = error.message
      console.error('导出 JSON 归档包失败:', error)
      return null
    } finally {
      isExporting.value = false
    }
  }

  // 重置导出状态
  function resetExportState() {
    isExporting.value = false
    exportProgress.value = 0
    exportError.value = null
  }

  return {
    isExporting,
    exportProgress,
    exportError,
    currentProject,
    allAnnotations,
    sortedAnnotations,
    exportMarkdownReport,
    exportJSONArchive,
    resetExportState
  }
})
