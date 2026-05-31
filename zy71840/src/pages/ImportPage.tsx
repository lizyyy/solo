import React, { useState, useRef } from 'react'
import { useStore } from '../store/useStore'
import { Upload, ArrowLeft, AlertTriangle, CheckCircle, FileJson, Eye } from 'lucide-react'
import { ModelData } from '../types'
import { v4 as uuidv4 } from 'uuid'
import { compareVersions } from '../utils/detection'

export const ImportPage = () => {
  const { 
    currentProject, 
    currentVersion, 
    versions, 
    setCurrentPage, 
    createVersion,
    selectVersion,
    importProjectData
  } = useStore()
  
  const [dragOver, setDragOver] = useState(false)
  const [versionName, setVersionName] = useState('')
  const [previewModels, setPreviewModels] = useState<ModelData[]>([])
  const [changes, setChanges] = useState<any[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const projectVersions = currentProject 
    ? versions.filter(v => v.projectId === currentProject.id).sort((a, b) => b.versionNumber - a.versionNumber)
    : []
  
  const handleFileUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        
        if (data.models && Array.isArray(data.models)) {
          const models: ModelData[] = data.models.map((m: any) => ({
            ...m,
            id: m.id || uuidv4()
          }))
          setPreviewModels(models)
          
          if (currentVersion) {
            const versionChanges = compareVersions(currentVersion.models, models)
            setChanges(versionChanges)
          }
          setShowConfirm(true)
        } else if (data.projects) {
          importProjectData(JSON.stringify(data))
          alert('项目数据导入成功！')
        }
      } catch (error) {
        alert('文件解析失败，请检查文件格式')
      }
    }
    reader.readAsText(file)
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }
  
  const handleCreateVersion = () => {
    if (previewModels.length > 0) {
      createVersion(versionName || `版本 ${projectVersions.length + 1}`, previewModels)
      setPreviewModels([])
      setChanges([])
      setShowConfirm(false)
      setVersionName('')
    }
  }
  
  const criticalChanges = changes.filter(c => 
    c.type === 'rotation_changed' || c.type === 'position_changed'
  )
  
  const hasCriticalChanges = criticalChanges.length > 0
  
  return (
    <div className="h-full bg-slate-100 flex flex-col">
      <header className="bg-white shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentPage('home')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">模型导入</h1>
              <p className="text-sm text-slate-500">
                项目: {currentProject?.name || '未选择'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentPage('inspection')}
              disabled={!currentVersion}
              className="px-4 py-2 bg-secondary hover:bg-orange-600 disabled:bg-slate-300 text-white rounded-lg transition-colors"
            >
              开始巡检
            </button>
          </div>
        </div>
      </header>
      
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
              dragOver 
                ? 'border-secondary bg-orange-50' 
                : 'border-slate-300 bg-white hover:border-slate-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
            <Upload className={`w-12 h-12 mx-auto mb-4 ${dragOver ? 'text-secondary' : 'text-slate-400'}`} />
            <p className="text-lg font-medium text-slate-700 mb-2">
              拖拽文件到此处或点击上传
            </p>
            <p className="text-sm text-slate-500">支持 JSON 格式的模型清单文件</p>
          </div>
          
          {showConfirm && (
            <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">版本预览</h3>
                
                {hasCriticalChanges && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-yellow-800">检测到关键变更！</p>
                        <p className="text-sm text-yellow-700 mt-1">
                          以下变更可能影响巡检结果，请仔细确认后再继续：
                        </p>
                        <ul className="mt-2 space-y-1">
                          {criticalChanges.slice(0, 5).map((c, i) => (
                            <li key={i} className="text-sm text-yellow-700">• {c.message}</li>
                          ))}
                          {criticalChanges.length > 5 && (
                            <li className="text-sm text-yellow-700">
                              • 还有 {criticalChanges.length - 5} 项变更...
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    版本名称
                  </label>
                  <input
                    type="text"
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    placeholder={`版本 ${projectVersions.length + 1}`}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-secondary"
                  />
                </div>
                
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">
                    模型预览 ({previewModels.length} 个模型)
                  </h4>
                  <div className="max-h-48 overflow-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-slate-600">模型名称</th>
                          <th className="px-4 py-2 text-left text-slate-600">类型</th>
                          <th className="px-4 py-2 text-left text-slate-600">位置</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewModels.map(model => (
                          <tr key={model.id} className="border-t border-slate-100">
                            <td className="px-4 py-2">{model.name}</td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                model.type === 'exhibit' 
                                  ? 'bg-blue-100 text-blue-700' 
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {model.type === 'exhibit' ? '展品' : '结构'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-slate-500">
                              ({model.position.x.toFixed(1)}, {model.position.y.toFixed(1)}, {model.position.z.toFixed(1)})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowConfirm(false)
                    setPreviewModels([])
                    setChanges([])
                  }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateVersion}
                  className="px-4 py-2 bg-secondary hover:bg-orange-600 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  {hasCriticalChanges ? (
                    <>
                      <AlertTriangle className="w-4 h-4" />
                      确认变更并创建版本
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      创建版本
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
          
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">历史版本</h3>
            {projectVersions.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
                <FileJson className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">暂无版本记录，请上传模型文件创建第一个版本</p>
              </div>
            ) : (
              <div className="space-y-3">
                {projectVersions.map(version => (
                  <div
                    key={version.id}
                    onClick={() => selectVersion(version.id)}
                    className={`p-4 bg-white rounded-xl border cursor-pointer transition-all ${
                      currentVersion?.id === version.id
                        ? 'border-secondary shadow-md'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <h4 className="font-medium text-slate-800">{version.name}</h4>
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                            v{version.versionNumber}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                          {version.models.length} 个模型 · 创建于 {new Date(version.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {currentVersion?.id === version.id && (
                        <Eye className="w-5 h-5 text-secondary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
