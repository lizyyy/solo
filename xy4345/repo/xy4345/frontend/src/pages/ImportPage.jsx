import React, { useState, useEffect } from 'react'

function ImportPage({ onImportComplete }) {
  const [programs, setPrograms] = useState([])
  const [selectedProgram, setSelectedProgram] = useState('')
  const [activeTab, setActiveTab] = useState('music')
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchPrograms()
  }, [])

  const fetchPrograms = async () => {
    try {
      const response = await fetch('/api/programs')
      if (response.ok) {
        setPrograms(await response.json())
      }
    } catch (error) {
      console.error('Failed to fetch programs:', error)
    }
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
    }
  }

  const handleImport = async () => {
    if (!selectedProgram || !file) return

    setLoading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('program_id', selectedProgram)

      const endpoints = {
        music: '/api/import/music-licenses',
        material: '/api/import/material-references',
        ad: '/api/import/ad-schedule',
        guest: '/api/import/guest-authorization'
      }

      const response = await fetch(endpoints[activeTab], {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        setResult(data)
        onImportComplete && onImportComplete()
      } else {
        setResult({ error: '导入失败' })
      }
    } catch (error) {
      setResult({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'music', label: '🎵 音乐许可 CSV', desc: '导入背景音乐授权信息' },
    { id: 'material', label: '📦 素材引用 JSON', desc: '导入节目素材引用记录' },
    { id: 'ad', label: '📢 广告时间表', desc: '导入广告口播安排' },
    { id: 'guest', label: '👤 嘉宾授权书', desc: '导入嘉宾授权信息' }
  ]

  const getExampleData = () => {
    switch (activeTab) {
      case 'music':
        return `name,artist,duration,holder_name,license_type,valid_from,valid_until
"Intro Theme","SoundStudio",120,"MusicLibrary Inc","commercial","2024-01-01","2024-12-31"
"Background Jazz","Jazz Masters",180,"Audio Rights","royalty_free","2023-06-01","2025-05-31"`
      case 'material':
        return `{
  "materials": [
    {
      "name": "采访片段 - 科技趋势",
      "type": "clip",
      "source": "嘉宾张三",
      "duration": 300,
      "authorization": {
        "holder_name": "张三",
        "permission_type": "full_release",
        "sign_date": "2024-03-15"
      }
    }
  ]
}`
      case 'ad':
        return `{
  "ads": [
    {
      "name": "品牌A产品介绍",
      "sponsor": "品牌A公司",
      "duration": 15,
      "timestamp": "00:05:30"
    },
    {
      "name": "品牌B开场广告",
      "sponsor": "品牌B",
      "duration": 30,
      "timestamp": "00:00:30"
    }
  ]
}`
      case 'guest':
        return `{
  "guests": [
    {
      "name": "李四",
      "permission_type": "full_release",
      "sign_date": "2024-03-10",
      "terms": "允许在所有平台播出"
    },
    {
      "name": "王五",
      "permission_type": "audio_only",
      "sign_date": "2024-03-12",
      "restrictions": "仅音频，不可用于视频"
    }
  ]
}`
      default:
        return ''
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">选择节目</h3>
        <select
          className="select max-w-md"
          value={selectedProgram}
          onChange={(e) => setSelectedProgram(e.target.value)}
        >
          <option value="">请选择要导入到的节目</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.episode_number ? ` #${p.episode_number}` : ''}
              {p.title ? ` - ${p.title}` : ''}
            </option>
          ))}
        </select>
        {programs.length === 0 && (
          <p className="text-sm text-gray-500 mt-2">暂无节目，请先在仪表板创建节目</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setFile(null)
              setResult(null)
            }}
            className={`card text-left transition-colors ${
              activeTab === tab.id
                ? 'border-primary-300 bg-primary-50'
                : 'hover:bg-gray-50'
            }`}
          >
            <h4 className="font-medium mb-1">{tab.label}</h4>
            <p className="text-sm text-gray-500">{tab.desc}</p>
          </button>
        ))}
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold mb-4">
          {tabs.find(t => t.id === activeTab)?.label}
        </h3>

        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">示例格式：</h4>
            <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
              {getExampleData()}
            </pre>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择文件
            </label>
            <input
              type="file"
              accept={activeTab === 'music' ? '.csv,.txt' : '.json'}
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-medium
                file:bg-primary-50 file:text-primary-700
                hover:file:bg-primary-100"
            />
            {file && (
              <p className="text-sm text-gray-500 mt-2">
                已选择: {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          <button
            onClick={handleImport}
            disabled={!selectedProgram || !file || loading}
            className="btn-primary"
          >
            {loading ? '导入中...' : '开始导入'}
          </button>

          {result && (
            <div className={`p-4 rounded-lg ${result.error ? 'bg-danger-50' : 'bg-success-50'}`}>
              {result.error ? (
                <p className="text-danger-700">错误: {result.error}</p>
              ) : (
                <div>
                  <p className="font-medium text-success-700 mb-2">
                    导入成功！
                  </p>
                  <p className="text-sm text-gray-600">
                    成功: {result.success} 条
                    {result.errors?.length > 0 && (
                      <span className="text-danger-600 ml-2">
                        失败: {result.errors.length} 条
                      </span>
                    )}
                  </p>
                  {result.errors?.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      {result.errors.map((e, i) => (
                        <div key={i}>• {e.error}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImportPage
