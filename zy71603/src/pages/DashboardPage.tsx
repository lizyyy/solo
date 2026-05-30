import { useEffect } from "react"
import { useAnalysisStore } from "@/store/useAnalysisStore"
import SummaryCards from "@/components/Dashboard/SummaryCards"
import CreditorCheckChart from "@/components/Dashboard/CreditorCheckChart"
import ConfirmStatusChart from "@/components/Dashboard/ConfirmStatusChart"
import RepaymentMatchChart from "@/components/Dashboard/RepaymentMatchChart"
import AnomalyTypeChart from "@/components/Dashboard/AnomalyTypeChart"
import DetailDrawer from "@/components/DetailDrawer"
import { exportAnomaliesToCSV } from "@/utils/csvExport"
import { Download } from "lucide-react"

export default function DashboardPage() {
  const { result, runAnalysis, openDetail } = useAnalysisStore()

  useEffect(() => {
    if (!result) runAnalysis()
  }, [result, runAnalysis])

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-[#a0a0b0] text-lg">正在分析数据...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#f0ece4]">分析仪表盘</h1>
          <p className="text-sm text-[#a0a0b0] mt-1">点击图表数据点可查看对应明细</p>
        </div>
        <button
          onClick={() => exportAnomaliesToCSV(result.anomalies)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#242938] border border-[#2a3042] text-[#f0ece4] hover:bg-[#2d3348] transition-colors"
        >
          <Download size={16} />
          导出异常清单
        </button>
      </div>

      <SummaryCards
        totalAmount={result.summary.totalAmount}
        confirmedAmount={result.summary.confirmedAmount}
        matchedAmount={result.summary.matchedAmount}
        anomalyCount={result.summary.anomalyCount}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CreditorCheckChart
          normal={result.creditorCheck.normal}
          duplicate={result.creditorCheck.duplicate}
          amountMismatch={result.creditorCheck.amountMismatch}
          onSliceClick={(cat) => {
            const titles: Record<string, string> = {
              creditor_normal: "债权校验 - 正常发票",
              creditor_duplicate: "债权校验 - 重复转让发票",
              creditor_amount_mismatch: "债权校验 - 金额异常发票",
            }
            openDetail(cat, titles[cat] || "明细")
          }}
        />
        <ConfirmStatusChart
          confirmed={result.confirmStatus.confirmed}
          unconfirmed={result.confirmStatus.unconfirmed}
          partial={result.confirmStatus.partial}
          onSliceClick={(cat) => {
            const titles: Record<string, string> = {
              confirm_confirmed: "确认状态 - 已确认",
              confirm_unconfirmed: "确认状态 - 未确认",
              confirm_partial: "确认状态 - 部分确认",
            }
            openDetail(cat, titles[cat] || "明细")
          }}
        />
        <RepaymentMatchChart
          matched={result.repaymentMatch.matched}
          unmatched={result.repaymentMatch.unmatched}
          mismatched={result.repaymentMatch.mismatched}
          onSliceClick={(cat) => {
            const titles: Record<string, string> = {
              repayment_matched: "回款匹配 - 已匹配",
              repayment_unmatched: "回款匹配 - 未匹配",
              repayment_mismatched: "回款匹配 - 错配",
            }
            openDetail(cat, titles[cat] || "明细")
          }}
        />
        <AnomalyTypeChart
          anomalyByType={result.anomalyByType}
          onSliceClick={(cat) => {
            openDetail(cat, "异常明细")
          }}
        />
      </div>

      <DetailDrawer />
    </div>
  )
}
