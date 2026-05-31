import React, { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { Scene3D } from '../components/Scene3D'
import { 
  ArrowLeft, 
  Settings,
} from 'lucide-react'
import { getIssueTypeName, getStatusName, getStatusColor, detectAllIssues } from '../utils/detection'
import { IssueStatus } from '../types'

export const InspectionPage = () => {
  const { 
    currentVersion, 
    currentProject,
    issues,
    setCurrentPage,
    addIssue,
    updateIssueStatus,
    selectedModelId,
    selectedIssueId,
    selectModel,
    selectIssue,
    updateModel
  } = useStore()
  
  const [showModelEdit, setShowModelEdit] = useState(false)
  
  const versionIssues = currentVersion 
    ? issues.filter(i => i.versionId === currentVersion.id)
    : []
  
  const selectedModel = currentVersion?.models.find(m => m.id === selectedModelId)
  
  useEffect(() => {
    if (currentVersion && versionIssues.length === 0) {
      const detectedIssues = detectAllIssues(currentVersion.models, currentVersion.inspectionPath)
      detectedIssues.forEach(issue => {
        addIssue({
          ...issue,
          versionId: currentVersion.id
        })
      })
    }
  }, [currentVersion?.id])
  
  const handleIssueStatusChange = (issueId: string, status: IssueStatus) => {
    updateIssueStatus(issueId, status)
  }
  
  const handleModelPositionChange = (axis: 'x' | 'y' | 'z', delta: number) => {
    if (!selectedModelId || !selectedModel) return
    updateModel(selectedModelId, {
      position: {
        ...selectedModel.position,
        [axis]: selectedModel.position[axis] + delta
      }
    })
  }
  
  const handleModelRotationChange = (axis: 'x' | 'y' | 'z', delta: number) => {
    if (!selectedModelId || !selectedModel) return
    updateModel(selectedModelId, {
      rotation: {
        ...selectedModel.rotation,
        [axis]: selectedModel.rotation[axis] + delta
      }
    })
  }
  
  const pendingCount = versionIssues.filter(i => i.status === 'PENDING').length
  const confirmedCount = versionIssues.filter(i => i.status === 'CONFIRMED').length
  const resolvedCount = versionIssues.filter(i => i.status === 'RESOLVED').length
  
  if (!currentVersion) {
    return (
      <div className="h-full bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500">请先选择项目和版本</p>
          <button
            onClick={() => setCurrentPage('import')}
            className="mt-4 px-4 py-2 bg-secondary text-white rounded-lg"
          >
            去导入页面
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="h-full bg-slate-100 flex flex-col">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentPage('import')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800">3D巡检</h1>
            <p className="text-xs text-slate-500">
              {currentProject?.name} - {currentVersion.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
              <span className="text-slate-600">待确认 {pendingCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              <span className="text-slate-600">已确认 {confirmedCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-slate-600">已解决 {resolvedCount}</span>
            </div>
          </div>
          <button
            onClick={() => setCurrentPage('history')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm transition-colors"
          >
            历史记录
          </button>
          <button
            onClick={() => setCurrentPage('export')}
            className="px-3 py-1.5 bg-secondary hover:bg-orange-600 text-white rounded-lg text-sm transition-colors"
          >
            导出报告
          </button>
        </div>
      </header>
      
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 bg-slate-900 relative">
          <Scene3D
            models={currentVersion.models}
            issues={versionIssues}
            inspectionPath={currentVersion.inspectionPath}
            selectedModelId={selectedModelId}
            selectedIssueId={selectedIssueId}
            onModelSelect={selectModel}
            onIssueSelect={selectIssue}
          />
          <div className="absolute bottom-4 left-4 bg-black/50 text-white text-xs px-3 py-2 rounded">
            鼠标左键: 旋转 | 滚轮: 缩放 | 右键: 平移
          </div>
        </div>
        
        <div className="w-96 bg-white border-l border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">问题列表</h2>
            <p className="text-xs text-slate-500">共 {versionIssues.length} 个问题</p>
          </div>
          
          <div className="flex-1 overflow-auto scrollbar-thin p-3 space-y-3">
            {versionIssues.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                暂无问题
              </div>
            ) : (
              versionIssues.map(issue => {
                const relatedModel = currentVersion.models.find(m => m.id === issue.modelId)
                return (
                  <div
                    key={issue.id}
                    onClick={() => selectIssue(issue.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedIssueId === issue.id
                        ? 'border-secondary bg-orange-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${getStatusColor(issue.status)}`}>
                          {getStatusName(issue.status)}
                        </span>
                        <h4 className="text-sm font-medium text-slate-800 mt-1">
                          {getIssueTypeName(issue.type)}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {relatedModel?.name}
                        </p>
                      </div>
                    </div>
                    {selectedIssueId === issue.id && (
                      <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                        <div>
                          <p className="text-xs font-medium text-slate-600 mb-1">检测原因:</p>
                          <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded">
                            {issue.reason}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-600 mb-1">下一步:</p>
                          <p className="text-xs text-secondary bg-orange-50 p-2 rounded">
                            {issue.nextStep}
                          </p>
                        </div>
                        {issue.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleIssueStatusChange(issue.id, 'CONFIRMED')
                              }}
                              className="flex-1 px-2 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs"
                            >
                              确认问题
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleIssueStatusChange(issue.id, 'DISMISSED')
                              }}
                              className="flex-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs"
                            >
                              标记正常
                            </button>
                          </div>
                        )}
                        {issue.status === 'CONFIRMED' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleIssueStatusChange(issue.id, 'RESOLVED')
                            }}
                            className="w-full px-2 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs"
                          >
                            标记已解决
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
        
        {selectedModel && (
          <div className="w-72 bg-white border-l border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">模型属性</h2>
              <button
                onClick={() => setShowModelEdit(!showModelEdit)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <Settings className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-800">{selectedModel.name}</p>
                <p className="text-xs text-slate-500">
                  {selectedModel.type === 'exhibit' ? '展品' : '结构'}
                </p>
              </div>
              
              {showModelEdit && (
                <>
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-2">位置</p>
                    <div className="space-y-2">
                      {(['x', 'y', 'z'] as const).map(axis => (
                        <div key={axis} className="flex items-center gap-2">
                          <span className="w-4 text-xs text-slate-500 uppercase">{axis}</span>
                          <input
                            type="number"
                            value={selectedModel.position[axis]}
                            onChange={(e) => updateModel(selectedModelId!, {
                              position: { ...selectedModel.position, [axis]: parseFloat(e.target.value) || 0 }
                            })}
                            className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs"
                            step="0.1"
                          />
                          <button
                            onClick={() => handleModelPositionChange(axis, 0.1)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs"
                          >
                            +
                          </button>
                          <button
                            onClick={() => handleModelPositionChange(axis, -0.1)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs"
                          >
                            -
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-2">旋转</p>
                    <div className="space-y-2">
                      {(['x', 'y', 'z'] as const).map(axis => (
                        <div key={axis} className="flex items-center gap-2">
                          <span className="w-4 text-xs text-slate-500 uppercase">{axis}</span>
                          <input
                            type="number"
                            value={selectedModel.rotation[axis]}
                            onChange={(e) => updateModel(selectedModelId!, {
                              rotation: { ...selectedModel.rotation, [axis]: parseFloat(e.target.value) || 0 }
                            })}
                            className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs"
                            step="0.1"
                          />
                          <button
                            onClick={() => handleModelRotationChange(axis, 0.1)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs"
                          >
                            +
                          </button>
                          <button
                            onClick={() => handleModelRotationChange(axis, -0.1)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs"
                          >
                            -
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              
              <div className="pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  点击3D场景中的模型可以通过属性面板进行微调位置
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
