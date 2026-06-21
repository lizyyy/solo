import { useStore } from '@/store'
import type { AlertLevel } from '@/types'
import { AlertTriangle, AlertOctagon, Info, CheckCircle, ArrowRightLeft, Clock, ShieldAlert, FileText } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

const LEVEL_CONFIG: Record<AlertLevel, { bg: string; border: string; text: string; icon: typeof Info }> = {
  info: { bg: 'bg-[#0f3460]/30', border: 'border-[#a8d8ea]/30', text: 'text-[#a8d8ea]', icon: Info },
  notice: { bg: 'bg-yellow-900/20', border: 'border-yellow-500/40', text: 'text-yellow-400', icon: Info },
  warning: { bg: 'bg-orange-900/20', border: 'border-orange-500/40', text: 'text-orange-400', icon: AlertTriangle },
  danger: { bg: 'bg-red-900/20', border: 'border-red-500/40', text: 'text-red-400', icon: AlertOctagon },
}

const PIE_COLORS = ['#0f3460', '#16c79a', '#e94560', '#a8d8ea']

export default function DashboardPage() {
  const batch = useStore((s) => s.batches.find((b) => b.id === s.currentBatchId))
  const batchId = useStore((s) => s.currentBatchId)
  const runCalc = useStore((s) => s.runCalculation)
  const resolveConflict = useStore((s) => s.resolveConflict)

  if (!batchId || !batch) {
    return (
      <div className="flex items-center justify-center h-96 text-[#a8d8ea]/50">
        请先在数据输入页创建或选择一个计算批次
      </div>
    )
  }

  const result = batch.result
  const alerts = batch.alerts
  const suggestions = batch.suggestions
  const conflicts = batch.conflicts

  const pieData = result ? [
    { name: '静扬程', value: result.staticHead },
    { name: '动扬程', value: result.dynamicHead },
    { name: '沿程损失', value: result.frictionLoss },
    { name: '局部损失', value: result.localLoss },
  ] : []

  const handleRun = () => runCalc(batchId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#a8d8ea]">估算看板</h2>
        <button
          onClick={handleRun}
          className="px-4 py-2 rounded-lg bg-[#0f3460] text-[#a8d8ea] text-sm font-medium hover:bg-[#0f3460]/80 transition-colors flex items-center gap-2"
        >
          <ArrowRightLeft size={14} /> 执行计算
        </button>
      </div>

      {!result && (
        <div className="bg-[#16213e] rounded-lg border border-[#0f3460]/60 p-8 text-center">
          <p className="text-[#a8d8ea]/50">请先填写数据后点击"执行计算"</p>
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <ResultCard label="静扬程" value={result.staticHead.toFixed(2)} unit="m" color="#0f3460" />
            <ResultCard label="动扬程" value={result.dynamicHead.toFixed(3)} unit="m" color="#16c79a" />
            <ResultCard label="总管损" value={result.totalLoss.toFixed(2)} unit="m" color="#e94560" />
            <ResultCard label="总扬程" value={result.totalHead.toFixed(2)} unit="m" color="#a8d8ea" highlight />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#16213e] rounded-lg border border-[#0f3460]/60 p-4">
              <h3 className="text-xs text-[#a8d8ea]/70 mb-3">扬程组成分解</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={35} stroke="none">
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1a1a2e', border: '1px solid #0f3460', borderRadius: 8, fontSize: 12, color: '#e2e8f0' }}
                    formatter={(value: number) => [`${value.toFixed(2)} m`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {pieData.map((d, i) => (
                  <span key={d.name} className="text-[10px] text-[#a8d8ea]/60 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: PIE_COLORS[i] }} />
                    {d.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-[#16213e] rounded-lg border border-[#0f3460]/60 p-4">
              <h3 className="text-xs text-[#a8d8ea]/70 mb-3">关键指标</h3>
              <div className="space-y-3">
                <IndicatorBar label="扬程偏差" value={result.headDeviation} max={30} unit="%" invert={result.headDeviation < 0} />
                <IndicatorBar label="管损占比" value={result.lossRatio} max={50} unit="%" />
                <IndicatorBar label="泵效率" value={result.pumpEfficiency} max={100} unit="%" />
              </div>
              <div className="mt-3 pt-3 border-t border-[#0f3460]/30 text-[10px] text-[#a8d8ea]/40 space-y-1">
                <div>雷诺数 Re = {result.reynoldsNumber.toFixed(0)}</div>
                <div>摩擦系数 f = {result.frictionFactor.toFixed(5)}</div>
                <div>公式: {result.formulaUsed}</div>
              </div>
            </div>

            <div className="bg-[#16213e] rounded-lg border border-[#0f3460]/60 p-4">
              <h3 className="text-xs text-[#a8d8ea]/70 mb-3">计算明细</h3>
              <div className="space-y-2 text-xs">
                <DetailRow label="沿程损失 (h_f)" value={result.frictionLoss.toFixed(3)} unit="m" />
                <DetailRow label="局部损失 (h_l)" value={result.localLoss.toFixed(3)} unit="m" />
                <DetailRow label="高程差 (Δz)" value={result.staticHead.toFixed(2)} unit="m" />
                <DetailRow label="压力头差" value={((result.totalHead - result.staticHead - result.dynamicHead - result.totalLoss) || 0).toFixed(3)} unit="m" />
                <DetailRow label="速度头 (v²/2g)" value={result.dynamicHead.toFixed(4)} unit="m" />
                <div className="border-t border-[#0f3460]/30 pt-2 mt-2">
                  <DetailRow label="总扬程 (H)" value={result.totalHead.toFixed(2)} unit="m" bold />
                </div>
              </div>
            </div>
          </div>

          {alerts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs text-[#a8d8ea]/70 flex items-center gap-1">
                <ShieldAlert size={12} /> 阈值提醒
              </h3>
              {alerts.map((a) => {
                const cfg = LEVEL_CONFIG[a.level]
                const Icon = cfg.icon
                return (
                  <div key={a.id} className={`${cfg.bg} border ${cfg.border} rounded-lg px-4 py-3`}>
                    <div className="flex items-start gap-2">
                      <Icon size={16} className={`${cfg.text} mt-0.5 shrink-0`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`${cfg.text} font-medium`}>{a.alertType}</span>
                          <span className="text-[#e2e8f0]">{a.message}</span>
                        </div>
                        <p className="text-[11px] text-[#a8d8ea]/60 mt-1">💡 {a.suggestion}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${cfg.text} ${cfg.bg}`}>
                        {a.level === 'danger' ? '危险' : a.level === 'warning' ? '警告' : a.level === 'notice' ? '注意' : '信息'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs text-[#a8d8ea]/70 flex items-center gap-1">
                <FileText size={12} /> 处理建议
              </h3>
              {suggestions.map((s) => {
                const cfg = LEVEL_CONFIG[s.priority]
                return (
                  <div key={s.id} className="bg-[#16213e] rounded-lg border border-[#0f3460]/40 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] ${cfg.text} ${cfg.bg}`}>{s.category}</span>
                      <div className="flex-1">
                        <p className="text-xs text-[#e2e8f0]">{s.action}</p>
                        <p className="text-[11px] text-[#a8d8ea]/50 mt-1">{s.explanation}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs text-[#e94560] flex items-center gap-1">
                <AlertTriangle size={12} /> 数据冲突
              </h3>
              {conflicts.map((c) => (
                <div key={c.id} className="bg-[#1a1a2e] rounded-lg border border-[#e94560]/30 px-4 py-3">
                  <div className="text-xs text-[#e94560] font-medium mb-2">{c.fieldName} 存在冲突</div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-[#16213e] rounded p-3 border border-[#0f3460]/30">
                      <div className="text-[10px] text-[#a8d8ea]/50 mb-1">设备巡检表</div>
                      <div className="text-sm font-mono text-[#a8d8ea]">{c.inspectionValue}</div>
                    </div>
                    <div className="bg-[#16213e] rounded p-3 border border-[#0f3460]/30">
                      <div className="text-[10px] text-[#a8d8ea]/50 mb-1">传感器导入</div>
                      <div className="text-sm font-mono text-[#16c79a]">{c.importedValue}</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-[#a8d8ea]/50 mb-2">{c.evidence}</div>
                  <div className="text-[11px] text-[#e2e8f0] mb-2">💡 {c.suggestedAction}</div>
                  {!c.resolved ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => resolveConflict(batchId, c.id, 'inspection')}
                        className="px-3 py-1 rounded text-xs bg-[#0f3460] text-[#a8d8ea] hover:bg-[#0f3460]/80"
                      >采用巡检表</button>
                      <button
                        onClick={() => resolveConflict(batchId, c.id, 'imported')}
                        className="px-3 py-1 rounded text-xs bg-[#16c79a]/20 text-[#16c79a] hover:bg-[#16c79a]/30"
                      >采用传感器</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-[#16c79a]">
                      <CheckCircle size={12} /> 已选择采用{c.chosenSide === 'inspection' ? '巡检表' : '传感器'}数据
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="bg-[#16213e] rounded-lg border border-[#0f3460]/30 px-4 py-3">
            <h3 className="text-xs text-[#a8d8ea]/70 flex items-center gap-1 mb-2">
              <Clock size={12} /> 来源追溯
            </h3>
            <div className="grid grid-cols-3 gap-4 text-[11px]">
              <div>
                <span className="text-[#a8d8ea]/40">计算时间：</span>
                <span className="text-[#e2e8f0]">{new Date(result.calcTime).toLocaleString('zh-CN')}</span>
              </div>
              <div>
                <span className="text-[#a8d8ea]/40">批次创建：</span>
                <span className="text-[#e2e8f0]">{new Date(batch.createTime).toLocaleString('zh-CN')}</span>
              </div>
              <div>
                <span className="text-[#a8d8ea]/40">操作人：</span>
                <span className="text-[#e2e8f0]">{batch.operatorName || '未填写'}</span>
              </div>
              <div>
                <span className="text-[#a8d8ea]/40">数据来源：</span>
                <span className="text-[#e2e8f0]">{batch.source}</span>
              </div>
              <div>
                <span className="text-[#a8d8ea]/40">传感器记录：</span>
                <span className="text-[#e2e8f0]">{batch.sensorRecords.length} 条</span>
              </div>
              <div>
                <span className="text-[#a8d8ea]/40">人工修正：</span>
                <span className="text-[#e2e8f0]">{batch.corrections.length} 条</span>
              </div>
              {batch.timeValidation && (batch.timeValidation.message || batch.timeValidation.intervals.length > 0) && (
                <div>
                  <span className="text-[#a8d8ea]/40">采样时间：</span>
                  <span className={batch.timeValidation.valid ? 'text-[#16c79a]' : 'text-[#f08c00]'}>
                    {batch.timeValidation.message || '间隔正常'}
                  </span>
                </div>
              )}
            </div>
            {batch.corrections.length > 0 && (
              <div className="mt-2 pt-2 border-t border-[#0f3460]/20 space-y-1">
                {batch.corrections.map((c) => (
                  <div key={c.id} className="text-[10px] text-[#a8d8ea]/50">
                    {c.fieldName}: {c.originalValue} {c.originalUnit} → {c.correctedValue} {c.correctedUnit}（{c.reason}，{new Date(c.correctionTime).toLocaleString('zh-CN')}）
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ResultCard({ label, value, unit, color, highlight }: { label: string; value: string; unit: string; color: string; highlight?: boolean }) {
  return (
    <div className={`bg-[#16213e] rounded-lg border p-4 ${highlight ? 'border-[#a8d8ea]/40' : 'border-[#0f3460]/60'}`}>
      <div className="text-[11px] text-[#a8d8ea]/60 mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-mono font-bold ${highlight ? 'text-[#a8d8ea]' : ''}`} style={!highlight ? { color } : {}}>
          {value}
        </span>
        <span className="text-[11px] text-[#a8d8ea]/40">{unit}</span>
      </div>
    </div>
  )
}

function IndicatorBar({ label, value, max, unit, invert }: { label: string; value: number; max: number; unit: string; invert?: boolean }) {
  const pct = Math.min(Math.abs(value) / max * 100, 100)
  const color = invert
    ? (Math.abs(value) > 20 ? '#e94560' : Math.abs(value) > 10 ? '#e94560/80' : '#16c79a')
    : (value > 75 ? '#e94560' : value > 50 ? '#e94560/80' : '#16c79a')
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-[#a8d8ea]/60">{label}</span>
        <span className="text-[#e2e8f0] font-mono">{value.toFixed(1)}{unit}</span>
      </div>
      <div className="h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function DetailRow({ label, value, unit, bold }: { label: string; value: string; unit: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-[#a8d8ea]/60 ${bold ? 'font-medium' : ''}`}>{label}</span>
      <span className={`${bold ? 'text-[#a8d8ea] font-bold' : 'text-[#e2e8f0]'} font-mono`}>
        {value} <span className="text-[#a8d8ea]/40">{unit}</span>
      </span>
    </div>
  )
}
