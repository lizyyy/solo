import React, { useState, useEffect } from 'react'
import { ProjectProvider, useProject } from './context/ProjectContext'
import AudioPlayer from './components/AudioPlayer/AudioPlayer'
import Timeline from './components/Timeline/Timeline'
import MarkerTool from './components/MarkerTool/MarkerTool'
import MarkerEditor from './components/MarkerEditor/MarkerEditor'
import MarkerList from './components/MarkerList/MarkerList'
import ImportExport from './components/ImportExport/ImportExport'
import { mockProject } from './data/mockData'
import './App.css'

function AppContent() {
  const { state, actions } = useProject()
  const { audioInfo } = state
  const [showDemoPrompt, setShowDemoPrompt] = useState(false)
  
  useEffect(() => {
    if (!audioInfo) {
      setShowDemoPrompt(true)
    }
  }, [audioInfo])
  
  const handleLoadDemo = () => {
    actions.initMockData(mockProject)
    setShowDemoPrompt(false)
  }
  
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <span className="app-icon">🎵</span>
          <h1>音频粗标工具</h1>
        </div>
        <div className="app-subtitle">
          快速标记播客或长录音，给剪辑师的预处理工具
        </div>
      </header>
      
      <main className="app-main">
        <aside className="left-sidebar">
          <MarkerTool />
          <MarkerEditor />
          <ImportExport />
        </aside>
        
        <section className="main-content">
          {showDemoPrompt && (
            <div className="demo-prompt">
              <div className="prompt-content">
                <h3>👋 欢迎使用音频粗标工具</h3>
                <p>你可以：</p>
                <ul>
                  <li>导入自己的音频文件</li>
                  <li>或者先用演示数据体验功能</li>
                </ul>
                <button className="demo-button" onClick={handleLoadDemo}>
                  📊 加载演示数据
                </button>
              </div>
            </div>
          )}
          
          <AudioPlayer />
          <Timeline />
        </section>
        
        <aside className="right-sidebar">
          <MarkerList />
        </aside>
      </main>
      
      <footer className="app-footer">
        <span>提示：数据自动保存到浏览器本地存储</span>
        <span>|</span>
        <span>时间轴支持滚轮缩放、拖拽定位</span>
      </footer>
    </div>
  )
}

function App() {
  return (
    <ProjectProvider>
      <AppContent />
    </ProjectProvider>
  )
}

export default App
