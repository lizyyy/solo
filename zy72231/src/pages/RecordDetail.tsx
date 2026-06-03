import { useMatrixStore } from "@/store/useMatrixStore"
import { useParams, useNavigate } from "react-router-dom"
import Timeline from "@/components/Timeline"
import StatusBadge from "@/components/StatusBadge"
import { ArrowLeft, Play, AlertTriangle, ArrowRight } from "lucide-react"

const reviewStatusLabel: Record<string, string> = {
  none: "未复核",
  confirmed: "已确认",
  rejected: "已驳回",
}

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const store = useMatrixStore()
  const record = id ? store.getRecordById(id) : undefined

  if (!record) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        记录不存在
      </div>
    )
  }

  const { custodyData, exRightsData } = record

  return (
    <div>
      <div
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm cursor-pointer transition-colors"
        onClick={() => navigate("/")}
      >
        <ArrowLeft className="w-4 h-4" />
        返回看板
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center">
          <span className="text-2xl font-bold text-white">{record.assetName}</span>
          <span className="font-mono text-slate-400 ml-3">{record.assetCode}</span>
        </div>
        <StatusBadge status={record.status} />
      </div>

      {record.status === "pending_review" && (
        <div className="bg-[#FFAA00]/10 border border-[#FFAA00]/30 rounded-lg p-4 flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#FFAA00]" />
            <span className="text-[#FFAA00] text-sm">T+1到账被手工改为T+2，待基金经理复核</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="bg-[#00D68F]/20 text-[#00D68F] hover:bg-[#00D68F]/30 px-3 py-1.5 rounded-lg text-sm"
              onClick={() => store.reviewRecord(id!, "confirmed")}
            >
              确认
            </button>
            <button
              className="bg-[#FF6B6B]/20 text-[#FF6B6B] hover:bg-[#FF6B6B]/30 px-3 py-1.5 rounded-lg text-sm"
              onClick={() => store.reviewRecord(id!, "rejected")}
            >
              驳回
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mt-6">
        <div className="flex flex-col gap-6">
          <div className="bg-[#1A2B3C] rounded-xl border border-slate-700/50 p-5">
            <div className="text-base font-semibold text-white mb-4">基本信息</div>
            <div className="grid grid-cols-2 gap-y-3">
              <div>
                <div className="text-xs text-slate-400">资产名称</div>
                <div className="text-sm text-white">{record.assetName}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">资产代码</div>
                <div className="text-sm font-mono text-white">{record.assetCode}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">结算口径</div>
                <div className="text-sm font-mono text-white">{record.settlementCaliber}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">原始口径</div>
                <div className="text-sm font-mono text-white">{record.originalCaliber}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">人工修正</div>
                <div className={`text-sm ${record.isManualCorrection ? "text-[#FFAA00]" : "text-[#00D68F]"}`}>
                  {record.isManualCorrection ? "是" : "否"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">复核状态</div>
                <div className="text-sm text-white">{reviewStatusLabel[record.reviewStatus]}</div>
              </div>
            </div>
          </div>

          <div className="bg-[#1A2B3C] rounded-xl border border-slate-700/50 p-5">
            <div className="text-base font-semibold text-white mb-4">托管确认页数据</div>
            <div className="grid grid-cols-2 gap-y-3">
              <div>
                <div className="text-xs text-slate-400">导入时间</div>
                <div className="text-sm text-white">{custodyData.importTime}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">结算日期</div>
                <div className="text-sm text-white">{custodyData.settlementDate}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">到账金额</div>
                <div className="text-sm text-white">
                  {custodyData.amount.toLocaleString()} {custodyData.currency}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">确认页编号</div>
                <div className="text-sm font-mono text-white">{custodyData.confirmationPageRef}</div>
              </div>
            </div>
          </div>

          {exRightsData && (
            <div className="bg-[#1A2B3C] rounded-xl border border-slate-700/50 p-5">
              <div className="text-base font-semibold text-white mb-4">除权日截图数据</div>
              <div className="grid grid-cols-2 gap-y-3">
                <div>
                  <div className="text-xs text-slate-400">补录时间</div>
                  <div className="text-sm text-white">{exRightsData.supplementTime}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">除权日期</div>
                  <div className="text-sm text-white">{exRightsData.exRightsDate}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">调整后金额</div>
                  <div className="text-sm text-white">
                    {exRightsData.adjustedAmount?.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">截图编号</div>
                  <div className="text-sm font-mono text-white">{exRightsData.screenshotRef}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-slate-400">备注</div>
                  <div className="text-sm text-white">{exRightsData.remark}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <div className="bg-[#1A2B3C] rounded-xl border border-slate-700/50 p-5">
            <div className="text-base font-semibold text-white mb-4">对账说明</div>
            {record.previousReconciliationNote ? (
              <div>
                <div className="text-xs text-slate-400">变更前</div>
                <div className="text-sm text-slate-500 line-through">{record.previousReconciliationNote}</div>
                <ArrowRight className="w-4 h-4 text-slate-600 my-2" />
                <div className="text-xs text-slate-400">变更后</div>
                <div className="text-sm text-white">{record.reconciliationNote}</div>
              </div>
            ) : (
              <div className="text-sm text-slate-300">{record.reconciliationNote}</div>
            )}
          </div>

          <div className="bg-[#1A2B3C] rounded-xl border border-slate-700/50 p-5 mt-6">
            <div className="text-base font-semibold text-white mb-4">生命周期</div>
            <Timeline events={record.timeline} />
          </div>

          <div className="flex justify-end mt-4">
            <button
              className="flex items-center gap-2 bg-[#0F1923] border border-slate-700 hover:border-slate-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              onClick={() => store.rerunRecord(id!)}
            >
              <Play className="w-4 h-4" />
              重新计算
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
