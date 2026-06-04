import { useState, useEffect, useMemo } from 'react'
import { Upload, History, Plus, Edit, Trash2, AlertTriangle, User, Clock } from 'lucide-react'
import { useAppStore, type RawRow, type ImportResult } from '@/store'
import StatusBadge from '@/components/StatusBadge'

interface ParsedRow {
  uniqueKey: string
  content: string
  percentageValue: string
  decimalValue: string
}

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<'batch' | 'logs'>('batch')
  const [rawText, setRawText] = useState('')
  const [operator, setOperator] = useState('')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [filter, setFilter] = useState<'all' | 'mixed' | 'missingBoundary'>('all')
  const [boundaryModalOpen, setBoundaryModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<RawRow | null>(null)
  const [boundaryForm, setBoundaryForm] = useState({
    fieldName: '',
    minValue: '',
    maxValue: '',
    unit: '',
    description: '',
  })
  const [editForm, setEditForm] = useState({
    content: '',
    percentageValue: '',
    decimalValue: '',
    reason: '',
  })

  const {
    currentOperator,
    rawRows,
    importLogs,
    fetchRawRows,
    fetchImportLogs,
    importRawRows,
    updateRawRow,
    deleteRawRow,
    createBoundarySpec,
  } = useAppStore()

  useEffect(() => {
    setOperator(currentOperator)
    fetchRawRows()
    fetchImportLogs()
  }, [currentOperator, fetchRawRows, fetchImportLogs])

  useEffect(() => {
    if (filter === 'all') {
      fetchRawRows()
    } else if (filter === 'mixed') {
      fetchRawRows({ mixedFormat: true })
    } else if (filter === 'missingBoundary') {
      fetchRawRows({ hasBoundary: false })
    }
  }, [filter, fetchRawRows])

  const parsedRows = useMemo<ParsedRow[]>(() => {
    if (!rawText.trim()) return []
    return rawText
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const parts = line.split(',')
        return {
          uniqueKey: parts[0]?.trim() || '',
          content: parts[1]?.trim() || '',
          percentageValue: parts[2]?.trim() || '',
          decimalValue: parts[3]?.trim() || '',
        }
      })
  }, [rawText])

  const handleFillSample = () => {
    const sample = `KEY001,参赛队伍 计算机学院A队,85%,0.85
KEY002,参赛队伍 电子信息B队,92.5%,0.925
KEY003,参赛队伍 机械工程C队,78%,0.78
KEY004,参赛队伍 材料科学D队,88.3%,0.883
KEY005,参赛队伍 自动化E队,95%,0.95`
    setRawText(sample)
  }

  const handleImport = async () => {
    if (parsedRows.length === 0) return
    const rows = parsedRows.map((r) => ({
      uniqueKey: r.uniqueKey,
      content: r.content,
      percentageValue: r.percentageValue || undefined,
      decimalValue: r.decimalValue || undefined,
    }))
    const result = await importRawRows(rows, operator)
    setImportResult(result)
  }

  const handleOpenBoundaryModal = (row: RawRow) => {
    setSelectedRow(row)
    setBoundaryForm({
      fieldName: '',
      minValue: '',
      maxValue: '',
      unit: '',
      description: '',
    })
    setBoundaryModalOpen(true)
  }

  const handleSubmitBoundary = async () => {
    if (!selectedRow) return
    await createBoundarySpec({
      raw_row_id: selectedRow.id,
      field_name: boundaryForm.fieldName,
      min_value: boundaryForm.minValue ? parseFloat(boundaryForm.minValue) : null,
      max_value: boundaryForm.maxValue ? parseFloat(boundaryForm.maxValue) : null,
      unit: boundaryForm.unit,
      description: boundaryForm.description,
    })
    setBoundaryModalOpen(false)
    setSelectedRow(null)
  }

  const handleOpenEditModal = (row: RawRow) => {
    setSelectedRow(row)
    setEditForm({
      content: row.content,
      percentageValue: row.percentage_value || '',
      decimalValue: row.decimal_value || '',
      reason: '',
    })
    setEditModalOpen(true)
  }

  const handleSubmitEdit = async () => {
    if (!selectedRow) return
    await updateRawRow(selectedRow.id, {
      content: editForm.content,
      percentageValue: editForm.percentageValue || undefined,
      decimalValue: editForm.decimalValue || undefined,
      reason: editForm.reason || undefined,
    })
    setEditModalOpen(false)
    setSelectedRow(null)
  }

  const handleDelete = async () => {
    if (!selectedRow) return
    await deleteRawRow(selectedRow.id)
    setDeleteConfirmOpen(false)
    setSelectedRow(null)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-primary">
          数据导入
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          批量导入问卷原始数据，管理导入记录和原始行数据
        </p>
      </div>

      <div className="card">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('batch')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'batch'
                ? 'border-b-2 border-accent text-accent'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Upload size={16} />
            批量导入
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'logs'
                ? 'border-b-2 border-accent text-accent'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <History size={16} />
            导入日志
          </button>
        </div>

        <div className="pt-6">
          {activeTab === 'batch' ? (
            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  粘贴原始数据行
                </label>
                <p className="mb-2 text-xs text-slate-500">
                  每行格式：uniqueKey,content,percentageValue,decimalValue
                </p>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="input-field h-40 font-mono text-xs"
                  placeholder="KEY001,参赛队伍 计算机学院A队,85%,0.85"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    操作人
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={operator}
                      onChange={(e) => setOperator(e.target.value)}
                      className="input-field pl-10"
                    />
                  </div>
                </div>
                <div className="flex items-end gap-3">
                  <button onClick={handleFillSample} className="btn-outline">
                    填充示例数据
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={parsedRows.length === 0}
                    className="btn-primary disabled:opacity-50"
                  >
                    开始导入
                  </button>
                </div>
              </div>

              {importResult && (
                <div className="flex items-center gap-4 rounded-lg bg-emerald-50 p-4">
                  <StatusBadge variant="success">导入成功</StatusBadge>
                  <span className="text-sm text-slate-600">
                    批次ID: <span className="font-mono">{importResult.batchId}</span>
                  </span>
                  <span className="text-sm text-slate-600">
                    新增: <span className="font-semibold text-emerald-600">{importResult.newRows}</span>
                  </span>
                  <span className="text-sm text-slate-600">
                    跳过: <span className="font-semibold text-slate-500">{importResult.skippedRows}</span>
                  </span>
                  <span className="text-sm text-slate-600">
                    总计: <span className="font-semibold">{importResult.totalRows}</span>
                  </span>
                </div>
              )}

              {parsedRows.length > 0 && (
                <div>
                  <h3 className="mb-3 font-heading text-lg font-semibold text-primary">
                    解析预览（{parsedRows.length} 行）
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="table-header">唯一键</th>
                          <th className="table-header">内容</th>
                          <th className="table-header">百分数</th>
                          <th className="table-header">小数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="table-cell font-mono text-xs">{row.uniqueKey}</td>
                            <td className="table-cell">{row.content}</td>
                            <td className="table-cell">{row.percentageValue}</td>
                            <td className="table-cell">{row.decimalValue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3">
                <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-500" />
                <p className="text-xs text-amber-700">
                  重复数据按唯一键自动去重，不会导致数量翻倍
                </p>
              </div>
            </div>
          ) : (
            <div>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">批次ID</th>
                      <th className="table-header">操作人</th>
                      <th className="table-header">总行数</th>
                      <th className="table-header">新增</th>
                      <th className="table-header">跳过</th>
                      <th className="table-header">冲突</th>
                      <th className="table-header">时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="table-cell text-center text-slate-400">
                          暂无导入记录
                        </td>
                      </tr>
                    ) : (
                      importLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="table-cell font-mono text-xs">{log.batch_id}</td>
                          <td className="table-cell">{log.operator}</td>
                          <td className="table-cell">{log.total_rows}</td>
                          <td className="table-cell">
                            <span className="text-emerald-600">{log.new_rows}</span>
                          </td>
                          <td className="table-cell">
                            <span className="text-slate-500">{log.skipped_rows}</span>
                          </td>
                          <td className="table-cell">
                            <span className="text-rose-600">{log.conflict_rows}</span>
                          </td>
                          <td className="table-cell">
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <Clock size={12} />
                              {formatDate(log.created_at)}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-primary">
            原始数据行管理
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilter('mixed')}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === 'mixed'
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              混合格式
            </button>
            <button
              onClick={() => setFilter('missingBoundary')}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === 'missingBoundary'
                  ? 'bg-danger text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              缺失边界值
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">唯一键</th>
                <th className="table-header">内容</th>
                <th className="table-header">百分数</th>
                <th className="table-header">小数</th>
                <th className="table-header">是否混合</th>
                <th className="table-header">边界值</th>
                <th className="table-header">操作</th>
              </tr>
            </thead>
            <tbody>
              {rawRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-cell text-center text-slate-400">
                    暂无数据
                  </td>
                </tr>
              ) : (
                rawRows.map((row) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-slate-50 ${
                      row.has_mixed_format ? 'row-mixed' : ''
                    } ${!row.boundary_spec ? 'row-missing-boundary' : ''}`}
                  >
                    <td className="table-cell font-mono text-xs">{row.unique_key}</td>
                    <td className="table-cell max-w-xs truncate">{row.content}</td>
                    <td className="table-cell">{row.percentage_value || '-'}</td>
                    <td className="table-cell">{row.decimal_value || '-'}</td>
                    <td className="table-cell">
                      {row.has_mixed_format ? (
                        <StatusBadge variant="warning">是</StatusBadge>
                      ) : (
                        <StatusBadge variant="success">否</StatusBadge>
                      )}
                    </td>
                    <td className="table-cell">
                      {row.boundary_spec ? (
                        <div className="text-xs">
                          <span className="font-medium">{row.boundary_spec.field_name}</span>
                          <span className="text-slate-400">
                            {' '}
                            [{row.boundary_spec.min_value} - {row.boundary_spec.max_value} {row.boundary_spec.unit}]
                          </span>
                        </div>
                      ) : (
                        <StatusBadge variant="danger">缺失</StatusBadge>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        {!row.boundary_spec && (
                          <button
                            onClick={() => handleOpenBoundaryModal(row)}
                            className="text-xs text-primary hover:text-accent"
                          >
                            <Plus size={14} className="inline" /> 补录边界值
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEditModal(row)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          <Edit size={14} className="inline" /> 编辑
                        </button>
                        <button
                          onClick={() => {
                            setSelectedRow(row)
                            setDeleteConfirmOpen(true)
                          }}
                          className="text-xs text-danger hover:text-rose-700"
                        >
                          <Trash2 size={14} className="inline" /> 删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {boundaryModalOpen && selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 font-heading text-xl font-semibold text-primary">
              补录边界值
            </h3>
            <p className="mb-4 text-sm text-slate-500">
              为 <span className="font-mono text-xs">{selectedRow.unique_key}</span> 补充边界值说明
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  字段名称
                </label>
                <input
                  type="text"
                  value={boundaryForm.fieldName}
                  onChange={(e) => setBoundaryForm({ ...boundaryForm, fieldName: e.target.value })}
                  className="input-field"
                  placeholder="如：成绩分数"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    最小值
                  </label>
                  <input
                    type="number"
                    value={boundaryForm.minValue}
                    onChange={(e) => setBoundaryForm({ ...boundaryForm, minValue: e.target.value })}
                    className="input-field"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    最大值
                  </label>
                  <input
                    type="number"
                    value={boundaryForm.maxValue}
                    onChange={(e) => setBoundaryForm({ ...boundaryForm, maxValue: e.target.value })}
                    className="input-field"
                    placeholder="100"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  单位
                </label>
                <input
                  type="text"
                  value={boundaryForm.unit}
                  onChange={(e) => setBoundaryForm({ ...boundaryForm, unit: e.target.value })}
                  className="input-field"
                  placeholder="如：分、%"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  描述说明
                </label>
                <textarea
                  value={boundaryForm.description}
                  onChange={(e) => setBoundaryForm({ ...boundaryForm, description: e.target.value })}
                  className="input-field h-20"
                  placeholder="该字段的边界说明..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setBoundaryModalOpen(false)}
                className="btn-outline"
              >
                取消
              </button>
              <button
                onClick={handleSubmitBoundary}
                className="btn-primary"
              >
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}

      {editModalOpen && selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 font-heading text-xl font-semibold text-primary">
              编辑原始行
            </h3>
            <p className="mb-4 text-sm text-slate-500">
              编辑 <span className="font-mono text-xs">{selectedRow.unique_key}</span> 的数据
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  内容
                </label>
                <input
                  type="text"
                  value={editForm.content}
                  onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    百分数值
                  </label>
                  <input
                    type="text"
                    value={editForm.percentageValue}
                    onChange={(e) => setEditForm({ ...editForm, percentageValue: e.target.value })}
                    className="input-field"
                    placeholder="如：85%"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    小数值
                  </label>
                  <input
                    type="text"
                    value={editForm.decimalValue}
                    onChange={(e) => setEditForm({ ...editForm, decimalValue: e.target.value })}
                    className="input-field"
                    placeholder="如：0.85"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  变更原因
                </label>
                <textarea
                  value={editForm.reason}
                  onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                  className="input-field h-20"
                  placeholder="请说明修改原因..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditModalOpen(false)}
                className="btn-outline"
              >
                取消
              </button>
              <button
                onClick={handleSubmitEdit}
                className="btn-primary"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmOpen && selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                <AlertTriangle size={20} className="text-danger" />
              </div>
              <h3 className="font-heading text-lg font-semibold text-primary">
                确认删除
              </h3>
            </div>
            <p className="mb-6 text-sm text-slate-600">
              确定要删除 <span className="font-mono text-xs font-medium">{selectedRow.unique_key}</span> 吗？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="btn-outline"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="btn-danger"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
