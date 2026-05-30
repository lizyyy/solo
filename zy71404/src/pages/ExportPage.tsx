import { useState } from 'react'
import { FileSpreadsheet, Download, Upload, Database, AlertCircle, Check } from 'lucide-react'
import { useAppStore } from '@/store'
import { exportToExcel, exportBackup } from '@/utils/excelExport'

export default function ExportPage() {
  const {
    receipts,
    invoices,
    feeAllocations,
    auditLogs,
    anomalies,
    importData,
    resetAllData
  } = useAppStore()

  const [exportOptions, setExportOptions] = useState({
    receipts: true,
    invoices: true,
    allocations: true,
    anomalies: true,
    auditLogs: true
  })
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [importMessage, setImportMessage] = useState('')

  const handleExportExcel = () => {
    const selectedReceipts = exportOptions.receipts ? receipts : []
    const selectedInvoices = exportOptions.invoices ? invoices : []
    const selectedAllocations = exportOptions.allocations ? feeAllocations : []
    const selectedAuditLogs = exportOptions.auditLogs ? auditLogs : []
    const selectedAnomalies = exportOptions.anomalies ? anomalies : []

    exportToExcel(
      selectedReceipts,
      selectedInvoices,
      selectedAllocations,
      selectedAuditLogs,
      selectedAnomalies
    )
  }

  const handleExportBackup = () => {
    const data = {
      receipts,
      invoices,
      feeAllocations,
      auditLogs,
      anomalies
    }
    exportBackup(data)
  }

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        importData(data)
        setImportStatus('success')
        setImportMessage('数据导入成功！')
      } catch (error) {
        setImportStatus('error')
        setImportMessage('导入失败，请检查文件格式是否正确')
      }
    }
    reader.readAsText(file)
  }

  const handleReset = () => {
    if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
      resetAllData()
    }
  }

  const stats = [
    { label: '收款流水', count: receipts.length, key: 'receipts' },
    { label: '发票记录', count: invoices.length, key: 'invoices' },
    { label: '分摊明细', count: feeAllocations.length, key: 'allocations' },
    { label: '异常记录', count: anomalies.length, key: 'anomalies' },
    { label: '审计日志', count: auditLogs.length, key: 'auditLogs' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">数据导出</h1>
        <p className="text-gray-500">导出分摊报表，备份和恢复数据</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <FileSpreadsheet className="text-green-600" size={20} />
              </div>
              <div>
                <h3 className="font-medium text-gray-700">导出Excel报表</h3>
                <p className="text-sm text-gray-500">包含完整的分摊明细和备注</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-sm font-medium text-gray-600">选择导出内容</p>
              {stats.map((stat) => (
                <label key={stat.key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportOptions[stat.key as keyof typeof exportOptions]}
                    onChange={(e) => setExportOptions({
                      ...exportOptions,
                      [stat.key]: e.target.checked
                    })}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-sm text-gray-700">{stat.label}</span>
                  <span className="text-xs text-gray-400">({stat.count} 条)</span>
                </label>
              ))}
            </div>

            <button
              onClick={handleExportExcel}
              className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download size={18} />
              下载Excel文件
            </button>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Database className="text-blue-600" size={20} />
              </div>
              <div>
                <h3 className="font-medium text-gray-700">数据备份</h3>
                <p className="text-sm text-gray-500">导出完整数据用于备份或迁移</p>
              </div>
            </div>

            <button
              onClick={handleExportBackup}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Download size={18} />
              导出备份文件
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Upload className="text-purple-600" size={20} />
              </div>
              <div>
                <h3 className="font-medium text-gray-700">导入备份数据</h3>
                <p className="text-sm text-gray-500">从备份文件恢复数据</p>
              </div>
            </div>

            <label className="w-full flex flex-col items-center justify-center py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
              <Upload size={32} className="text-gray-400 mb-2" />
              <span className="text-sm text-gray-600">点击选择JSON备份文件</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
              />
            </label>

            {importStatus !== 'idle' && (
              <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${importStatus === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {importStatus === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                <span className="text-sm">{importMessage}</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="text-red-600" size={20} />
              </div>
              <div>
                <h3 className="font-medium text-gray-700">危险操作</h3>
                <p className="text-sm text-gray-500">清空所有数据</p>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              此操作将清空所有收款流水、发票、分摊记录等数据，请谨慎操作。建议先导出备份。
            </p>

            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <AlertCircle size={18} />
              清空所有数据
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-medium text-gray-700 mb-4">当前数据概览</h3>
        <div className="grid grid-cols-5 gap-4">
          {stats.map((stat) => (
            <div key={stat.key} className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-primary-600">{stat.count}</div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
