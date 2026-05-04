import React, { useState, useEffect } from 'react'

function ExportPage() {
  const [programs, setPrograms] = useState([])
  const [selectedProgram, setSelectedProgram] = useState('')

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

  const handleExportAuthorizationList = () => {
    const url = selectedProgram 
      ? `/api/export/authorization-list?program_id=${selectedProgram}`
      : '/api/export/authorization-list'
    window.open(url, '_blank')
  }

  const handleExportRiskTable = () => {
    window.open('/api/export/risk-table', '_blank')
  }

  const handleExportAuditPackage = () => {
    window.open('/api/export/audit-package', '_blank')
  }

  const exportOptions = [
    {
      id: 'authorization',
      label: '📄 Markdown 授权清单',
      description: '导出所有节目或指定节目的授权记录列表，包含素材清单和授权状态',
      hasProgramFilter: true,
      action: handleExportAuthorizationList,
      color: 'primary'
    },
    {
      id: 'risks',
      label: '📊 CSV 风险表',
      description: '导出所有风险记录的 CSV 格式表格，包含风险类型、严重程度、状态和检测时间',
      hasProgramFilter: false,
      action: handleExportRiskTable,
      color: 'warning'
    },
    {
      id: 'audit',
      label: '📦 JSON 审计包',
      description: '导出完整的审计数据包，包含所有节目、素材、授权、风险和复核记录的完整 JSON 数据',
      hasProgramFilter: false,
      action: handleExportAuditPackage,
      color: 'success'
    }
  ]

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">筛选选项（可选）</h3>
        <select
          className="select max-w-md"
          value={selectedProgram}
          onChange={(e) => setSelectedProgram(e.target.value)}
        >
          <option value="">所有节目</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.episode_number ? ` #${p.episode_number}` : ''}
              {p.title ? ` - ${p.title}` : ''}
            </option>
          ))}
        </select>
        <p className="text-sm text-gray-500 mt-2">
          选择特定节目可导出该节目单独的授权清单
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {exportOptions.map((option) => (
          <div key={option.id} className="card">
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-lg font-semibold">{option.label}</h3>
              {option.hasProgramFilter && selectedProgram && (
                <span className="badge badge-reviewing">已筛选</span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-4">{option.description}</p>
            <button
              onClick={option.action}
              className={`w-full btn-${
                option.color === 'primary' ? 'primary' :
                option.color === 'warning' ? 'secondary' :
                'success'
              }`}
            >
              导出
            </button>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold mb-4">导出格式说明</h3>
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Markdown 授权清单</h4>
            <p className="text-sm text-gray-600">
              包含每个节目的授权记录表和素材清单。授权记录显示类型、授权方、权限类型、有效期和状态。
              素材清单显示类型、名称、来源和时长。适用于打印或分享给团队成员审核。
            </p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">CSV 风险表</h4>
            <p className="text-sm text-gray-600">
              包含所有风险记录的逗号分隔值格式。列包括：risk_id、program_name、risk_type、
              description、severity、status、detected_at。可直接导入 Excel 或其他表格软件进行分析。
            </p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">JSON 审计包</h4>
            <p className="text-sm text-gray-600">
              完整的审计数据包，包含：生成时间、版本信息、统计摘要、所有节目详情（含关联的素材、授权、风险和复核记录），
              以及原始数据。适用于备份、迁移或第三方审计。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExportPage
