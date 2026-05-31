import React, { useState } from 'react'
import { useStore } from '../store/useStore'
import { ArrowLeft, Clock, FileText, AlertTriangle } from 'lucide-react'
import { getIssueTypeName, getStatusName, getStatusColor, compareVersions } from '../utils/detection'

export const HistoryPage = () => {
  const { 
    currentProject, 
    currentVersion,
    versions, 
    issues,
    operationLogs,
    setCurrentPage,
    selectVersion
  } = useStore()
  
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null)
  
  const projectVersions = currentProject 
    ? versions.filter(v => v.projectId === currentProject.id).sort((a, b) => b.versionNumber - a.versionNumber)
    : []
  
  const versionLogs = currentVersion
    ? operationLogs.filter(l => l.versionId === currentVersion.id).sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
    : []
  
  const versionIssues = currentVersion
    ? issues.filter(i => i.versionId === currentVersion.id)
    : []
  
  const compareVersion = versions.find(v => v.id === compareVersionId)
  
  const changes = currentVersion && compareVersion
    ? compareVersions(compareVersion.models, currentVersion.models)
    : []
  
  return (
    <div className="h-full bg-slate-100 flex flex-col">
      <header className="bg-white shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentPage('inspection')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">历史记录</h1>
              <p className="text-sm text-slate-500">
                {currentProject?.name || '未选择项目'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setCurrentPage('export')}
            className="px-4 py-2 bg-secondary hover:bg-orange-600 text-white rounded-lg transition-colors"
          >
            导出报告
          </button>
        </div>
      </header>
      
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-6xl mx-auto grid grid-cols-3 gap-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-500" />
              版本列表
            </h2>
            <div className="space-y-3">
              {projectVersions.length === 0 ? (
                <div className="bg-white rounded-xl p-6 text-center border border-slate-200">
                  <p className="text-slate-500">暂无版本记录</p>
                </div>
              ) : (
                projectVersions.map(version => {
                  const issueCount = issues.filter(i => i.versionId === version.id).length
                  return (
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
                          <h3 className="font-medium text-slate-800">{version.name}</h3>
                          <p className="text-xs text-slate-500 mt-1">
                            v{version.versionNumber} · {version.models.length} 个模型
                          </p>
                        </div>
                        {issueCount > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                            {issueCount} 个问题
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        {new Date(version.createdAt).toLocaleString()}
                      </p>
                      {currentVersion?.id === version.id && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <select
                            className="w-full text-xs px-2 py-1 border border-slate-200 rounded"
                            value={compareVersionId || ''}
                            onChange={(e) => setCompareVersionId(e.target.value || null)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="">选择版本进行对比</option>
                            {projectVersions
                              .filter(v => v.id !== version.id)
                              .map(v => (
                                <option key={v.id} value={v.id}>
                                  与 {v.name} 对比
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
          
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-500" />
              操作日志
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {versionLogs.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-slate-500">暂无操作记录</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-96 overflow-auto">
                  {versionLogs.map(log => (
                    <div key={log.id} className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full mt-1.5 bg-secondary flex-shrink-0"></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800">{log.description}</p>
                          {log.oldValue && log.newValue && (
                            <div className="mt-1 text-xs text-slate-500">
                              <span className="text-red-500">- {log.oldValue.substring(0, 30)}</span>
                              <span className="mx-1">→</span>
                              <span className="text-green-500">+ {log.newValue.substring(0, 30)}...</span>
                            </div>
                          )}
                          <p className="text-xs text-slate-400 mt-1">
                            {log.operator} · {new Date(log.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-slate-500" />
              问题汇总
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {versionIssues.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-slate-500">暂无问题记录</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-96 overflow-auto">
                  {versionIssues.map(issue => {
                    const model = currentVersion?.models.find(m => m.id === issue.modelId)
                    return (
                      <div key={issue.id} className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${getStatusColor(issue.status)}`}>
                            {getStatusName(issue.status)}
                          </span>
                          <span className="text-xs text-slate-500">
                            {getIssueTypeName(issue.type)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700">{model?.name}</p>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{issue.reason}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            
            {changes.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">
                  版本变更对比
                </h3>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  {changes.map((change, index) => (
                    <div key={index} className="py-2 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          change.type === 'added' ? 'bg-green-500' :
                          change.type === 'removed' ? 'bg-red-500' :
                          'bg-yellow-500'
                        }`}></span>
                        <span className="text-sm text-slate-700">{change.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
