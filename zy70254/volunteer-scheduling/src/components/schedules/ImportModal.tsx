import { useState, useMemo } from 'react'
import { AlertCircle, CheckCircle, FileText } from 'lucide-react'
import type { Volunteer, Course, Subject, Schedule, ValidationError } from '../../types'
import { validateSchedule, validateVolunteer } from '../../utils/validation'
import { addSchedule, addVolunteer, getSchedules, getVolunteers } from '../../services/dataService'
import { invalidScheduleData, invalidVolunteerData } from '../../data/seedData'

interface ImportModalProps {
  volunteers: Volunteer[]
  courses: Course[]
  onClose: () => void
  onSaved: () => void
}

type ImportType = 'schedule' | 'volunteer'

interface ParsedRecord {
  index: number
  data: Record<string, unknown>
  errors: ValidationError[]
  warnings: ValidationError[]
  status: 'valid' | 'warning' | 'invalid'
}

export function ImportModal({ volunteers, courses, onClose, onSaved }: ImportModalProps) {
  const [importType, setImportType] = useState<ImportType>('schedule')
  const [rawText, setRawText] = useState('')
  const [parsedRecords, setParsedRecords] = useState<ParsedRecord[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)

  const stats = useMemo(() => {
    return {
      total: parsedRecords.length,
      valid: parsedRecords.filter((r) => r.status === 'valid').length,
      warning: parsedRecords.filter((r) => r.status === 'warning').length,
      invalid: parsedRecords.filter((r) => r.status === 'invalid').length,
    }
  }, [parsedRecords])

  const loadSampleData = () => {
    const sampleData = importType === 'schedule' ? invalidScheduleData : invalidVolunteerData
    const jsonText = JSON.stringify(sampleData, null, 2)
    setRawText(jsonText)
  }

  const parseData = () => {
    if (!rawText.trim()) {
      alert('请输入数据或加载示例数据')
      return
    }

    try {
      let data: Record<string, unknown>[]
      try {
        const parsed = JSON.parse(rawText)
        data = Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        alert('JSON 格式错误，请检查数据格式')
        return
      }

      const records: ParsedRecord[] = data.map((item, index) => {
        let errors: ValidationError[] = []

        if (importType === 'schedule') {
          errors = validateSchedule(
            item as Partial<Schedule>,
            getSchedules(),
            volunteers,
            courses
          )
        } else {
          errors = validateVolunteer(
            item as Partial<Volunteer>,
            getVolunteers()
          )
        }

        const errorList = errors.filter((e) => e.type === 'error')
        const warningList = errors.filter((e) => e.type === 'warning')

        let status: 'valid' | 'warning' | 'invalid'
        if (errorList.length > 0) {
          status = 'invalid'
        } else if (warningList.length > 0) {
          status = 'warning'
        } else {
          status = 'valid'
        }

        return {
          index,
          data: item,
          errors: errorList,
          warnings: warningList,
          status,
        }
      })

      setParsedRecords(records)
      setShowPreview(true)
    } catch (error) {
      console.error('解析失败:', error)
      alert('数据解析失败，请检查格式')
    }
  }

  const handleImport = async () => {
    const validRecords = parsedRecords.filter((r) => r.status !== 'invalid')
    if (validRecords.length === 0) {
      alert('没有有效的记录可以导入')
      return
    }

    if (!confirm(`确定要导入 ${validRecords.length} 条记录吗？（${stats.invalid} 条无效记录将被跳过）`)) {
      return
    }

    setImporting(true)
    let count = 0

    try {
      for (const record of validRecords) {
        try {
          if (importType === 'schedule') {
            const d = record.data
            const hours = calculateHours(String(d.startTime), String(d.endTime))
            addSchedule({
              courseId: String(d.courseId),
              volunteerId: String(d.volunteerId),
              date: String(d.date),
              startTime: String(d.startTime),
              endTime: String(d.endTime),
              status: (d.status as Schedule['status']) || '待确认',
              assignedHours: hours,
            })
          } else {
            const d = record.data
            addVolunteer({
              name: String(d.name || ''),
              phone: String(d.phone || ''),
              email: d.email ? String(d.email) : undefined,
              subjects: (d.subjects as Subject[]) || [],
              availableCampuses: (d.availableCampuses as string[]) || [],
              volunteerHours: Number(d.volunteerHours) || 0,
              status: (d.status as 'active' | 'inactive') || 'active',
            })
          }
          count++
        } catch (e) {
          console.error('导入记录失败:', e)
        }
      }

      setImportedCount(count)
      alert(`成功导入 ${count} 条记录`)
      onSaved()
      onClose()
    } finally {
      setImporting(false)
    }
  }

  const calculateHours = (start: string, end: string) => {
    if (!start || !end) return 0
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    return ((eh * 60 + em) - (sh * 60 + sm)) / 60
  }

  const formatRecord = (data: Record<string, unknown>) => {
    if (importType === 'schedule') {
      return `${data.courseId || '?'} → ${data.volunteerId || '?'} @ ${data.date || '?'}`
    }
    return `${data.name || '?'} (${data.phone || '?'})`
  }

  const getStatusColor = (status: ParsedRecord['status']) => {
    switch (status) {
      case 'valid': return 'bg-green-50 border-green-200'
      case 'warning': return 'bg-yellow-50 border-yellow-200'
      case 'invalid': return 'bg-red-50 border-red-200'
    }
  }

  const getStatusIcon = (status: ParsedRecord['status']) => {
    switch (status) {
      case 'valid': return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'warning': return <AlertCircle className="w-5 h-5 text-yellow-600" />
      case 'invalid': return <AlertCircle className="w-5 h-5 text-red-600" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">导入说明</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 支持 JSON 格式的数据导入</li>
          <li>• 点击「加载示例数据」可以查看带异常的测试数据</li>
          <li>• 系统会自动校验：重复数据、缺字段、格式错误等</li>
          <li>• 无效记录（红色）会被跳过，警告记录（黄色）可以选择是否导入</li>
        </ul>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">导入类型</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="importType"
              value="schedule"
              checked={importType === 'schedule'}
              onChange={(e) => setImportType(e.target.value as ImportType)}
            />
            <span>排班记录</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="importType"
              value="volunteer"
              checked={importType === 'volunteer'}
              onChange={(e) => setImportType(e.target.value as ImportType)}
            />
            <span>助教档案</span>
          </label>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700">
            粘贴 JSON 数据
          </label>
          <button
            type="button"
            onClick={loadSampleData}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            加载示例数据（含异常）
          </button>
        </div>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={10}
          placeholder={`粘贴 JSON 数组，例如：\n${importType === 'schedule' 
            ? '[{"courseId":"cs-001","volunteerId":"v-001","date":"2024-06-01","startTime":"16:00","endTime":"17:30"}]'
            : '[{"name":"张三","phone":"13800138001","subjects":["数学"],"availableCampuses":["c-001"]}]'
          }`}
          className="w-full px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {!showPreview ? (
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={parseData}
            disabled={!rawText.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            校验并预览
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-500" />
              <span>总计：<strong>{stats.total}</strong> 条</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>有效：<strong>{stats.valid}</strong> 条</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <span>警告：<strong>{stats.warning}</strong> 条</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span>无效：<strong>{stats.invalid}</strong> 条</span>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {parsedRecords.map((record) => (
              <div
                key={record.index}
                className={`p-4 rounded-lg border ${getStatusColor(record.status)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(record.status)}
                    <span className="font-medium">
                      记录 #{record.index + 1}: {formatRecord(record.data)}
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    record.status === 'valid' ? 'bg-green-200 text-green-800' :
                    record.status === 'warning' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-red-200 text-red-800'
                  }`}>
                    {record.status === 'valid' ? '有效' : record.status === 'warning' ? '警告' : '无效'}
                  </span>
                </div>

                {record.errors.length > 0 && (
                  <div className="mt-2 pl-7">
                    <p className="text-sm font-medium text-red-700 mb-1">错误：</p>
                    <ul className="text-sm text-red-600 space-y-0.5">
                      {record.errors.map((e, i) => (
                        <li key={i}>• {e.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {record.warnings.length > 0 && (
                  <div className="mt-2 pl-7">
                    <p className="text-sm font-medium text-yellow-700 mb-1">警告：</p>
                    <ul className="text-sm text-yellow-600 space-y-0.5">
                      {record.warnings.map((e, i) => (
                        <li key={i}>• {e.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-2 pl-7">
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                      查看原始数据
                    </summary>
                    <pre className="mt-1 p-2 bg-white rounded text-xs overflow-x-auto">
                      {JSON.stringify(record.data, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              返回修改
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || stats.valid + stats.warning === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {importing ? `导入中 (${importedCount}/${stats.valid + stats.warning})...` : '确认导入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
