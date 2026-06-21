import React, { useMemo, useState, useEffect } from 'react'
import { X, Check } from 'lucide-react'
import { useStationStore } from '@/store/stationStore'

const calcHourDiff = (a: string, b: string): number => {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime())
  return Math.round((ms / (1000 * 60 * 60)) * 10) / 10
}

const formatDateTime = (iso: string): string => {
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate(),
    )} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  } catch {
    return iso
  }
}

const FieldRow: React.FC<{
  label: string
  children: React.ReactNode
  highlight?: 'danger' | 'warn' | 'teal'
}> = ({ label, children, highlight }) => {
  const labelColor =
    highlight === 'danger'
      ? 'text-alert-red'
      : highlight === 'warn'
      ? 'text-alert-yellow'
      : highlight === 'teal'
      ? 'text-teal-glow'
      : 'text-deepsea-200/80'
  return (
    <div className="py-2 border-b border-deepsea-600/30 last:border-0">
      <div className={`text-[11px] uppercase tracking-wider mb-1 ${labelColor}`}>
        {label}
      </div>
      <div className="font-mono text-[12.5px] leading-relaxed break-all text-deepsea-50">
        {children}
      </div>
    </div>
  )
}

const StationDetail: React.FC = () => {
  const { selectedId, records, selectStation, updateRemark } = useStationStore()
  const [remarkText, setRemarkText] = useState('')
  const [saved, setSaved] = useState(false)

  const record = useMemo(
    () => records.find((r) => r.id === selectedId) || null,
    [records, selectedId],
  )

  useEffect(() => {
    if (record) {
      setRemarkText(record.remark || '')
      setSaved(false)
    }
  }, [record])

  if (!record) return null

  const hourDiff = calcHourDiff(record.sampling_time, record.expected_time)
  const isNewRecord = record.status !== '原始'

  const handleSave = () => {
    updateRemark(record.id, remarkText)
    setSaved(true)
    setTimeout(() => setSaved(false), 4000)
  }

  const handleMaskClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) selectStation(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={handleMaskClick}
    >
      <div className="glass-strong max-w-5xl w-[92%] max-h-[85vh] rounded-2xl overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.55)] flex flex-col border border-deepsea-400/40">
        <div className="flex items-center justify-between px-6 py-4 border-b border-deepsea-500/40 bg-deepsea-800/40">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono font-bold text-[16px] text-teal-glow shrink-0 drop-shadow-[0_0_6px_rgba(0,212,170,0.55)]">
              {record.station_code}
            </span>
            <span className="text-[16px] font-display font-semibold text-deepsea-50 truncate">
              {record.station_name}
            </span>
            {isNewRecord && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-teal-glow/15 text-teal-glow border border-teal-glow/40 tracking-wide">
                REV · {record.batch_id.slice(-10)}
              </span>
            )}
          </div>
          <button
            onClick={() => selectStation(null)}
            className="p-2 rounded-lg text-deepsea-200/80 hover:text-deepsea-50 hover:bg-deepsea-600/50 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          <div className="lg:w-[60%] overflow-y-auto p-6 bg-deepsea-900/40 border-r border-deepsea-600/30">
            <h2 className="text-[12px] uppercase tracking-widest text-deepsea-200/60 mb-4 font-display">
              原始数据展示 · 脏数据原样保留
            </h2>

            <div className="bg-deepsea-950/60 rounded-xl p-4 border border-deepsea-600/40 font-mono">
              <FieldRow label="空间位置 · Lng / Lat">
                <span className="text-teal-glow/90">
                  {record.lng.toFixed(4)}°E
                </span>
                <span className="text-deepsea-300/60 mx-2">/</span>
                <span className="text-teal-glow/90">
                  {record.lat.toFixed(4)}°N
                </span>
              </FieldRow>

              <FieldRow
                label="采样时间"
                highlight={record.time_conflict ? 'danger' : undefined}
              >
                <div
                  className={
                    record.time_conflict
                      ? 'inline-block border-b-2 border-dashed border-alert-red pb-0.5'
                      : undefined
                  }
                >
                  {formatDateTime(record.sampling_time)}
                </div>
                {record.time_conflict && (
                  <div className="mt-1 text-[11px] text-alert-red/95 leading-snug pl-1">
                    ⚠️ 与遥感预期 {formatDateTime(record.expected_time)} 差{' '}
                    <span className="font-semibold">{hourDiff} 小时</span>
                  </div>
                )}
              </FieldRow>

              <FieldRow label="遥感截图来源" highlight="teal">
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="text-teal-glow underline underline-offset-2 decoration-teal-glow/60 hover:decoration-teal-glow"
                >
                  {record.remote_sensing_source}
                </a>
                <div className="text-[11px] text-deepsea-300/70 mt-1">
                  来源行号：<span>{record.source_line}</span>
                </div>
              </FieldRow>

              <FieldRow label="截图编号">
                <span className="text-deepsea-100">{record.screenshot_id}</span>
              </FieldRow>

              <FieldRow
                label="实验结果"
                highlight={record.result_abnormal ? 'danger' : undefined}
              >
                <div
                  className={
                    record.result_abnormal
                      ? 'inline-block border-b-2 border-dashed border-alert-red pb-0.5'
                      : undefined
                  }
                >
                  {record.experiment_result}
                </div>
                {record.result_abnormal && (
                  <div className="mt-1 text-[11px] text-alert-red/95 leading-snug pl-1">
                    ⚠️ 超阈值 [
                    <span className="font-semibold">{record.threshold_min}</span>,{' '}
                    <span className="font-semibold">{record.threshold_max}</span>
                    ] 区间 · 实际值{' '}
                    <span className="font-semibold text-coral-glow">
                      {record.result_value}
                    </span>
                  </div>
                )}
              </FieldRow>

              <FieldRow label="异常原因（脏数据保留）">
                <div className="bg-deepsea-900/80 rounded-lg px-3 py-2 border border-deepsea-600/40 text-deepsea-200/85">
                  {record.anomaly_reason || (
                    <span className="text-deepsea-400/60 italic">
                      — 无原始备注 —
                    </span>
                  )}
                </div>
              </FieldRow>

              <FieldRow label="云遮挡影响" highlight={record.cloud_impact === '严重' ? 'warn' : record.cloud_impact === '部分' ? 'warn' : undefined}>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${
                      record.cloud_impact === '严重'
                        ? 'bg-alert-gray/20 text-alert-gray border border-alert-gray/40'
                        : record.cloud_impact === '部分'
                        ? 'bg-alert-yellow/15 text-alert-yellow border border-alert-yellow/40'
                        : 'bg-alert-green/15 text-alert-green border border-alert-green/40'
                    }`}
                  >
                    {record.cloud_impact === '无'
                      ? '☁️ 无云遮挡'
                      : record.cloud_impact === '严重'
                      ? '☁️☁️ 云遮严重'
                      : '☁️ 部分云遮'}
                  </span>
                </div>
                <div className="text-[11px] text-deepsea-300/75 mt-1.5 leading-relaxed">
                  {record.cloud_area_desc}
                </div>
              </FieldRow>

              <FieldRow label="批次 / 状态">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-deepsea-500/30 text-deepsea-100 border border-deepsea-400/40">
                    {record.batch_id}
                  </span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-md ${
                      record.status === '已核对'
                        ? 'bg-alert-green/20 text-alert-green border border-alert-green/40'
                        : record.status === '已修正'
                        ? 'bg-alert-yellow/20 text-alert-yellow border border-alert-yellow/40'
                        : 'bg-deepsea-400/25 text-deepsea-100 border border-deepsea-400/40'
                    }`}
                  >
                    状态：{record.status}
                  </span>
                </div>
                {record.derived_from && (
                  <div className="text-[11px] text-teal-glow/90 mt-1.5">
                    🔗 追溯原始ID：<span>{record.derived_from}</span>
                  </div>
                )}
              </FieldRow>

              <FieldRow label="最后更新时间">
                <span className="text-deepsea-100/90">
                  {formatDateTime(record.updated_at)}
                </span>
              </FieldRow>
            </div>
          </div>

          <div className="lg:w-[40%] flex flex-col p-6 overflow-y-auto">
            <h2 className="text-[15px] font-display font-semibold text-teal-glow drop-shadow-[0_0_6px_rgba(0,212,170,0.5)] mb-2">
              人工备注
            </h2>
            <p className="text-[11px] text-deepsea-300/70 mb-4 leading-relaxed">
              用于补充人工核验结论、排除说明、修正说明等。保存后系统将生成新批次副本，原始记录保留不变。
            </p>

            <textarea
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              placeholder="请输入人工备注（例如：已电话确认夜班误填报；建议排除该条云遮记录……）"
              className="input-glow w-full resize-none rounded-xl px-4 py-3 text-[13px] leading-relaxed min-h-[140px]"
              style={{ height: 140 }}
            />

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleSave}
                className="btn-teal-glow inline-flex items-center gap-2 px-5 h-10 rounded-lg text-[13px]"
              >
                <Check size={16} />
                保存备注
              </button>

              {saved && (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-alert-green animate-pulse">
                  <Check size={14} />
                  已保存为新版本（状态：已核对，新批次号）
                </span>
              )}
            </div>

            <div className="mt-auto pt-6 mt-6 border-t border-deepsea-600/30">
              <p className="text-[11px] text-deepsea-300/75 leading-relaxed">
                💡 <span className="text-teal-glow/90 font-medium">提示：</span>
                原始记录会完整保留，系统自动生成一条新批次记录副本以保证溯源。导出时将同时包含新旧版本及差异清单。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StationDetail
