import { useState, useEffect } from 'react'
import { useStore } from '@/store'
import { fetchReport, getReportExportUrl } from '@/api'
import { StatusBadge, CredibilityBadge, SourceBadge, UnitBadge } from '@/components/Badges'
import { FileBarChart, Download, AlertTriangle, CheckCircle2, Clock, AlertCircle, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import type { RecordDetail } from '@/store'

export default function ReportPage() {
  const { reportSummary, reportGroups, setReport, currentRole } = useStore()
  const [expandedSensor, setExpandedSensor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadReport()
  }, [])

  async function loadReport() {
    setLoading(true)
    try {
      const result = await fetchReport()
      setReport(result.summary, result.groups)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const displayValue = (r: RecordDetail) => r.correctedValue ?? r.temperatureValue
  const displayUnit = (r: RecordDetail) => r.correctedUnit ?? r.temperatureUnit

  const StatCard = ({ icon: Icon, label, value, colorClass, bgClass, borderClass }: any) => (
    <div className={`${bgClass} ${borderClass} rounded-xl p-4 border`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className={colorClass} />
        <span className={`text-xs ${colorClass}`}>{label}</span>
      </div>
      <p className={`text-2xl font-bold font-mono ${colorClass}`}>{value}</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">交接报告</h2>
          <p className="text-slate-500 text-sm mt-1">训练教练十分钟临会也能一目了然哪条来自传感器、哪条等确认</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadReport}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-lg transition-colors"
          >
            刷新
          </button>
          <a
            href={getReportExportUrl()}
            className="px-4 py-2 bg-[#0C2340] hover:bg-[#1e3a5f] text-white text-sm rounded-lg flex items-center gap-2 transition-colors"
          >
            <Download size={16} />
            导出 CSV
          </a>
        </div>
      </div>

      {reportSummary && (
        <div className="bg-gradient-to-r from-[#0C2340] to-[#1e3a5f] rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-4">
            <FileBarChart size={20} />
            <span className="font-semibold">交接报告 · 快速查阅面板</span>
            <span className="ml-auto text-xs text-slate-300">
              生成时间：{new Date().toLocaleString('zh-CN')}
            </span>
          </div>
          <div className="grid grid-cols-6 gap-3">
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-300 mb-1">总记录数</p>
              <p className="text-2xl font-bold font-mono">{reportSummary.totalRecords}</p>
            </div>
            <div className="bg-emerald-500/20 rounded-lg p-3 text-center border border-emerald-500/40">
              <p className="text-xs text-emerald-200 mb-1">正常</p>
              <p className="text-2xl font-bold font-mono text-emerald-100">{reportSummary.normalCount}</p>
            </div>
            <div className="bg-amber-500/20 rounded-lg p-3 text-center border border-amber-500/40">
              <p className="text-xs text-amber-200 mb-1">单位混用</p>
              <p className="text-2xl font-bold font-mono text-amber-100">{reportSummary.mixedCount}</p>
            </div>
            <div className="bg-orange-500/20 rounded-lg p-3 text-center border border-orange-500/40">
              <p className="text-xs text-orange-200 mb-1">待确认</p>
              <p className="text-2xl font-bold font-mono text-orange-100">{reportSummary.pendingCount}</p>
            </div>
            <div className="bg-emerald-500/20 rounded-lg p-3 text-center border border-emerald-500/40">
              <p className="text-xs text-emerald-200 mb-1">已确认</p>
              <p className="text-2xl font-bold font-mono text-emerald-100">{reportSummary.confirmedCount}</p>
            </div>
            <div className="bg-slate-500/20 rounded-lg p-3 text-center border border-slate-500/40">
              <p className="text-xs text-slate-300 mb-1">已回滚</p>
              <p className="text-2xl font-bold font-mono text-slate-100">{reportSummary.rolledBackCount}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {reportSummary && (
          <>
            <StatCard icon={CheckCircle2} label="正常" value={reportSummary.normalCount} colorClass="text-emerald-700" bgClass="bg-emerald-50" borderClass="border-emerald-200" />
            <StatCard icon={AlertTriangle} label="混用待复核" value={reportSummary.mixedCount} colorClass="text-amber-700" bgClass="bg-amber-50" borderClass="border-amber-200" />
            <StatCard icon={Clock} label="待确认" value={reportSummary.pendingCount} colorClass="text-orange-700" bgClass="bg-orange-50" borderClass="border-orange-200" />
            <StatCard icon={RotateCcw} label="已回滚" value={reportSummary.rolledBackCount} colorClass="text-slate-700" bgClass="bg-slate-50" borderClass="border-slate-200" />
          </>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">按传感器编号分组</h3>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              传感器原始
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              照片修正
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              教练确认
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              待确认
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              已回滚
            </span>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {loading && (
            <div className="p-10 text-center text-slate-500">加载中...</div>
          )}
          {!loading && reportGroups.length === 0 && (
            <div className="p-10 text-center text-slate-500">暂无数据，请先导入传感器数据</div>
          )}
          {reportGroups.map((group) => {
            const hasIssue = group.records.some(r => r.status === 'mixed_unit' || r.status === 'anomaly' || r.credibility === 'pending_confirmation')
            const isExpanded = expandedSensor === group.sensorId
            return (
              <div key={group.sensorId}>
                <div
                  onClick={() => setExpandedSensor(isExpanded ? null : group.sensorId)}
                  className="px-5 py-3 flex items-center cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  {hasIssue && <AlertTriangle className="text-amber-500 mr-2" size={16} />}
                  <span className="font-mono font-semibold text-slate-900 w-40">{group.sensorId}</span>
                  <span className="text-sm text-slate-500 ml-4">{group.records.length} 条记录</span>
                  <div className="flex gap-1.5 ml-4">
                    {group.records.map((r, i) => (
                      <span
                        key={r.id}
                        title={`行号 ${r.originalLineNo}: ${displayValue(r)} ${displayUnit(r)}`}
                        className={`w-2.5 h-2.5 rounded-full ${
                          r.credibility === 'pending_confirmation' ? 'bg-amber-500' :
                          r.source === 'photo_corrected' ? 'bg-indigo-500' :
                          r.source === 'coach_confirmed' ? 'bg-emerald-600' :
                          r.source === 'rolled_back' ? 'bg-slate-400' :
                          'bg-emerald-500'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1 ml-4">
                    {group.records.filter(r => r.status === 'mixed_unit').length > 0 && (
                      <StatusBadge status="mixed_unit" />
                    )}
                    {group.records.some(r => r.credibility === 'pending_confirmation') && (
                      <CredibilityBadge credibility="pending_confirmation" />
                    )}
                  </div>
                  <span className="ml-auto text-slate-400">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </span>
                </div>
                {isExpanded && (
                  <div className="bg-slate-50 border-t border-slate-100">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-5 py-2 text-left font-medium text-slate-500">原始行号</th>
                          <th className="px-5 py-2 text-right font-medium text-slate-500">原始值</th>
                          <th className="px-5 py-2 text-right font-medium text-slate-500">当前值</th>
                          <th className="px-5 py-2 text-left font-medium text-slate-500">状态</th>
                          <th className="px-5 py-2 text-left font-medium text-slate-500">可信度</th>
                          <th className="px-5 py-2 text-left font-medium text-slate-500">数据来源</th>
                          <th className="px-5 py-2 text-left font-medium text-slate-500">备注</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {group.records.map((r) => (
                          <tr key={r.id} className={r.status === 'mixed_unit' ? 'bg-amber-50/60' : ''}>
                            <td className="px-5 py-2.5 font-mono text-slate-500">{r.originalLineNo}</td>
                            <td className="px-5 py-2.5 font-mono text-right text-slate-500">
                              {r.temperatureValue} <UnitBadge unit={r.temperatureUnit} />
                            </td>
                            <td className="px-5 py-2.5 font-mono text-right font-semibold text-slate-900">
                              {displayValue(r)} <UnitBadge unit={displayUnit(r)} />
                            </td>
                            <td className="px-5 py-2.5"><StatusBadge status={r.status} /></td>
                            <td className="px-5 py-2.5"><CredibilityBadge credibility={r.credibility} /></td>
                            <td className="px-5 py-2.5"><SourceBadge source={r.source} /></td>
                            <td className="px-5 py-2.5 text-slate-600 text-xs max-w-xs truncate" title={r.note || ''}>
                              {r.note || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-slate-500" />
          边界规则说明
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
          <div className="space-y-1">
            <p><strong>摄氏度 / 开尔文混用判定：</strong></p>
            <p className="text-slate-500">同一传感器编号下存在两种单位的记录，即判定为混用，标记为"待教练复核"，不自动转换。</p>
          </div>
          <div className="space-y-1">
            <p><strong>数据来源标记：</strong></p>
            <p className="text-slate-500">交接报告中每条数据均标记来源：传感器原始 / 照片修正 / 教练确认 / 已回滚，永不丢失证据链。</p>
          </div>
          <div className="space-y-1">
            <p><strong>数据一致性：</strong></p>
            <p className="text-slate-500">导出明细、页面展示、接口返回均读取同一份数据库记录，不存在一处异常一处消失的问题。</p>
          </div>
          <div className="space-y-1">
            <p><strong>回滚机制：</strong></p>
            <p className="text-slate-500">训练教练可随时回滚至原始传感器读数，回滚原因记录在案，所有变更均可追溯。</p>
          </div>
        </div>
      </div>
    </div>
  )
}
