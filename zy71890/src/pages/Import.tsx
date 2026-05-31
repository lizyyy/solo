import { useEffect, useState, useCallback } from "react"
import { useInspectionStore } from "@/store/useInspectionStore"
import ValidationResultList from "@/components/ValidationResultList"
import { Upload, CheckCircle, AlertTriangle, XCircle, Pencil } from "lucide-react"

export default function ImportPage() {
  const { loadMockData, dataLoaded, validationIssues } = useInspectionStore()
  const [loaded, setLoaded] = useState(dataLoaded)

  useEffect(() => {
    if (dataLoaded) setLoaded(true)
  }, [dataLoaded])

  const handleLoadSample = useCallback(() => {
    loadMockData()
    setLoaded(true)
  }, [loadMockData])

  const normalCount = validationIssues.filter((i) => i.issueType === "normal").length
  const lateCount = validationIssues.filter((i) => i.issueType === "late_attachment").length
  const dupCount = validationIssues.filter((i) => i.issueType === "duplicate").length
  const corrCount = validationIssues.filter((i) => i.issueType === "manual_correction").length

  return (
    <div className="h-full">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Upload className="h-5 w-5 text-slate-700" />
          <h1 className="text-lg font-semibold text-slate-800">数据导入与校验</h1>
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-6 py-6">
        {!loaded ? (
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 py-16 transition-colors hover:border-slate-400 hover:bg-slate-100"
            onClick={handleLoadSample}
          >
            <Upload className="mb-3 h-10 w-10 text-slate-400" />
            <p className="mb-1 text-sm font-medium text-slate-600">点击加载示例数据包</p>
            <p className="text-xs text-slate-400">包含工况日志、阈值配置、维修单（混有正常记录、晚到附件、重复项、人工更正）</p>
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-4 gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-lg font-semibold text-emerald-700">{normalCount}</p>
                  <p className="text-xs text-emerald-600">正常记录</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-lg font-semibold text-amber-700">{lateCount}</p>
                  <p className="text-xs text-amber-600">晚到附件</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-3">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-lg font-semibold text-red-700">{dupCount}</p>
                  <p className="text-xs text-red-600">重复项</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-3">
                <Pencil className="h-5 w-5 text-violet-500" />
                <div>
                  <p className="text-lg font-semibold text-violet-700">{corrCount}</p>
                  <p className="text-xs text-violet-600">人工更正</p>
                </div>
              </div>
            </div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">校验结果</h2>
              <span className="text-xs text-slate-400">共 {validationIssues.length} 条记录</span>
            </div>
            <ValidationResultList issues={validationIssues} />
          </>
        )}
      </div>
    </div>
  )
}
