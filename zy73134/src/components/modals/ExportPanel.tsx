import React, { useMemo } from 'react'
import { X, Download, RefreshCcw } from 'lucide-react'
import { useStationStore } from '@/store/stationStore'
import {
  buildExportPayload,
  downloadJSON,
  generateTimestamp,
} from '@/utils/export'
import { StationDiff, FieldChange } from '@/types/station'
import AnimatedNumber from '@/components/ui/AnimatedNumber'

const fieldLabelMap: Record<string, string> = {
  status: '状态',
  remark: '备注',
  batch_id: '批次',
  sampling_time: '采样时间',
  experiment_result: '实验结果',
  result_value: '结果数值',
  time_conflict: '时间冲突',
  result_abnormal: '结果超阈',
  cloud_impact: '云遮等级',
}

const ExportPanel: React.FC = () => {
  const { showExportPanel, setShowExportPanel, records } = useStationStore()

  const payload = useMemo(() => buildExportPayload(records), [records])

  const stats = useMemo(() => {
    const list = payload.records
    const normal = list.filter(
      (r) => !r.time_conflict && !r.result_abnormal && r.cloud_impact !== '严重',
    ).length
    const anomaly = list.filter((r) => r.time_conflict || r.result_abnormal).length
    const cloudHeavy = list.filter((r) => r.cloud_impact === '严重').length
    return { normal, anomaly, cloudHeavy }
  }, [payload])

  const diffMap = useMemo(() => {
    const m = new Map<string, StationDiff>()
    for (const d of payload.diff) m.set(d.station_code, d)
    return m
  }, [payload])

  const changedFieldsFor = (
    stationCode: string,
    field: string,
  ): FieldChange | undefined => {
    const d = diffMap.get(stationCode)
    if (!d) return undefined
    return d.changes.find((c) => c.field === field)
  }

  const handleDownload = () => {
    const filename = `tidal-stations-report-${generateTimestamp()}.json`
    downloadJSON(payload, filename)
  }

  if (!showExportPanel) return null

  const handleMaskClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setShowExportPanel(false)
  }

  const origMap = useMemo(() => {
    const m = new Map<string, (typeof payload.originalRecords)[number]>()
    for (const r of payload.originalRecords) m.set(r.station_code, r)
    return m
  }, [payload])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={handleMaskClick}
    >
      <div className="glass-strong max-w-6xl w-[94%] max-h-[88vh] rounded-2xl overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.55)] flex flex-col border border-deepsea-400/40">
        <div className="flex items-center justify-between px-6 py-4 border-b border-deepsea-500/40 bg-deepsea-800/40">
          <div className="flex items-center gap-2.5">
            <RefreshCcw
              size={18}
              className="text-coral-glow drop-shadow-[0_0_6px_rgba(255,122,69,0.55)]"
            />
            <h2 className="text-[16px] font-display font-semibold text-deepsea-50">
              重新汇总导出
            </h2>
            <span className="text-[10px] text-deepsea-300/70 font-mono ml-1">
              @ {new Date(payload.exportedAt).toLocaleString()}
            </span>
          </div>
          <button
            onClick={() => setShowExportPanel(false)}
            className="p-2 rounded-lg text-deepsea-200/80 hover:text-deepsea-50 hover:bg-deepsea-600/50 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 pt-5">
            <div className="grid grid-cols-3 gap-4">
              <div className="glass rounded-xl px-5 py-4 border border-deepsea-500/30 flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-alert-green/15 border border-alert-green/40 flex items-center justify-center shadow-[0_0_12px_rgba(52,211,153,0.3)]">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <AnimatedNumber
                    value={stats.normal}
                    duration={1000}
                    className="font-display font-bold text-3xl text-alert-green drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                  />
                  <p className="text-[11px] text-deepsea-200/75 mt-0.5 tracking-wide">
                    正常站点数
                  </p>
                </div>
              </div>

              <div className="glass rounded-xl px-5 py-4 border border-deepsea-500/30 flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-alert-red/15 border border-alert-red/40 flex items-center justify-center shadow-[0_0_12px_rgba(255,90,95,0.3)]">
                  <span className="text-2xl">🚨</span>
                </div>
                <div>
                  <AnimatedNumber
                    value={stats.anomaly}
                    duration={1000}
                    className="font-display font-bold text-3xl text-alert-red drop-shadow-[0_0_8px_rgba(255,90,95,0.5)]"
                  />
                  <p className="text-[11px] text-deepsea-200/75 mt-0.5 tracking-wide">
                    异常数（时间/超阈）
                  </p>
                </div>
              </div>

              <div className="glass rounded-xl px-5 py-4 border border-deepsea-500/30 flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-alert-gray/20 border border-alert-gray/40 flex items-center justify-center shadow-[0_0_12px_rgba(138,148,166,0.3)]">
                  <span className="text-2xl">☁️</span>
                </div>
                <div>
                  <AnimatedNumber
                    value={stats.cloudHeavy}
                    duration={1000}
                    className="font-display font-bold text-3xl text-alert-gray drop-shadow-[0_0_8px_rgba(138,148,166,0.55)]"
                  />
                  <p className="text-[11px] text-deepsea-200/75 mt-0.5 tracking-wide">
                    云遮严重数
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            <h3 className="text-[13px] font-display font-semibold text-teal-glow mb-3 flex items-center gap-2">
              <RefreshCcw size={14} />
              新旧批次对比表 · 变更字段高亮
              <span className="ml-auto text-[11px] text-deepsea-300/70 font-normal">
                共 {payload.records.length} 站，{payload.diff.length} 站有变更
              </span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass rounded-xl overflow-hidden border border-deepsea-500/30">
                <div className="px-4 py-2.5 border-b border-deepsea-500/30 bg-deepsea-700/40 flex items-center justify-between">
                  <span className="text-[12px] font-display font-semibold text-deepsea-100 tracking-wide">
                    原始批次 · BATCH-ORIG
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-deepsea-500/40 text-deepsea-100/80 border border-deepsea-400/30">
                    n = {payload.originalRecords.length}
                  </span>
                </div>
                <div className="overflow-x-auto max-h-[48vh]">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-deepsea-800/95 backdrop-blur-sm z-10">
                      <tr className="text-[10.5px] uppercase tracking-wider text-deepsea-200/70">
                        <th className="px-3 py-2 font-medium">站点编号</th>
                        <th className="px-3 py-2 font-medium">状态</th>
                        <th className="px-3 py-2 font-medium">备注</th>
                        <th className="px-3 py-2 font-medium">异常标记</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payload.originalRecords.map((r) => {
                        return (
                          <tr
                            key={r.id}
                            className="border-t border-deepsea-600/30 hover:bg-deepsea-700/30 transition-colors text-[11.5px]"
                          >
                            <td className="px-3 py-2 font-mono font-semibold text-teal-glow/85">
                              {r.station_code}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex px-1.5 py-0.5 rounded text-[10px] ${
                                  r.status === '已核对'
                                    ? 'bg-alert-green/15 text-alert-green border border-alert-green/40'
                                    : r.status === '已修正'
                                    ? 'bg-alert-yellow/15 text-alert-yellow border border-alert-yellow/40'
                                    : 'bg-deepsea-400/25 text-deepsea-100 border border-deepsea-400/40'
                                }`}
                              >
                                {r.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 max-w-[140px] truncate text-deepsea-200/85">
                              {r.remark || (
                                <span className="text-deepsea-400/60 italic">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 space-x-1">
                              {r.time_conflict && (
                                <span
                                  title="时间冲突"
                                  className="inline-block text-[11px] bg-alert-red/15 text-alert-red border border-alert-red/40 px-1 rounded"
                                >
                                  ⏱
                                </span>
                              )}
                              {r.result_abnormal && (
                                <span
                                  title="结果超阈"
                                  className="inline-block text-[11px] bg-alert-red/15 text-alert-red border border-alert-red/40 px-1 rounded"
                                >
                                  ⚠
                                </span>
                              )}
                              {r.cloud_impact === '严重' && (
                                <span
                                  title="云遮严重"
                                  className="inline-block text-[11px] bg-alert-gray/20 text-alert-gray border border-alert-gray/40 px-1 rounded"
                                >
                                  ☁️
                                </span>
                              )}
                              {!r.time_conflict &&
                                !r.result_abnormal &&
                                r.cloud_impact !== '严重' && (
                                  <span className="text-[11px] text-deepsea-400/60">
                                    无
                                  </span>
                                )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="glass rounded-xl overflow-hidden border border-coral/30 shadow-[0_0_20px_rgba(255,122,69,0.12)]">
                <div className="px-4 py-2.5 border-b border-deepsea-500/30 bg-coral/10 flex items-center justify-between">
                  <span className="text-[12px] font-display font-semibold text-coral-glow tracking-wide">
                    新导出 · 重算批次
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-coral/20 text-coral-glow border border-coral/40">
                    n = {payload.records.length}
                  </span>
                </div>
                <div className="overflow-x-auto max-h-[48vh]">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-deepsea-800/95 backdrop-blur-sm z-10">
                      <tr className="text-[10.5px] uppercase tracking-wider text-deepsea-200/70">
                        <th className="px-3 py-2 font-medium">站点编号</th>
                        <th className="px-3 py-2 font-medium">状态</th>
                        <th className="px-3 py-2 font-medium">备注</th>
                        <th className="px-3 py-2 font-medium">异常标记</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payload.records.map((r) => {
                        const orig = origMap.get(r.station_code)
                        return (
                          <tr
                            key={r.id}
                            className="border-t border-deepsea-600/30 hover:bg-deepsea-700/30 transition-colors text-[11.5px]"
                          >
                            <td
                              className={`px-3 py-2 font-mono font-semibold ${
                                changedFieldsFor(r.station_code, 'status') ||
                                changedFieldsFor(r.station_code, 'remark')
                                  ? 'bg-coral/20 text-coral-glow'
                                  : 'text-teal-glow/85'
                              }`}
                            >
                              <span className="inline-flex items-center gap-1">
                                {r.station_code}
                                {(changedFieldsFor(r.station_code, 'status') ||
                                  changedFieldsFor(r.station_code, 'remark')) && (
                                  <RefreshCcw
                                    size={11}
                                    className="text-coral-glow animate-spin-slow"
                                    style={{ animationDuration: '6s' }}
                                  />
                                )}
                              </span>
                            </td>
                            <td
                              className={`px-3 py-2 ${
                                changedFieldsFor(r.station_code, 'status')
                                  ? 'bg-coral/20'
                                  : ''
                              }`}
                            >
                              <span
                                className={`inline-flex px-1.5 py-0.5 rounded text-[10px] ${
                                  r.status === '已核对'
                                    ? 'bg-alert-green/15 text-alert-green border border-alert-green/40'
                                    : r.status === '已修正'
                                    ? 'bg-alert-yellow/15 text-alert-yellow border border-alert-yellow/40'
                                    : 'bg-deepsea-400/25 text-deepsea-100 border border-deepsea-400/40'
                                }`}
                              >
                                {r.status}
                              </span>
                              {changedFieldsFor(r.station_code, 'status') &&
                                orig && (
                                  <div className="text-[9px] text-coral-glow mt-0.5 font-mono">
                                    ← {orig.status}
                                  </div>
                                )}
                            </td>
                            <td
                              className={`px-3 py-2 max-w-[140px] truncate ${
                                changedFieldsFor(r.station_code, 'remark')
                                  ? 'bg-coral/20 text-deepsea-50'
                                  : 'text-deepsea-200/85'
                              }`}
                              title={r.remark}
                            >
                              {r.remark || (
                                <span className="text-deepsea-400/60 italic">
                                  —
                                </span>
                              )}
                              {changedFieldsFor(r.station_code, 'remark') &&
                                orig &&
                                !orig.remark && (
                                  <div className="text-[9px] text-coral-glow mt-0.5">
                                    +新增备注
                                  </div>
                                )}
                            </td>
                            <td className="px-3 py-2 space-x-1">
                              {r.time_conflict && (
                                <span
                                  title="时间冲突"
                                  className="inline-block text-[11px] bg-alert-red/15 text-alert-red border border-alert-red/40 px-1 rounded"
                                >
                                  ⏱
                                </span>
                              )}
                              {r.result_abnormal && (
                                <span
                                  title="结果超阈"
                                  className="inline-block text-[11px] bg-alert-red/15 text-alert-red border border-alert-red/40 px-1 rounded"
                                >
                                  ⚠
                                </span>
                              )}
                              {r.cloud_impact === '严重' && (
                                <span
                                  title="云遮严重"
                                  className="inline-block text-[11px] bg-alert-gray/20 text-alert-gray border border-alert-gray/40 px-1 rounded"
                                >
                                  ☁️
                                </span>
                              )}
                              {!r.time_conflict &&
                                !r.result_abnormal &&
                                r.cloud_impact !== '严重' && (
                                  <span className="text-[11px] text-alert-green/85">
                                    ✓ 清除
                                  </span>
                                )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 pb-5">
            <div className="glass rounded-xl px-5 py-3.5 border border-deepsea-500/30 flex items-start gap-3">
              <span className="text-xl leading-none">📦</span>
              <div className="text-[12px] text-deepsea-100/85 leading-relaxed">
                导出 JSON 含三层：
                <span className="text-teal-glow font-mono mx-1">records</span>
                （新导出）、
                <span className="text-teal-glow font-mono mx-1">
                  originalRecords
                </span>
                （原始快照）、
                <span className="text-teal-glow font-mono mx-1">diff</span>
                （变更清单），可用于前后对照与审计溯源。
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-deepsea-500/40 bg-deepsea-800/40">
          <button
            onClick={() => setShowExportPanel(false)}
            className="px-5 h-10 rounded-lg border border-deepsea-500/50 text-deepsea-100/90 hover:bg-deepsea-700/50 hover:border-deepsea-400/70 transition-all text-[13px] font-medium"
          >
            取消
          </button>
          <button
            onClick={handleDownload}
            className="btn-coral-glow inline-flex items-center gap-2 px-5 h-10 rounded-lg text-[13px]"
          >
            <Download size={15} />
            下载 JSON
          </button>
        </div>
      </div>
    </div>
  )
}

export default ExportPanel
