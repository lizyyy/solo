import { useEffect, useState } from 'react'
import { useAppStore } from '@/hooks/useAppStore'
import { api } from '@/utils/api'
import type { EstimationWarning, TraceLink } from '../../shared/types'
import {
  FileText, Play, CheckCircle, AlertTriangle, Link2, Download,
  ArrowLeftRight, ChevronDown, ChevronUp, X
} from 'lucide-react'

interface CarParam { id: string; car_name: string }
interface TrackParam { id: string; slope_percent: number; slope_direction: string; gear_ratio: number }
interface LightRecord { id: string; time_slot: string; intensity_wm2: number }
interface Estimation {
  id: string; car_params_id: string; track_params_id: string;
  light_record_ids: string[]; available_power_w: number;
  slope_resistance_n: number; rolling_resistance_n: number;
  aero_resistance_n: number; total_resistance_n: number;
  net_force_n: number; estimated_time_s: number;
  warnings: EstimationWarning[]; status: string; created_at: string;
  vehicle_speed_ms?: number; effective_power_w?: number;
}

interface TraceData {
  report: Estimation; car: CarParam; track: TrackParam;
  lights: LightRecord[]; trace: TraceLink[];
}

interface CompareRow {
  field: string; value_a: any; value_b: any;
  diff: number; percent_change: number; significant: boolean;
}

export default function Estimation() {
  const { currentProjectId, showToast } = useAppStore()
  const [cars, setCars] = useState<CarParam[]>([])
  const [tracks, setTracks] = useState<TrackParam[]>([])
  const [lights, setLights] = useState<LightRecord[]>([])
  const [reports, setReports] = useState<Estimation[]>([])

  const [selectedCar, setSelectedCar] = useState('')
  const [selectedTrack, setSelectedTrack] = useState('')
  const [selectedLights, setSelectedLights] = useState<string[]>([])

  const [traceData, setTraceData] = useState<TraceData | null>(null)
  const [traceReportId, setTraceReportId] = useState<string | null>(null)

  const [compareA, setCompareA] = useState('')
  const [compareB, setCompareB] = useState('')
  const [compareResult, setCompareResult] = useState<{ report_a: Estimation; report_b: Estimation; comparison: CompareRow[] } | null>(null)

  useEffect(() => {
    if (currentProjectId) loadAll()
  }, [currentProjectId])

  async function loadAll() {
    try {
      const [carsRes, tracksRes, lightsRes, estRes] = await Promise.all([
        api.carParams.list(currentProjectId!),
        api.trackParams.list(currentProjectId!),
        api.lightRecords.list(currentProjectId!),
        api.estimations.list(currentProjectId!),
      ])
      setCars(carsRes.data || [])
      setTracks(tracksRes.data || [])
      setLights(lightsRes.data || [])
      setReports(estRes.data || [])
    } catch { showToast('加载数据失败', 'error') }
  }

  async function runEstimation() {
    if (!selectedCar || !selectedTrack) {
      showToast('请选择小车参数和赛道参数', 'error')
      return
    }
    try {
      await api.estimations.run({
        project_id: currentProjectId,
        car_params_id: selectedCar,
        track_params_id: selectedTrack,
        light_record_ids: selectedLights.length > 0 ? selectedLights : undefined,
      })
      await loadAll()
      showToast('估算完成')
    } catch (e: any) { showToast(e.message || '估算失败', 'error') }
  }

  async function confirmReport(id: string) {
    try {
      await api.estimations.confirm(id)
      await loadAll()
      showToast('已确认')
    } catch { showToast('确认失败', 'error') }
  }

  async function showTrace(id: string) {
    try {
      const res = await api.estimations.trace(id)
      setTraceData(res.data)
      setTraceReportId(id)
    } catch { showToast('加载追溯链失败', 'error') }
  }

  function handleExport(id: string) {
    window.open(api.estimations.exportUrl(id), '_blank')
    showToast('正在导出CSV…')
  }

  async function runCompare() {
    if (!compareA || !compareB) return
    try {
      const res = await api.estimations.compare(compareA, compareB)
      setCompareResult(res.data)
    } catch { showToast('对比失败', 'error') }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">估算报告</h1>
        <p className="text-sm text-slate-400 mt-1">功率估算、阻力修正、时间预测、参数对比与全链路追溯</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-4">运行估算</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">选择小车参数</label>
            <select value={selectedCar} onChange={e => setSelectedCar(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50">
              <option value="">-- 选择 --</option>
              {cars.map(c => <option key={c.id} value={c.id}>{c.car_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">选择赛道参数</label>
            <select value={selectedTrack} onChange={e => setSelectedTrack(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50">
              <option value="">-- 选择 --</option>
              {tracks.map(t => <option key={t.id} value={t.id}>坡度{t.slope_percent}% / 齿轮比{t.gear_ratio}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">选择光照记录(可选)</label>
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm max-h-24 overflow-y-auto space-y-1">
              {lights.map(l => (
                <label key={l.id} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selectedLights.includes(l.id)}
                    onChange={e => setSelectedLights(e.target.checked ? [...selectedLights, l.id] : selectedLights.filter(i => i !== l.id))}
                    className="accent-amber-500" />
                  <span>{l.time_slot}: {l.intensity_wm2} W/m²</span>
                </label>
              ))}
              {lights.length === 0 && <span className="text-slate-500">暂无记录</span>}
            </div>
          </div>
        </div>
        <button onClick={runEstimation} className="mt-4 px-4 py-2 bg-amber-500 text-slate-900 rounded-lg text-sm font-medium hover:bg-amber-400 transition-colors flex items-center gap-1.5">
          <Play className="w-4 h-4" /> 运行估算
        </button>
      </div>

      {reports.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">参数对比</h2>
            <button onClick={runCompare} disabled={!compareA || !compareB}
              className="px-3 py-1.5 bg-slate-700 rounded-lg text-xs font-medium hover:bg-slate-600 transition-colors disabled:opacity-50 flex items-center gap-1.5">
              <ArrowLeftRight className="w-3.5 h-3.5" /> 对比
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">方案 A</label>
              <select value={compareA} onChange={e => setCompareA(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50">
                <option value="">-- 选择 --</option>
                {reports.map((r, i) => <option key={r.id} value={r.id}>报告 {i + 1} ({r.estimated_time_s === -1 ? '无法完赛' : `${r.estimated_time_s.toFixed(2)}s`})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">方案 B</label>
              <select value={compareB} onChange={e => setCompareB(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50">
                <option value="">-- 选择 --</option>
                {reports.map((r, i) => <option key={r.id} value={r.id}>报告 {i + 1} ({r.estimated_time_s === -1 ? '无法完赛' : `${r.estimated_time_s.toFixed(2)}s`})</option>)}
              </select>
            </div>
          </div>
          {compareResult && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700/50 text-slate-400">
                    <th className="text-left px-3 py-2">参数</th>
                    <th className="text-right px-3 py-2">方案A</th>
                    <th className="text-right px-3 py-2">方案B</th>
                    <th className="text-right px-3 py-2">差值</th>
                  </tr>
                </thead>
                <tbody>
                  {compareResult.comparison.map((row, i) => (
                    <tr key={i} className={`border-b border-slate-700/30 ${row.significant ? 'bg-orange-500/10' : ''}`}>
                      <td className="px-3 py-2">{row.field}</td>
                      <td className="px-3 py-2 text-right">{typeof row.value_a === 'number' ? row.value_a.toFixed(4) : row.value_a}</td>
                      <td className="px-3 py-2 text-right">{typeof row.value_b === 'number' ? row.value_b.toFixed(4) : row.value_b}</td>
                      <td className={`px-3 py-2 text-right ${row.significant ? 'text-orange-400 font-medium' : ''}`}>
                        {typeof row.diff === 'number' ? row.diff.toFixed(4) : row.diff}
                        {row.percent_change !== 0 && typeof row.percent_change === 'number' && <span className="text-slate-500 ml-1">({row.percent_change.toFixed(1)}%)</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        {reports.map((report, idx) => {
          const isTraceOpen = traceReportId === report.id
          return (
            <div key={report.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium">估算报告 {idx + 1}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${report.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {report.status === 'confirmed' ? '已确认' : '待确认'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => confirmReport(report.id)} disabled={report.status === 'confirmed'}
                      className="p-1.5 rounded-md hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 transition-colors disabled:opacity-50" title="确认">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button onClick={() => showTrace(report.id)} className="p-1.5 rounded-md hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 transition-colors" title="追溯">
                      {isTraceOpen ? <ChevronUp className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleExport(report.id)} className="p-1.5 rounded-md hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition-colors" title="导出CSV">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <ResultCard label="可用功率" value={`${report.available_power_w.toFixed(4)} W`} warn={report.available_power_w < 0.5} />
                  <ResultCard label="总阻力" value={`${report.total_resistance_n.toFixed(4)} N`} warn={report.total_resistance_n > 1} />
                  <ResultCard label="净力" value={`${report.net_force_n.toFixed(4)} N`} warn={report.net_force_n <= 0} />
                  <ResultCard label="预估时间" value={report.estimated_time_s === -1 ? '无法完赛' : `${report.estimated_time_s.toFixed(2)} s`} warn={report.estimated_time_s === -1} />
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4 text-xs text-slate-400">
                  <div className="bg-slate-900/30 rounded-lg p-2">
                    <p>坡度阻力: {report.slope_resistance_n.toFixed(4)} N</p>
                  </div>
                  <div className="bg-slate-900/30 rounded-lg p-2">
                    <p>滚动阻力: {report.rolling_resistance_n.toFixed(4)} N</p>
                  </div>
                  <div className="bg-slate-900/30 rounded-lg p-2">
                    <p>空气阻力: {report.aero_resistance_n.toFixed(4)} N</p>
                  </div>
                </div>

                {report.warnings?.length > 0 && (
                  <div className="space-y-2">
                    {report.warnings.map((w, i) => {
                      const borderClass = w.type === 'power_insufficient' || w.type === 'light_gap' ? 'border-red-500/50 bg-red-500/10'
                        : w.type === 'slope_direction_reversed' ? 'border-orange-500/50 bg-orange-500/10'
                        : 'border-yellow-500/50 bg-yellow-500/10'
                      return (
                        <div key={i} className={`border-l-4 ${borderClass} rounded-r-lg p-3`}>
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-medium">{w.message}</p>
                              <p className="text-xs text-slate-300 mt-0.5">💰 {w.business_impact}</p>
                              {w.source_ids?.length > 0 && (
                                <p className="text-xs text-slate-500 mt-0.5">来源: {w.source_ids.join(', ')}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {isTraceOpen && traceData && traceReportId === report.id && (
                <div className="border-t border-slate-700/50 bg-slate-900/30 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-amber-400" /> 追溯链路
                    </h3>
                    <button onClick={() => { setTraceReportId(null); setTraceData(null) }}
                      className="p-1 rounded-md hover:bg-slate-700/50 text-slate-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {traceData.trace.map((t, i) => (
                      <div key={i} className="bg-slate-800/80 rounded-lg p-3 border border-slate-700/30">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-400">{i + 1}</div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{t.field}</span>
                              <span className="text-sm text-amber-400 font-mono">{typeof t.value === 'number' ? t.value.toFixed(4) : t.value}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">{t.source_label}</p>
                            <p className="text-xs text-slate-500 mt-0.5">来源ID: {t.source_id}</p>
                            <p className="text-xs text-slate-500">{t.source_detail}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {reports.length === 0 && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8 text-center text-slate-500">
            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            暂无估算报告，请先选择参数并运行估算
          </div>
        )}
      </div>
    </div>
  )
}

function ResultCard({ label, value, warn }: { label: string; value: string; warn: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${warn ? 'bg-red-500/10 border border-red-500/30' : 'bg-slate-900/30'}`}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${warn ? 'text-red-400' : ''}`}>{value}</p>
    </div>
  )
}
