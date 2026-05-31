import { useState, useMemo } from "react"
import { useStore } from "@/store/useStore"
import { Upload, Undo2, Download, AlertCircle, Check, X, FileJson, FileText, Clock, User } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import FilterPanel from "@/components/FilterPanel"
import type { CorrectionEntry } from "@/types"

type Tab = "import" | "revert" | "export"
type ImportType = "insurance" | "record" | "exhibition"
type ConflictResolution = "skip" | "overwrite" | "keep_both"

export default function OperationsCenter() {
  const {
    records,
    insurancePolicies,
    exhibitionChecklists,
    filters,
    setFilters,
    resetFilters,
    importData,
    exportFilteredRecords,
    importResults,
    revertCorrection,
  } = useStore()

  const [activeTab, setActiveTab] = useState<Tab>("import")

  const [importType, setImportType] = useState<ImportType>("record")
  const [conflictResolution, setConflictResolution] = useState<ConflictResolution>("skip")
  const [importText, setImportText] = useState("")
  const [parsedData, setParsedData] = useState<any[] | null>(null)
  const [parseError, setParseError] = useState("")

  const [selectedRecordId, setSelectedRecordId] = useState<string>("")
  const [revertOperator, setRevertOperator] = useState("")
  const [revertingCorrectionId, setRevertingCorrectionId] = useState<string | null>(null)

  const tabs = [
    { id: "import" as Tab, label: "导入", icon: Upload },
    { id: "revert" as Tab, label: "撤销", icon: Undo2 },
    { id: "export" as Tab, label: "导出", icon: Download },
  ]

  const selectedRecord = useMemo(() => {
    if (!selectedRecordId) return null
    return records.find((r) => r.id === selectedRecordId)
  }, [selectedRecordId, records])

  const filteredRecordsCount = useMemo(() => {
    let filtered = records
    if (filters.status) {
      filtered = filtered.filter((r) => r.status === filters.status)
    }
    if (filters.insuranceStatus === "linked") {
      filtered = filtered.filter((r) => r.insurancePolicyId !== null)
    } else if (filters.insuranceStatus === "missing") {
      filtered = filtered.filter((r) => r.insurancePolicyId === null)
    }
    if (filters.lightingStatus === "linked") {
      filtered = filtered.filter((r) => r.lightingRecordId !== null)
    } else if (filters.lightingStatus === "missing") {
      filtered = filtered.filter((r) => r.lightingRecordId === null)
    }
    if (filters.exhibitionStatus === "linked") {
      filtered = filtered.filter((r) => r.exhibitionId !== null)
    } else if (filters.exhibitionStatus === "missing") {
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
    return filtered.length
  }, [records, filters])

  const handleParseData = () => {
    setParseError("")
    setParsedData(null)
    try {
      const data = JSON.parse(importText)
      if (!Array.isArray(data)) {
        throw new Error("数据必须是数组格式")
      }
      setParsedData(data)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "解析失败")
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setImportText(content)
    }
    reader.readAsText(file)
  }

  const handleImport = () => {
    if (!parsedData) return
    importData(importType, parsedData, conflictResolution)
    setImportText("")
    setParsedData(null)
  }

  const handleRevert = (correctionId: string) => {
    if (!revertOperator.trim() || !selectedRecord) return
    revertCorrection(selectedRecord.id, correctionId, revertOperator.trim())
    setRevertingCorrectionId(null)
    setRevertOperator("")
  }

  const handleExport = (formatType: "json" | "csv") => {
    const content = exportFilteredRecords(formatType)
    const blob = new Blob([content], {
      type: formatType === "json" ? "application/json" : "text/csv;charset=utf-8;",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const filename = `restoration-records-${format(new Date(), "yyyyMMdd-HHmm")}.${formatType}`
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const last5ImportResults = useMemo(() => {
    return [...importResults].reverse().slice(0, 5)
  }, [importResults])

  const activeFilters = useMemo(() => {
    const active: string[] = []
    if (filters.status) active.push(`状态: ${filters.status}`)
    if (filters.insuranceStatus !== "all")
      active.push(`保险: ${filters.insuranceStatus === "linked" ? "已关联" : "未关联"}`)
    if (filters.lightingStatus !== "all")
      active.push(`照明: ${filters.lightingStatus === "linked" ? "已关联" : "未关联"}`)
    if (filters.exhibitionStatus !== "all")
      active.push(`展览: ${filters.exhibitionStatus === "linked" ? "已关联" : "未关联"}`)
    if (filters.dateFrom) active.push(`从: ${filters.dateFrom}`)
    if (filters.dateTo) active.push(`至: ${filters.dateTo}`)
    if (filters.search) active.push(`搜索: ${filters.search}`)
    return active
  }, [filters])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif font-semibold text-gray-900">操作中心</h2>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="flex border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === "import" && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    步骤 1: 选择数据类型
                  </label>
                  <div className="flex gap-6">
                    {[
                      { value: "insurance" as ImportType, label: "保险单" },
                      { value: "record" as ImportType, label: "修复记录" },
                      { value: "exhibition" as ImportType, label: "布展清单" },
                    ].map((option) => (
                      <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="importType"
                          value={option.value}
                          checked={importType === option.value}
                          onChange={(e) => setImportType(e.target.value as ImportType)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    步骤 2: 冲突处理方式
                  </label>
                  <div className="flex gap-6">
                    {[
                      { value: "skip" as ConflictResolution, label: "跳过" },
                      { value: "overwrite" as ConflictResolution, label: "覆盖" },
                      { value: "keep_both" as ConflictResolution, label: "保留两者" },
                    ].map((option) => (
                      <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="conflictResolution"
                          value={option.value}
                          checked={conflictResolution === option.value}
                          onChange={(e) =>
                            setConflictResolution(e.target.value as ConflictResolution)
                          }
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    步骤 3: 上传数据
                  </label>
                  <div className="space-y-3">
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder="在此粘贴 JSON 数据..."
                      className="w-full h-40 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer text-sm text-gray-700 transition-colors">
                        <FileJson className="w-4 h-4" />
                        选择文件 (.json / .csv)
                        <input
                          type="file"
                          accept=".json,.csv"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                      <button
                        onClick={handleParseData}
                        disabled={!importText.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
                      >
                        解析数据
                      </button>
                    </div>
                  </div>
                  {parseError && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                      <AlertCircle className="w-4 h-4" />
                      {parseError}
                    </div>
                  )}
                </div>

                {parsedData && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      步骤 4: 预览并确认
                    </label>
                    <div className="bg-gray-50 rounded-lg border p-4">
                      <p className="text-sm text-gray-600 mb-2">
                        共解析到 <span className="font-semibold text-gray-900">{parsedData.length}</span> 条数据
                      </p>
                      <div className="max-h-40 overflow-auto bg-white rounded border text-xs font-mono">
                        <pre className="p-2">
                          {JSON.stringify(parsedData.slice(0, 2), null, 2)}
                        </pre>
                      </div>
                      {parsedData.length > 2 && (
                        <p className="text-xs text-gray-500 mt-2">... 还有 {parsedData.length - 2} 条数据</p>
                      )}
                    </div>
                    <button
                      onClick={handleImport}
                      className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      开始导入
                    </button>
                  </div>
                )}
              </div>

              {last5ImportResults.length > 0 && (
                <div className="pt-6 border-t">
                  <h4 className="font-medium text-gray-900 mb-3">最近导入记录</h4>
                  <div className="space-y-3">
                    {last5ImportResults.map((result) => (
                      <div
                        key={result.id}
                        className="bg-gray-50 rounded-lg border p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-900">
                              {result.type === "insurance"
                                ? "保险单"
                                : result.type === "record"
                                ? "修复记录"
                                : "布展清单"}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {format(new Date(result.timestamp), "yyyy-MM-dd HH:mm:ss")}
                          </span>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <span className="text-gray-600">
                            总计: <span className="font-medium text-gray-900">{result.totalCount}</span>
                          </span>
                          <span className="text-green-600">
                            成功: <span className="font-medium">{result.successCount}</span>
                          </span>
                          <span className="text-yellow-600">
                            跳过: <span className="font-medium">{result.skippedCount}</span>
                          </span>
                          <span className="text-red-600">
                            错误: <span className="font-medium">{result.errorCount}</span>
                          </span>
                        </div>
                        {result.conflicts.length > 0 && (
                          <div className="mt-2 pt-2 border-t text-xs text-gray-500">
                            冲突: {result.conflicts.length} 条
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "revert" && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择修复记录
                </label>
                <select
                  value={selectedRecordId}
                  onChange={(e) => {
                    setSelectedRecordId(e.target.value)
                    setRevertingCorrectionId(null)
                    setRevertOperator("")
                  }}
                  className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">请选择一条记录...</option>
                  {records.map((record) => (
                    <option key={record.id} value={record.id}>
                      {record.artifactName} ({record.artifactId})
                    </option>
                  ))}
                </select>
              </div>

              {selectedRecord && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">
                    修正历史 - {selectedRecord.artifactName}
                  </h4>
                  {selectedRecord.correctionHistory.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg border p-8 text-center text-gray-500">
                      该记录暂无修正历史
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedRecord.correctionHistory.map((correction: CorrectionEntry) => (
                        <div
                          key={correction.id}
                          className={cn(
                            "bg-white rounded-lg border p-4",
                            correction.reverted && "opacity-60"
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium text-gray-900">
                                  {correction.field}
                                </span>
                                <span className="text-red-500 line-through">
                                  {correction.oldValue}
                                </span>
                                <X className="w-3 h-3 text-gray-400" />
                                <span className="text-green-600 font-medium">
                                  {correction.newValue}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {correction.operator}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(correction.timestamp), "yyyy-MM-dd HH:mm")}
                                </span>
                                <span>原因: {correction.reason}</span>
                              </div>
                              {correction.reverted && (
                                <div className="mt-2 text-xs text-gray-400">
                                  已于 {format(new Date(correction.revertedAt!), "yyyy-MM-dd HH:mm")} 由 {correction.revertedBy} 撤销
                                </div>
                              )}
                            </div>
                            {!correction.reverted &&
                              revertingCorrectionId !== correction.id && (
                                <button
                                  onClick={() => {
                                    setRevertingCorrectionId(correction.id)
                                    setRevertOperator("")
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                >
                                  <Undo2 className="w-4 h-4" />
                                  撤销
                                </button>
                              )}
                            {revertingCorrectionId === correction.id && (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={revertOperator}
                                  onChange={(e) => setRevertOperator(e.target.value)}
                                  placeholder="输入操作人姓名"
                                  className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                  onClick={() => handleRevert(correction.id)}
                                  disabled={!revertOperator.trim()}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white rounded-md text-sm transition-colors"
                                >
                                  <Check className="w-4 h-4" />
                                  确认
                                </button>
                                <button
                                  onClick={() => {
                                    setRevertingCorrectionId(null)
                                    setRevertOperator("")
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-gray-600"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "export" && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">导出设置</p>
                    <p className="text-sm text-blue-700">
                      筛选后共 <span className="font-bold">{filteredRecordsCount}</span> 条记录将被导出
                    </p>
                  </div>
                </div>
                {activeFilters.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {activeFilters.map((filter, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-white border border-blue-200 rounded text-xs text-blue-700"
                      >
                        {filter}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <FilterPanel
                filters={filters}
                onFilterChange={setFilters}
                onReset={resetFilters}
              />

              <div className="flex gap-4 pt-4 border-t">
                <button
                  onClick={() => handleExport("json")}
                  className="flex items-center gap-2 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors"
                >
                  <FileJson className="w-5 h-5" />
                  导出 JSON
                </button>
                <button
                  onClick={() => handleExport("csv")}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <FileText className="w-5 h-5" />
                  导出 CSV
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
