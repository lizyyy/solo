import React, { useState } from 'react'
import { useStore } from '../store/useStore'
import { FolderPlus, FolderOpen, Database, ArrowRight } from 'lucide-react'

export const HomePage = () => {
  const { projects, createProject, selectProject, setCurrentPage, loadSampleData, currentProject } = useStore()
  const [newProjectName, setNewProjectName] = useState('')
  const [showNewProject, setShowNewProject] = useState(false)
  
  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      createProject(newProjectName.trim())
      setNewProjectName('')
      setShowNewProject(false)
    }
  }
  
  const handleSelectProject = (projectId: string) => {
    selectProject(projectId)
    setCurrentPage('import')
  }
  
  return (
    <div className="h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <header className="px-8 py-6 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                <Database className="w-6 h-6 text-white" />
              </div>
              地下管廊巡视系统
            </h1>
            <p className="text-slate-400 mt-1">3D模型巡检、智能检测、历史追溯</p>
          </div>
          <button
            onClick={() => loadSampleData()}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
          >
            加载示例数据
          </button>
        </div>
      </header>
      
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">项目列表</h2>
            <button
              onClick={() => setShowNewProject(true)}
              className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-orange-600 text-white rounded-lg transition-colors"
            >
              <FolderPlus className="w-5 h-5" />
              新建项目
            </button>
          </div>
          
          {showNewProject && (
            <div className="bg-slate-800 rounded-xl p-6 mb-6 border border-slate-700">
              <h3 className="text-lg font-medium text-white mb-4">创建新项目</h3>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="输入项目名称..."
                  className="flex-1 px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-secondary"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
                />
                <button
                  onClick={handleCreateProject}
                  className="px-6 py-3 bg-secondary hover:bg-orange-600 text-white rounded-lg transition-colors"
                >
                  创建
                </button>
                <button
                  onClick={() => setShowNewProject(false)}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}
          
          {projects.length === 0 ? (
            <div className="text-center py-16 bg-slate-800 rounded-xl border border-slate-700">
              <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-slate-400 mb-4">暂无项目，点击上方按钮创建或加载示例数据</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {projects.map(project => (
                <div
                  key={project.id}
                  onClick={() => handleSelectProject(project.id)}
                  className={`p-6 rounded-xl border cursor-pointer transition-all hover:shadow-lg ${
                    currentProject?.id === project.id
                      ? 'bg-secondary/20 border-secondary'
                      : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center">
                        <FolderOpen className="w-6 h-6 text-slate-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-white">{project.name}</h3>
                        <p className="text-sm text-slate-400">
                          创建于 {new Date(project.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-500" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      
      <footer className="px-8 py-4 border-t border-slate-700 text-center text-slate-500 text-sm">
        地下管廊巡视系统 - 确保每一次巡检都有迹可循
      </footer>
    </div>
  )
}
