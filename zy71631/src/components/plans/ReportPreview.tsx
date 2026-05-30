import { X, Printer } from 'lucide-react'
import { usePlanStore, useDataStore } from '@/stores'
import { FREQUENCY_BANDS } from '@/types'
import { formatDateTime, formatNumber, ANOMALY_LABELS } from '@/utils'

interface ReportPreviewProps {
  planId: string
  onClose: () => void
}

export default function ReportPreview({ planId, onClose }: ReportPreviewProps) {
  const plans = usePlanStore((state) => state.plans)
  const measurements = useDataStore((state) => state.measurements)
  const anomalies = useDataStore((state) => state.anomalies)
  const seats = useDataStore((state) => state.seats)
  const dataConflicts = useDataStore((state) => state.dataConflicts)

  const plan = plans.find((p) => p.id === planId)

  if (!plan) return null

  const seatIds = plan.snapshot.map((s) => s.seatId)
  const snapshotVals = plan.snapshot.map((s) => s.splDB)

  const stats = {
    avg: snapshotVals.reduce((a, b) => a + b, 0) / snapshotVals.length,
    max: Math.max(...snapshotVals),
    min: Math.min(...snapshotVals),
    count: snapshotVals.length,
  }

  const bandStats = FREQUENCY_BANDS.map((band) => {
    if (band === plan.frequencyBand) {
      return {
        band,
        avg: stats.avg,
        max: stats.max,
        min: stats.min,
      }
    }
    const bandMeasurements = measurements.filter(
      (m) => m.frequencyBand === band && seatIds.includes(m.seatId),
    )
    const vals = bandMeasurements.map((m) => m.splDB)
    return {
      band,
      avg: vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
      max: vals.length > 0 ? Math.max(...vals) : 0,
      min: vals.length > 0 ? Math.min(...vals) : 0,
    }
  })

  const planAnomalies = anomalies.filter(
    (a) => seatIds.includes(a.seatId || '') || a.frequencyBand === plan.frequencyBand,
  )

  const getSeatLabel = (seatId: string) => {
    const seat = seats.find((s) => s.id === seatId)
    return seat ? `${seat.rowLabel}${seat.seatNumber}` : seatId
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 bg-theater-dark/90 z-50 flex items-center justify-center p-4 fade-in print:p-0 print:bg-white">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-auto bg-white rounded-xl shadow-2xl print:max-h-none print:shadow-none print:rounded-none">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between print:hidden">
          <h2 className="font-display text-xl text-gray-900">报告预览</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-theater-accent text-white rounded-lg hover:bg-theater-accent/80 transition-colors"
            >
              <Printer className="w-4 h-4" />
              打印
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-8 text-black" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
          <div className="text-center border-b-2 border-gray-900 pb-6 mb-6">
            <h1 className="font-display text-3xl font-bold mb-2">声场报告</h1>
            <p className="text-xl text-gray-700">{plan.name}</p>
            <p className="text-sm text-gray-500 mt-2">{formatDateTime(plan.createdAt)}</p>
          </div>

          <section className="mb-8">
            <h2 className="font-display text-xl font-bold mb-4 border-b border-gray-300 pb-2">声场摘要</h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left">统计项</th>
                  <th className="border border-gray-300 px-4 py-2 text-center">数值 (dB)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">测量座位数</td>
                  <td className="border border-gray-300 px-4 py-2 text-center font-mono">{stats.count}</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">目标频段</td>
                  <td className="border border-gray-300 px-4 py-2 text-center font-mono">{plan.frequencyBand}</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">平均声压级</td>
                  <td className="border border-gray-300 px-4 py-2 text-center font-mono">{formatNumber(stats.avg)}</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">最大声压级</td>
                  <td className="border border-gray-300 px-4 py-2 text-center font-mono">{formatNumber(stats.max)}</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">最小声压级</td>
                  <td className="border border-gray-300 px-4 py-2 text-center font-mono">{formatNumber(stats.min)}</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">声场不均匀度</td>
                  <td className="border border-gray-300 px-4 py-2 text-center font-mono">{formatNumber(stats.max - stats.min)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="mb-8">
            <h2 className="font-display text-xl font-bold mb-4 border-b border-gray-300 pb-2">频段声压分布</h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-center">频段</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">平均 (dB)</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">最大 (dB)</th>
                  <th className="border border-gray-300 px-3 py-2 text-center">最小 (dB)</th>
                </tr>
              </thead>
              <tbody>
                {bandStats.map((row) => (
                  <tr key={row.band} className={row.band === plan.frequencyBand ? 'bg-blue-50' : ''}>
                    <td className="border border-gray-300 px-3 py-2 text-center font-mono font-medium">{row.band}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center font-mono">{formatNumber(row.avg)}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center font-mono">{formatNumber(row.max)}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center font-mono">{formatNumber(row.min)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mb-8">
            <h2 className="font-display text-xl font-bold mb-4 border-b border-gray-300 pb-2">
              异常列表
              <span className="text-sm font-normal text-gray-500 ml-2">({planAnomalies.length} 条)</span>
            </h2>
            {planAnomalies.length === 0 ? (
              <p className="text-gray-500">无异常记录</p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-2 text-left">类型</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">位置</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">描述</th>
                    <th className="border border-gray-300 px-3 py-2 text-center">严重程度</th>
                  </tr>
                </thead>
                <tbody>
                  {planAnomalies.map((anomaly) => (
                    <tr key={anomaly.id}>
                      <td className="border border-gray-300 px-3 py-2">
                        {ANOMALY_LABELS[anomaly.type] || anomaly.type}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 font-mono">
                        {anomaly.seatId ? getSeatLabel(anomaly.seatId) : anomaly.frequencyBand}
                      </td>
                      <td className="border border-gray-300 px-3 py-2">{anomaly.message}</td>
                      <td className={`border border-gray-300 px-3 py-2 text-center font-medium ${
                        anomaly.severity === 'error' ? 'text-red-600' : 'text-orange-600'
                      }`}>
                        {anomaly.severity === 'error' ? '错误' : '警告'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="mb-8">
            <h2 className="font-display text-xl font-bold mb-4 border-b border-gray-300 pb-2">
              调音备注
              <span className="text-sm font-normal text-gray-500 ml-2">({plan.notes.length} 条)</span>
            </h2>
            {plan.notes.length === 0 ? (
              <p className="text-gray-500">无调音备注</p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-2 text-left">目标</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">内容</th>
                    <th className="border border-gray-300 px-3 py-2 text-center">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.notes.map((note) => (
                    <tr key={note.id}>
                      <td className="border border-gray-300 px-3 py-2">
                        <span className="font-medium">{note.targetType === 'seat' ? '座位' : '扬声器'}</span>
                        <span className="font-mono ml-1">{getSeatLabel(note.targetId)}</span>
                      </td>
                      <td className="border border-gray-300 px-3 py-2">{note.content}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center font-mono text-xs">
                        {formatDateTime(note.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h2 className="font-display text-xl font-bold mb-4 border-b border-gray-300 pb-2">数据来源说明</h2>
            <div className="text-sm text-gray-700 space-y-3">
              <p>
                <strong>测量数据来源：</strong>本报告中的声压级数据来源于系统测量与人工调校的合并结果。
                系统测量数据通过声学传感器实时采集，人工调校数据由调音师根据现场听感进行修正。
              </p>
              <p>
                <strong>数据合并策略：</strong>当存在多个数据源时，系统优先采用最新的测量数据。
                如遇数据冲突，系统会保留冲突记录并标记，由用户决定最终采用的数据源。
              </p>
              {dataConflicts.size > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="font-medium text-yellow-800 mb-2">数据冲突警告：</p>
                  <ul className="list-disc list-inside text-yellow-700 space-y-1">
                    {Array.from(dataConflicts.entries()).map(([field, conflict]) => (
                      <li key={field}>
                        <span className="font-mono">{field}</span>: 现有数据来自 {conflict.existingSource}，
                        新数据来自 {conflict.newSource}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-gray-500 pt-4 border-t border-gray-200">
                报告生成时间：{formatDateTime(new Date().toISOString())} |
                声场剧院座位沙盘系统
              </p>
            </div>
          </section>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }
          body * {
            visibility: hidden;
          }
          .print\\:p-0, .print\\:p-0 * {
            visibility: visible;
          }
          .print\\:p-0 {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
