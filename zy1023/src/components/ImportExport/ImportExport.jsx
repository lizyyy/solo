import React, { useRef } from 'react'
import { useProject } from '../../context/ProjectContext'
import { exportProjectToJSON, importProjectFromJSON } from '../../utils/storage'
import { generateMarkdown, generateCSV, downloadFile } from '../../utils/exportUtils'
import './ImportExport.css'

function ImportExport() {
  const { state, dispatch, actions } = useProject()
  const { markers, audioInfo, version } = state
  
  const fileInputRef = useRef(null)
  
  const handleExportProject = () => {
    const projectData = {
      version,
      exportedAt: Date.now(),
      audioInfo: audioInfo,
      markers: markers,
      settings: {
        createdAt: Date.now()
      }
    }
    
    const json = exportProjectToJSON(projectData)
    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `audio-marker-project-${timestamp}.json`
    
    downloadFile(json, filename, 'application/json')
  }
  
  const handleImportProject = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result
      if (typeof content === 'string') {
        const project = importProjectFromJSON(content)
        if (project) {
          dispatch({ type: 'LOAD_PROJECT', payload: project })
        } else {
          alert('无效的工程文件格式')
        }
      }
    }
    reader.readAsText(file)
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  const handleExportMarkdown = () => {
    if (markers.length === 0) {
      alert('暂无标记可导出')
      return
    }
    
    const content = generateMarkdown(markers, audioInfo)
    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `剪辑清单-${timestamp}.md`
    
    downloadFile(content, filename, 'text/markdown')
  }
  
  const handleExportCSV = () => {
    if (markers.length === 0) {
      alert('暂无标记可导出')
      return
    }
    
    const content = generateCSV(markers, audioInfo)
    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `剪辑清单-${timestamp}.csv`
    
    downloadFile(content, filename, 'text/csv;charset=utf-8')
  }
  
  const handleClearAll = () => {
    if (markers.length === 0) return
    
    if (window.confirm('确定要清除所有标记吗？此操作不可撤销。')) {
      dispatch({ type: 'SET_MARKERS', payload: [] })
    }
  }
  
  return (
    <div className="import-export">
      <div className="section-header">
        <h3 className="section-title">工程管理</h3>
      </div>
      
      <div className="export-buttons">
        <div className="button-group">
          <h4 className="group-title">工程文件</h4>
          <div className="button-row">
            <label className="action-button import-btn">
              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleImportProject}
                className="hidden-input"
              />
              📂 导入工程
            </label>
            
            <button
              className="action-button export-btn"
              onClick={handleExportProject}
            >
              💾 导出工程
            </button>
          </div>
        </div>
        
        <div className="button-group">
          <h4 className="group-title">剪辑清单</h4>
          <div className="button-row">
            <button
              className="action-button markdown-btn"
              onClick={handleExportMarkdown}
            >
              📝 导出 Markdown
            </button>
            
            <button
              className="action-button csv-btn"
              onClick={handleExportCSV}
            >
              📊 导出 CSV
            </button>
          </div>
        </div>
      </div>
      
      <div className="danger-zone">
        <button
          className="danger-button"
          onClick={handleClearAll}
          disabled={markers.length === 0}
        >
          🗑️ 清除所有标记
        </button>
      </div>
      
      <div className="storage-info">
        <span className="info-icon">ℹ️</span>
        <span className="info-text">数据自动保存到浏览器本地存储，刷新后不会丢失</span>
      </div>
    </div>
  )
}

export default ImportExport
