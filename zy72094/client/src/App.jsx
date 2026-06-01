import React, { useState, useEffect } from 'react'
import ConflictList from './components/ConflictList'
import ParamsPanel from './components/ParamsPanel'
import Statistics from './components/Statistics'
import DataUpload from './components/DataUpload'
import TraceModal from './components/TraceModal'
import FilterBar from './components/FilterBar'

function App() {
  const [activeTab, setActiveTab] = useState('conflicts')
  const [params, setParams] = useState(null)
  const [defaultParams, setDefaultParams] = useState(null)
  const [courses, setCourses] = useState([])
  const [selections, setSelections] = useState([])
  const [analysisResult, setAnalysisResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [traceData, setTraceData] = useState(null)
  const [showTrace, setShowTrace] = useState(false)
  const [filterOptions, setFilterOptions] = useState({})
  const [beforeNotes, setBeforeNotes] = useState({})
  const [noteChanges, setNoteChanges] = useState([])

  useEffect(() => {
    loadParams()
    loadSampleData()
  }, [])

  const loadParams = async () => {
    try {
      const res = await fetch('/api/params')
      const data = await res.json()
      setParams(data.params)
      setDefaultParams(data.defaultParams)
    } catch (e) {
      console.error('Failed to load params:', e)
    }
  }

  const loadSampleData = async () => {
    try {
      const res = await fetch('/api/sample-data')
      const data = await res.json()
      setCourses(data.courses)
      setSelections(data.selections)
    } catch (e) {
      console.error('Failed to load sample data:', e)
    }
  }

  const saveParams = async (newParams) => {
    try {
      const res = await fetch('/api/params', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params: newParams })
      })
      const data = await res.json()
      setParams(data.params)
      return true
    } catch (e) {
      console.error('Failed to save params:', e)
      return false
    }
  }

  const runAnalysis = async () => {
    if (courses.length === 0 || selections.length === 0) {
      alert('请先上传或加载数据')
      return
    }

    const allNoteIds = analysisResult?.conflicts?.map(c => c.id) || []
    const beforeNotesSnapshot = {}
    for (const id of allNoteIds) {
      try {
        const res = await fetch(`/api/notes/${id}`)
        const data = await res.json()
        beforeNotesSnapshot[id] = data.notes
      } catch (e) {}
    }
    setBeforeNotes(beforeNotesSnapshot)

    setLoading(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courses, selections, filterOptions })
      })
      const data = await res.json()
      setAnalysisResult(data)

      const changes = []
      for (const conflict of data.conflicts || []) {
        const before = beforeNotesSnapshot[conflict.id] || []
        try {
          const res = await fetch(`/api/notes/${conflict.id}`)
          const noteData = await res.json()
          const after = noteData.notes || []
          
          const beforeIds = new Set(before.map(n => n.id))
          after.forEach(note => {
            if (!beforeIds.has(note.id)) {
              changes.push({
                conflictId: conflict.id,
                conflictTitle: conflict.title,
                type: 'add',
                note
              })
            }
          })
        } catch (e) {}
      }
      setNoteChanges(changes)
    } catch (e) {
      console.error('Analysis failed:', e)
    }
    setLoading(false)
  }

  const exportData = async (format) => {
    if (!analysisResult) return
    
    try {
      const res = await fetch(`/api/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conflicts: analysisResult.conflicts,
          courses,
          selections,
          filterOptions
        })
      })
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `conflict-analysis.${format === 'excel' ? 'xlsx' : 'csv'}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export failed:', e)
    }
  }

  const tabs = [
    { id: 'conflicts', label: '冲突列表', icon: '⚠️' },
    { id: 'statistics', label: '统计分析', icon: '📊' },
    { id: 'params', label: '参数配置', icon: '⚙️' },
    { id: 'data', label: '数据管理', icon: '📁' }
  ]

  return (
    <div className="container">
      <div className="header">
        <h1>🎓 校园选课冲突求解分析系统</h1>
        <p>专业的选课冲突检测与分析平台 - 公式透明、来源可追溯、参数可配置</p>
      </div>

      <div className="card">
        <div className="btn-group" style={{ marginBottom: '16px' }}>
          <button 
            className="btn btn-primary" 
            onClick={runAnalysis}
            disabled={loading}
          >
            {loading ? '⏳ 分析中...' : '🔍 开始冲突检测'}
          </button>
          <button 
            className="btn btn-success" 
            onClick={() => exportData('csv')}
            disabled={!analysisResult}
          >
            📥 导出 CSV
          </button>
          <button 
            className="btn btn-success" 
            onClick={() => exportData('excel')}
            disabled={!analysisResult}
          >
            📥 导出 Excel
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowTrace(true)}
            disabled={!analysisResult}
          >
            📜 查看检测过程
          </button>
        </div>

        {noteChanges.length > 0 && (
          <div style={{ 
            background: '#dcfce7', 
            padding: '12px 16px', 
            borderRadius: '8px', 
            marginBottom: '16px',
            border: '1px solid #86efac'
          }}>
            <strong>📝 补录备注差异对比:</strong>
            <ul style={{ marginTop: '8px' }}>
              {noteChanges.map((change, idx) => (
                <li key={idx} style={{ marginLeft: '20px', fontSize: '13px' }}>
                  <span className="diff-add">[{change.conflictTitle}]</span> 
                  新增备注: "{change.note.content}" - {change.note.author}
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysisResult?.validation?.warnings?.length > 0 && (
          <div style={{ 
            background: '#fffbeb', 
            padding: '12px 16px', 
            borderRadius: '8px', 
            marginBottom: '16px',
            border: '1px solid #fcd34d'
          }}>
            <strong>⚠️ 数据警告:</strong>
            <ul style={{ marginTop: '8px' }}>
              {analysisResult.validation.warnings.map((w, idx) => (
                <li key={idx} style={{ marginLeft: '20px', fontSize: '13px' }}>
                  {w.message} <span style={{ color: '#999', fontSize: '12px' }}>(来源: {w.source})</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysisResult?.validation?.errors?.length > 0 && (
          <div style={{ 
            background: '#fef2f2', 
            padding: '12px 16px', 
            borderRadius: '8px', 
            marginBottom: '16px',
            border: '1px solid #fca5a5'
          }}>
            <strong>❌ 数据错误:</strong>
            <ul style={{ marginTop: '8px' }}>
              {analysisResult.validation.errors.map((e, idx) => (
                <li key={idx} style={{ marginLeft: '20px', fontSize: '13px' }}>
                  {e.message} <span style={{ color: '#999', fontSize: '12px' }}>(来源: {e.source})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {analysisResult && (
        <FilterBar 
          filterOptions={filterOptions}
          setFilterOptions={setFilterOptions}
          conflicts={analysisResult.conflicts || []}
        />
      )}

      <div className="tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'conflicts' && (
        <ConflictList 
          conflicts={analysisResult?.conflicts || []}
          loading={loading}
        />
      )}

      {activeTab === 'statistics' && (
        <Statistics 
          statistics={analysisResult?.statistics}
          conflicts={analysisResult?.conflicts || []}
        />
      )}

      {activeTab === 'params' && (
        <ParamsPanel 
          params={params}
          defaultParams={defaultParams}
          onSave={saveParams}
        />
      )}

      {activeTab === 'data' && (
        <DataUpload 
          courses={courses}
          selections={selections}
          setCourses={setCourses}
          setSelections={setSelections}
          onLoadSample={loadSampleData}
        />
      )}

      {showTrace && traceData && (
        <TraceModal 
          trace={traceData}
          onClose={() => setShowTrace(false)}
        />
      )}

      {showTrace && analysisResult?.trace && !traceData && (
        <TraceModal 
          trace={analysisResult.trace}
          onClose={() => setShowTrace(false)}
        />
      )}
    </div>
  )
}

export default App
