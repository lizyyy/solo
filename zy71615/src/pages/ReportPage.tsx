import { Link } from 'react-router-dom'
import { ArrowLeft, FileBarChart } from 'lucide-react'
import { ReportTable } from '../components/ReportTable'
import { TRAP_ROUND } from '../data/scenarios'

export function ReportPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-amber-400 font-serif flex items-center gap-2">
                <FileBarChart size={24} />
                经营报告
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                全链路追溯每笔交易的决策与结果
              </p>
            </div>
          </div>
          <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-4 py-2">
            <div className="text-xs text-amber-400">易错样例提示</div>
            <div className="text-sm text-amber-200">
              第 {TRAP_ROUND} 回合：汇率下跌 + 舱位紧张 + 逾期违约
            </div>
          </div>
        </div>

        <ReportTable />

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <h4 className="text-amber-400 font-medium mb-3">常见错误说明</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-slate-900 rounded p-3">
              <div className="text-red-400 font-medium mb-1">汇率反向操作</div>
              <div className="text-slate-400">
                汇率下跌（人民币升值）时仍装船，导致外币兑换人民币后收入缩水
              </div>
            </div>
            <div className="bg-slate-900 rounded p-3">
              <div className="text-red-400 font-medium mb-1">舱位超订</div>
              <div className="text-slate-400">
                装载货柜数超过已锁定舱位容量，每超一柜罚款 ¥2000
              </div>
            </div>
            <div className="bg-slate-900 rounded p-3">
              <div className="text-red-400 font-medium mb-1">违约金漏扣</div>
              <div className="text-slate-400">
                订单逾期未装船或主动取消，系统自动扣除违约金（订单金额的 20%-30%）
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
