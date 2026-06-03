import { useState } from "react"
import { useMatrixStore } from "@/store/useMatrixStore"
import { useNavigate } from "react-router-dom"
import { Upload, Image, ArrowRight, Check } from "lucide-react"
import type { MigrationRecord, ExRightsData } from "@/types"

export default function ImportPage() {
  const navigate = useNavigate()
  const { records, importCustodyData, supplementExRights } = useMatrixStore()

  const [assetName, setAssetName] = useState("")
  const [assetCode, setAssetCode] = useState("")
  const [amount, setAmount] = useState("")
  const [settlementDate, setSettlementDate] = useState("")
  const [isManualCorrection, setIsManualCorrection] = useState(false)

  const [selectedRecordId, setSelectedRecordId] = useState("")
  const [exRightsDate, setExRightsDate] = useState("")
  const [adjustedAmount, setAdjustedAmount] = useState("")
  const [remark, setRemark] = useState("")
  const [supplementSuccess, setSupplementSuccess] = useState(false)

  const recordsWithoutExRights = records.filter((r) => !r.exRightsData)

  const handleCustodyImport = () => {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
    const settlementCaliber = isManualCorrection ? "T+2" : "T+1"
    const status = isManualCorrection ? "pending_review" : "smooth"

    const record: MigrationRecord = {
      id,
      assetName,
      assetCode,
      custodyData: {
        source: "custody_confirmation",
        importTime: new Date().toISOString().split("T")[0],
        settlementDate,
        amount: Number(amount),
        currency: "CNY",
        confirmationPageRef: "CUST-" + Date.now(),
      },
      exRightsData: null,
      originalCaliber: "T+1",
      settlementCaliber,
      isManualCorrection,
      status,
      reconciliationNote:
        status === "pending_review"
          ? "T+1到账被手工改为T+2，待基金经理复核确认"
          : "托管确认页与系统口径一致，T+1到账，无需调整",
      timeline: [
        {
          id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
          type: "import",
          timestamp: new Date().toISOString(),
          description: "导入托管确认页数据",
        },
        ...(isManualCorrection
          ? [
              {
                id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
                type: "caliber_change",
                timestamp: new Date().toISOString(),
                description: "手工修正：T+1到账改为T+2",
              },
            ]
          : []),
      ],
      reviewStatus: "none",
    }

    importCustodyData(record)
    navigate(`/record/${record.id}`)
  }

  const handleExRightsSupplement = () => {
    const exRightsData: ExRightsData = {
      source: "ex_rights_screenshot",
      supplementTime: new Date().toISOString().split("T")[0],
      exRightsDate,
      adjustedAmount: Number(adjustedAmount),
      screenshotRef: "EXR-" + Date.now(),
      remark,
    }

    supplementExRights(selectedRecordId, exRightsData)
    setSupplementSuccess(true)
    setTimeout(() => setSupplementSuccess(false), 3000)
  }

  const inputClassName =
    "bg-[#0F1923] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-[#00D68F] focus:outline-none w-full"

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">导入与补录</h1>
        <p className="text-sm text-slate-400">
          托管确认页导入、除权日截图补录、对账说明联动更新
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-[#1A2B3C] rounded-xl border border-slate-700/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="h-5 w-5 text-[#00D68F]" />
            <h2 className="text-lg font-semibold text-white">托管确认页首次导入</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">资产名称</label>
              <input
                type="text"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">资产代码</label>
              <input
                type="text"
                value={assetCode}
                onChange={(e) => setAssetCode(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">到账金额</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">结算日期</label>
              <input
                type="date"
                value={settlementDate}
                onChange={(e) => setSettlementDate(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isManualCorrection}
                onChange={(e) => setIsManualCorrection(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-[#0F1923] text-[#00D68F] focus:ring-[#00D68F]"
              />
              <label className="text-sm text-white">是否人工修正</label>
            </div>
            {isManualCorrection && (
              <p className="text-[#FFAA00] text-xs mt-1">
                检测到人工修正：T+1→T+2，将标记为待基金经理复核
              </p>
            )}
          </div>

          <button
            onClick={handleCustodyImport}
            className="mt-4 bg-[#00D68F] hover:bg-[#00D68F]/80 text-[#0F1923] font-medium px-4 py-2 rounded-lg transition-colors text-sm flex items-center gap-2"
          >
            <ArrowRight className="h-4 w-4" />
            导入
          </button>
        </div>

        <div className="bg-[#1A2B3C] rounded-xl border border-slate-700/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Image className="h-5 w-5 text-[#8B5CF6]" />
            <h2 className="text-lg font-semibold text-white">除权日截图补录</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">选择记录</label>
              <select
                value={selectedRecordId}
                onChange={(e) => setSelectedRecordId(e.target.value)}
                className={inputClassName}
              >
                <option value="">请选择记录</option>
                {recordsWithoutExRights.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.assetName} ({r.assetCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">除权日期</label>
              <input
                type="date"
                value={exRightsDate}
                onChange={(e) => setExRightsDate(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">调整后金额</label>
              <input
                type="number"
                value={adjustedAmount}
                onChange={(e) => setAdjustedAmount(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">备注</label>
              <textarea
                rows={3}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="例如：除权日截图显示实际到账日为T+2，原T+1口径需修正"
                className={inputClassName}
              />
            </div>
          </div>

          <button
            onClick={handleExRightsSupplement}
            disabled={!selectedRecordId}
            className="mt-4 bg-[#8B5CF6] hover:bg-[#8B5CF6]/80 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="h-4 w-4" />
            补录
          </button>

          {supplementSuccess && (
            <p className="text-[#00D68F] text-sm mt-2">✓ 补录成功，对账说明已更新</p>
          )}
        </div>
      </div>
    </div>
  )
}
