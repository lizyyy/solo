import { useState } from "react"
import { Upload, FileDown, X } from "lucide-react"
import { useReviewStore } from "@/store/useReviewStore"

export default function ImportArea() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [form, setForm] = useState({
    date: "",
    counterNo: "",
    tailNumber: "",
    taxRateRemark: "",
    approver: "",
    balanceBefore: "",
  })
  const addRecord = useReviewStore((s) => s.addRecord)

  const handleSubmit = () => {
    if (!form.date || !form.counterNo || !form.taxRateRemark || !form.approver || !form.balanceBefore) return
    addRecord({
      date: form.date,
      counterNo: form.counterNo,
      tailNumber: form.tailNumber,
      taxRateRemark: form.taxRateRemark,
      approver: form.approver,
      balanceBefore: parseFloat(form.balanceBefore),
    })
    setForm({
      date: "",
      counterNo: "",
      tailNumber: "",
      taxRateRemark: "",
      approver: "",
      balanceBefore: "",
    })
    setIsExpanded(false)
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
            <FileDown className="w-4 h-4 text-teal-600" />
          </div>
          <span className="text-sm font-semibold text-zinc-800">导入税费率备注</span>
        </div>
        <span className="text-xs text-zinc-400">
          {isExpanded ? "收起" : "点击展开"}
        </span>
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 border-t border-zinc-100">
          <div
            className={`mt-4 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragOver
                ? "border-teal-400 bg-teal-50"
                : "border-zinc-200 hover:border-zinc-300"
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragOver(false)
            }}
          >
            <Upload className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-xs text-zinc-400">
              拖拽 CSV 文件到此处（演示模式请使用下方手动录入）
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                日期 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                placeholder="YYYY-MM-DD"
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                柜台号 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.counterNo}
                onChange={(e) => setForm({ ...form, counterNo: e.target.value })}
                placeholder="如 A03"
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                柜台流水尾号
              </label>
              <input
                type="text"
                value={form.tailNumber}
                onChange={(e) => setForm({ ...form, tailNumber: e.target.value })}
                placeholder="可后续补录"
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                调整前余额 <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={form.balanceBefore}
                onChange={(e) => setForm({ ...form, balanceBefore: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                税费率备注 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.taxRateRemark}
                onChange={(e) => setForm({ ...form, taxRateRemark: e.target.value })}
                placeholder="如：增值税6%—柜台缴税正常"
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                审批人 <span className="red-400">*</span>
              </label>
              <input
                type="text"
                value={form.approver}
                onChange={(e) => setForm({ ...form, approver: e.target.value })}
                placeholder="中文姓名或拼音（拼音会标记待复核）"
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              />
              <p className="mt-1 text-[10px] text-amber-600">
                若审批人仅留拼音，系统将自动标记为"待复核"，留给客户经理复核
              </p>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setIsExpanded(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-600 border border-zinc-200 hover:bg-zinc-50 transition-colors flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={!form.date || !form.counterNo || !form.taxRateRemark || !form.approver || !form.balanceBefore}
              className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:bg-zinc-200 disabled:text-zinc-400 transition-colors flex items-center gap-1"
            >
              <Upload className="w-3.5 h-3.5" />
              导入
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
