import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Download, Eye, ClipboardList, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import FilterPanel from '@/components/FilterPanel'
import StatusBadge from '@/components/StatusBadge'
import type { RestorationRecord } from '@/types'

function getEvidenceCompleteness(record: RestorationRecord): { color: string; count: number } {
  let count = 0
  if (record.insurancePolicyId) count++
  if (record.lightingRecordId) count++
  if (record.exhibitionId) count++

  let color = ''
  if (count === 3) {
    color = '#81B29A'
  } else if (count === 2) {
    color = '#C9A84C'
  } else {
    color = '#E07A5F'
  }

  return { color, count }
}

export default function RecordsList() {
  const navigate = useNavigate()
  const {
    records,
    filters,
    setFilters,
    resetFilters,
    exportFilteredRecords,
  } = useStore()

  const [showExportMenu, setShowExportMenu] = useState(false)

  const filteredRecords = useMemo(() => {
    let filtered = records

    if (filters.status) {
      filtered = filtered.filter((r) => r.status === filters.status)
    }
    if (filters.insuranceStatus === 'linked') {
      filtered = filtered.filter((r) => r.insurancePolicyId !== null)
    } else if (filters.insuranceStatus === 'missing') {
      filtered = filtered.filter((r) => r.insurancePolicyId === null)
    }
    if (filters.lightingStatus === 'linked') {
      filtered = filtered.filter((r) => r.lightingRecordId !== null)
    } else if (filters.lightingStatus === 'missing') {
      filtered = filtered.filter((r) => r.lightingRecordId === null)
    }
    if (filters.exhibitionStatus === 'linked') {
      filtered = filtered.filter((r) => r.exhibitionId !== null)
    } else if (filters.exhibitionStatus === 'missing') {
      filtered = filtered.filter((r) => r.exhibitionId === null)
    }
    if (filters.dateFrom) {
      filtered = filtered.filter((r) => r.createdAt >= filters.dateFrom)
    }
    if (filters.dateTo) {
      filtered = filtered.filter((r) => r.createdAt <= filters.dateTo)
    }
    if (filters.search) {
      const search = filters.search.toLowerCase()
      filtered = filtered.filter(
        (r) =>
          r.artifactName.toLowerCase().includes(search) ||
          r.artifactId.toLowerCase().includes(search) ||
          r.restorer.toLowerCase().includes(search) ||
          r.description.toLowerCase().includes(search)
      )
    }

    return filtered
  }, [records, filters])

  const handleExport = (format: 'json' | 'csv') => {
    const content = exportFilteredRecords(format)
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `restoration-records.${format}`
    a.click()
    URL.revokeObjectURL(url)
    setShowExportMenu(false)
  }

  const handleRowClick = (id: string) => {
    navigate(`/record/${id}`)
  }

  return (
    <div className="min-h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-semibold text-gray-900 mb-2">
          修复记录管理
        </h1>
        <p className="text-gray-600">
          查看和管理所有文物修复记录及其关联的证据链
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onFilterChange={setFilters}
        onReset={resetFilters}
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              共 <span className="font-semibold text-gray-900">{filteredRecords.length}</span> 条记录
            </span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm',
                'hover:bg-gray-800 transition-colors'
              )}
            >
              <Download className="w-4 h-4" />
              导出
              <ChevronDown className="w-4 h-4" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
              <button
                onClick={() => handleExport('json')}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
              >
                导出 JSON
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg"
              >
                导出 CSV
              </button>
            </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-1"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  记录ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  保险
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  灯光
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  展览
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  修复师
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  创建日期
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRecords.map((record) => {
                const { color } = getEvidenceCompleteness(record)
                return (
                  <tr
                    key={record.id}
                    onClick={() => handleRowClick(record.id)}
                    className={cn(
                      'hover:bg-gray-50 cursor-pointer transition-colors'
                    )}
                  >
                    <td
                      className="w-1 py-4"
                      style={{ borderLeft: `4px solid ${color}` }}
                    />
                    <td className="px-4 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRowClick(record.id)
                        }}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 text-left"
                      >
                        {record.artifactName}
                      </button>
                      <p className="text-xs text-gray-500">{record.artifactId}</p>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge
                        status={record.insurancePolicyId ? 'linked' : 'missing'}
                        type="evidence"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge
                        status={record.lightingRecordId ? 'linked' : 'missing'}
                        type="evidence"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge
                        status={record.exhibitionId ? 'linked' : 'missing'}
                        type="evidence"
                      />
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {record.restorer}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {format(new Date(record.createdAt), 'yyyy-MM-dd HH:mm')}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRowClick(record.id)
                        }}
                        className={cn(
                          'inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600',
                          'border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors'
                        )}
                      >
                        <Eye className="w-4 h-4" />
                        查看
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filteredRecords.length === 0 && (
          <div className="text-center py-12">
            <ClipboardList className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-2">没有匹配的记录</p>
            <p className="text-sm text-gray-400">请尝试调整筛选条件</p>
          </div>
        )}
      </div>
    </div>
  )
}
