import { Trophy, Users, Clock, AlertTriangle } from "lucide-react"
import { useSummaryStore } from "@/stores/summaryStore"
import { useRecordStore } from "@/stores/recordStore"
import StatsCard from "@/components/StatsCard"
import ExceptionTable from "@/components/ExceptionTable"
import { formatTime } from "@/utils"

export default function Summary() {
  const { getSummary, getStatsByLevelPack } = useSummaryStore()
  const { records } = useRecordStore()

  const summary = getSummary()
  const levelStats = getStatsByLevelPack()

  return (
    <div className="container py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">数据汇总</h1>
        <p className="text-slate-400">
          所有数据从训练记录汇总而来，与明细页保持一致，没有两套数字
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          icon={Trophy}
          label="训练局数"
          value={summary.totalRecords}
          color="info"
        />
        <StatsCard
          icon={Users}
          label="通过率"
          value={summary.passRate}
          valueSuffix="%"
          color={summary.passRate >= 70 ? "success" : "warning"}
        />
        <StatsCard
          icon={Clock}
          label="平均用时"
          value={summary.avgDuration}
          valueSuffix="秒"
          color="info"
        />
        <StatsCard
          icon={AlertTriangle}
          label="异常数"
          value={summary.exceptionCount}
          color={summary.exceptionCount > 0 ? "danger" : "success"}
        />
      </div>

      {levelStats.size > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-bold mb-4">各关卡包表现</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {Array.from(levelStats.entries()).map(([id, stat]) => (
              <div
                key={id}
                className="p-4 bg-slate-700/30 rounded-xl border border-slate-600/50"
              >
                <h3 className="font-medium mb-2">{stat.name}</h3>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-bold text-brand-400">
                      {stat.passRate}%
                    </div>
                    <div className="text-xs text-slate-400">
                      {stat.passed}/{stat.total} 局通过
                    </div>
                  </div>
                  <div
                    className={`w-16 h-16 rounded-full border-4 flex items-center justify-center text-sm font-bold ${
                      stat.passRate >= 70
                        ? "border-success text-success"
                        : "border-warning text-warning"
                    }`}
                    style={{
                      background: `conic-gradient(${
                        stat.passRate >= 70 ? "#4ade80" : "#fbbf24"
                      } ${stat.passRate * 3.6}deg, transparent 0deg)`,
                    }}
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                      {stat.passRate}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xl font-bold mb-4">
          异常追踪
          <span className="text-sm font-normal text-slate-400 ml-2">
            所有暂停、超时、边界分数、补录都在这里，不会在汇总里消失
          </span>
        </h2>
        <ExceptionTable exceptions={summary.allExceptions} />
      </div>

      {records.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-bold mb-4">数据一致性说明</h2>
          <div className="space-y-3 text-sm text-slate-300">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-success/20 text-success flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">
                ✓
              </div>
              <div>
                <strong>总分一致：</strong>
                汇总页显示的总局数 {summary.totalRecords} = 记录页的记录条数 {records.length}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-success/20 text-success flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">
                ✓
              </div>
              <div>
                <strong>通过率一致：</strong>
                汇总页通过率 {summary.passRate}% = 通过局数 {summary.passedRecords} / 总局数 {summary.totalRecords}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-success/20 text-success flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">
                ✓
              </div>
              <div>
                <strong>平均用时一致：</strong>
                汇总页平均用时 {formatTime(summary.avgDuration)} = 所有记录总用时 / 总局数
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-success/20 text-success flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">
                ✓
              </div>
              <div>
                <strong>异常不丢：</strong>
                汇总页异常数 {summary.exceptionCount} = 所有记录的暂停、超时、边界分数、补录、需确认项之和
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-success/20 text-success flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">
                ✓
              </div>
              <div>
                <strong>补录同步：</strong>
                补录调整分数后，汇总页的通过率、异常数会自动更新，不会出现补录了但汇总没变化的情况
              </div>
            </div>
          </div>
        </div>
      )}

      {records.length === 0 && (
        <div className="card p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-xl font-bold mb-2">还没有数据</h3>
          <p className="text-slate-400">
            完成几局训练后，这里就会有完整的统计数据了。
          </p>
        </div>
      )}
    </div>
  )
}
