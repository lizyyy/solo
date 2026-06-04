import { useState, useEffect, useMemo } from 'react'
import { History, Filter, Search, User, Clock } from 'lucide-react'
import { useAppStore, type ChangeRecord } from '@/store'
import StatusBadge from '@/components/StatusBadge'

export default function HistoryPage() {
  const [entityTypeFilter, setEntityTypeFilter] = useState<'all' | 'raw_row' | 'boundary' | 'calculation'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const { changeRecords, fetchChangeRecords } = useAppStore()

  useEffect(() => {
    if (entityTypeFilter === 'all') {
      fetchChangeRecords()
    } else {
      fetchChangeRecords({ entityType: entityTypeFilter })
    }
  }, [entityTypeFilter, fetchChangeRecords])

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return changeRecords
    const query = searchQuery.toLowerCase()
    return changeRecords.filter(
      (record) =>
        record.entity_id.toLowerCase().includes(query) ||
        record.field_name.toLowerCase().includes(query)
    )
  }, [changeRecords, searchQuery])

  const summaryStats = useMemo(() => {
    const total = changeRecords.length
    const byType: Record<string, number> = {
      raw_row: 0,
      boundary: 0,
      calculation: 0,
    }
    changeRecords.forEach((r) => {
      byType[r.entity_type] = (byType[r.entity_type] || 0) + 1
    })
    return { total, byType }
  }, [changeRecords])

  const getEntityTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      raw_row: '问卷原始行',
      boundary: '边界值说明',
      calculation: '计算明细',
    }
    return map[type] || type
  }

  const getEntityTypeVariant = (type: string) => {
    const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'pending'> = {
      raw_row: 'info',
      boundary: 'warning',
      calculation: 'success',
    }
    return map[type] || 'info'
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN')
  }

  const valuesDiffer = (oldVal: string, newVal: string) => {
    return oldVal !== newVal
  }

  const formatValue = (val: string) => {
    if (val === null || val === undefined || val === '') return '（空）'
    return val
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-primary">
          变更历史
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          查看所有数据变更记录，追踪修改原因和影响范围
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-slate-500">总变更数</p>
          <p className="mt-1 text-2xl font-bold text-primary">
            {summaryStats.total}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">问卷原始行</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">
            {summaryStats.byType.raw_row}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">边界值说明</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {summaryStats.byType.boundary}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">计算明细</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {summaryStats.byType.calculation}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-600">实体类型：</span>
            <div className="flex gap-2">
              <button
                onClick={() => setEntityTypeFilter('all')}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                  entityTypeFilter === 'all'
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setEntityTypeFilter('raw_row')}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                  entityTypeFilter === 'raw_row'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                问卷原始行
              </button>
              <button
                onClick={() => setEntityTypeFilter('boundary')}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                  entityTypeFilter === 'boundary'
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                边界值说明
              </button>
              <button
                onClick={() => setEntityTypeFilter('calculation')}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                  entityTypeFilter === 'calculation'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                计算明细
              </button>
            </div>
          </div>

          <div className="ml-auto flex-1 max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索实体ID或字段名..."
                className="input-field pl-10"
              />
            </div>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <History size={48} className="mx-auto mb-3 opacity-50" />
            <p>暂无变更记录</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRecords.map((record: ChangeRecord) => (
              <div
                key={record.id}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock size={12} />
                    {formatDate(record.created_at)}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <User size={12} />
                    {record.changed_by}
                  </div>
                  <StatusBadge variant={getEntityTypeVariant(record.entity_type)}>
                    {getEntityTypeLabel(record.entity_type)}
                  </StatusBadge>
                  <span className="font-mono text-xs text-slate-400">
                    ID: {record.entity_id}
                  </span>
                </div>

                <p className="mb-3 text-sm font-medium text-slate-700">
                  修改字段: <span className="text-primary">{record.field_name}</span>
                </p>

                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-500">改前</p>
                    <div
                      className={`rounded-lg p-3 text-sm ${
                        valuesDiffer(record.old_value, record.new_value)
                          ? 'diff-removed'
                          : 'bg-slate-50 text-slate-600'
                      }`}
                    >
                      {formatValue(record.old_value)}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-500">改后</p>
                    <div
                      className={`rounded-lg p-3 text-sm ${
                        valuesDiffer(record.old_value, record.new_value)
                          ? 'diff-added'
                          : 'bg-slate-50 text-slate-600'
                      }`}
                    >
                      {formatValue(record.new_value)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium text-slate-500">变更原因: </span>
                    <span className="text-slate-700">
                      {record.reason || (
                        <span className="text-slate-400">未填写原因</span>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-500">影响范围: </span>
                    <span className="text-slate-700">
                      {record.affected_results && record.affected_results.length > 0
                        ? record.affected_results.join(', ')
                        : <span className="text-slate-400">无</span>
                      }
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
