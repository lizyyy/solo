import { useStore } from '@/store/useStore'
import AuditTimeline from '@/components/AuditTimeline'
import {
  formatTimestamp,
  statusLabel,
  sourceTypeLabel,
} from '@/utils/helpers'
import { Clock, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function AuditPage() {
  const records = useStore((s) => s.records)
  const auditLog = useStore((s) => s.auditLog)
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">审计追踪</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            每条记录的原始来源、处理时间、判定结果，换人可看懂前次判断
          </p>
        </div>
        <button
          onClick={() => navigate('/input')}
          className="flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs text-orange-400 transition-all hover:bg-orange-500/20"
        >
          追加数据
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
          <h3 className="mb-4 text-sm font-medium text-slate-300">
            记录来源总览
          </h3>
          {records.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              暂无记录
            </div>
          ) : (
            <div className="space-y-2">
              {[...records]
                .sort(
                  (a, b) =>
                    new Date(a.timestamp).getTime() -
                    new Date(b.timestamp).getTime()
                )
                .map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-slate-700/30 bg-slate-800/50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-300">
                          #{r.id.slice(-8)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            r.status === 'passed'
                              ? 'bg-green-500/10 text-green-400'
                              : r.status === 'needs_review'
                                ? 'bg-yellow-500/10 text-yellow-400'
                                : 'bg-blue-500/10 text-blue-400'
                          }`}
                        >
                          {statusLabel(r.status)}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-600">
                        处理于 {formatTimestamp(r.processedAt)}
                      </span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-slate-500">
                      <div>
                        时间：{formatTimestamp(r.timestamp)}
                      </div>
                      <div>
                        来源：{sourceTypeLabel(r.source.type)} -{' '}
                        {r.source.reference}
                      </div>
                      <div>
                        力：{r.force.toFixed(1)} {r.forceUnit}
                      </div>
                      <div>
                        位移：{r.displacement.toFixed(1)} {r.displacementUnit}
                      </div>
                    </div>
                    {r.amendedFrom && (
                      <div className="mt-1.5 rounded border border-blue-500/20 bg-blue-500/5 px-2 py-1 text-[10px] text-blue-300">
                        旧口径说明：{r.amendedFrom}
                      </div>
                    )}
                    {r.reviewNote && (
                      <div className="mt-1.5 rounded border border-green-500/20 bg-green-500/5 px-2 py-1 text-[10px] text-green-300">
                        确认意见：{r.reviewNote}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-medium text-slate-300">
              操作时间线
            </h3>
          </div>
          <AuditTimeline />
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
        <h3 className="mb-3 text-sm font-medium text-slate-300">
          使用说明
        </h3>
        <div className="space-y-3 text-xs text-slate-400">
          <div>
            <h4 className="mb-1 text-slate-300">如何跑样例</h4>
            <p>
              进入「数据录入」页面，点击「加载样例数据」按钮，系统会自动注入三条样例记录（顺利通过、超阈值需确认、旧口径补录）及其审计日志。
            </p>
          </div>
          <div>
            <h4 className="mb-1 text-slate-300">如何改参数</h4>
            <p>
              进入「图表可视化」页面底部的「安全阈值参数配置」区域，修改力/位移的安全上下限、最大时间间隔、期望单位等参数。修改后系统自动重新校验所有记录并更新图表。注意：阈值变更不会删除已有的审计日志，新判定会追加到操作时间线。
            </p>
          </div>
          <div>
            <h4 className="mb-1 text-slate-300">哪里看失败原因</h4>
            <p>
              进入「校验与异常」页面，点击每条记录可展开详情查看各项检查的结果。未通过的检查会显示红色/黄色图标及具体原因，并给出修正建议。超安全阈值的记录会出现在「需人工确认」区域，可点击「确认」按钮补充判定意见。
            </p>
          </div>
          <div>
            <h4 className="mb-1 text-slate-300">如何追加数据</h4>
            <p>
              点击本页右上角的「追加数据」按钮或直接进入「数据录入」页面，新增的数据会追加到现有记录中，不会破坏已有判定。所有新增操作都会记录在审计时间线中。
            </p>
          </div>
          <div>
            <h4 className="mb-1 text-slate-300">交接时怎么看前次判断</h4>
            <p>
              在「记录来源总览」中，每条记录都标注了原始来源、处理时间、判定状态、确认意见和旧口径说明。在「操作时间线」中，可以追溯每条记录的完整操作历史，包括谁在什么时候做了什么判定，从什么状态变更为什么状态。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
