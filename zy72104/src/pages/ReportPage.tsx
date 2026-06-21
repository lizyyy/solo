import { useStore } from '@/store'
import { Download, Clock, User, Tag } from 'lucide-react'

export default function ReportPage() {
  const batch = useStore((s) => s.batches.find((b) => b.id === s.currentBatchId))

  if (!batch || !batch.result) {
    return (
      <div className="flex items-center justify-center h-96 text-[#a8d8ea]/50">
        请先完成计算后再查看报告
      </div>
    )
  }

  const result = batch.result
  const alerts = batch.alerts
  const suggestions = batch.suggestions
  const conflicts = batch.conflicts

  const handleExport = () => {
    const el = document.getElementById('report-content')
    if (!el) return
    const text = generateTextReport(batch)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `水泵扬程管损估算报告_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#a8d8ea]">估算报告</h2>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0f3460] text-[#a8d8ea] text-sm hover:bg-[#0f3460]/80 transition-colors"
        >
          <Download size={14} /> 导出报告
        </button>
      </div>

      <div id="report-content" className="bg-[#16213e] rounded-lg border border-[#0f3460]/60">
        <div className="px-6 py-4 border-b border-[#0f3460]/40">
          <h3 className="text-base font-bold text-[#a8d8ea]">水泵扬程管损估算报告</h3>
          <div className="flex items-center gap-4 mt-2 text-[11px] text-[#a8d8ea]/50">
            <span className="flex items-center gap-1"><Clock size={10} /> {new Date(result.calcTime).toLocaleString('zh-CN')}</span>
            <span className="flex items-center gap-1"><User size={10} /> {batch.operatorName || '未填写'}</span>
            <span className="flex items-center gap-1"><Tag size={10} /> {batch.source}</span>
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">
          <section>
            <h4 className="text-sm font-semibold text-[#a8d8ea] mb-2">一、设备参数</h4>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <ReportField label="泵型号" value={batch.equipmentParams.pumpModel} />
              <ReportField label="额定扬程" value={`${batch.equipmentParams.ratedHead} ${batch.equipmentParams.ratedHeadUnit}`} />
              <ReportField label="额定流量" value={`${batch.equipmentParams.ratedFlow} ${batch.equipmentParams.ratedFlowUnit}`} />
              <ReportField label="管径" value={`${batch.equipmentParams.pipeDiameter} ${batch.equipmentParams.pipeDiameterUnit}`} />
              <ReportField label="管长" value={`${batch.equipmentParams.pipeLength} ${batch.equipmentParams.pipeLengthUnit}`} />
              <ReportField label="粗糙度" value={`${batch.equipmentParams.roughness} mm`} />
              <ReportField label="吸入压力" value={`${batch.equipmentParams.suctionPressure} ${batch.equipmentParams.suctionPressureUnit}`} />
              <ReportField label="排出压力" value={`${batch.equipmentParams.dischargePressure} ${batch.equipmentParams.dischargePressureUnit}`} />
              <ReportField label="高程差" value={`${batch.equipmentParams.elevationDiff} ${batch.equipmentParams.elevationDiffUnit}`} />
              <ReportField label="局部损失系数" value={String(batch.equipmentParams.localLossCoeff)} />
              <ReportField label="流体密度" value={`${batch.equipmentParams.fluidDensity} ${batch.equipmentParams.fluidDensityUnit}`} />
              <ReportField label="泵效率(输入)" value={`${batch.equipmentParams.efficiency}%`} />
            </div>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-[#a8d8ea] mb-2">二、计算结果</h4>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <ReportField label="静扬程" value={`${result.staticHead.toFixed(2)} m`} highlight />
              <ReportField label="动扬程" value={`${result.dynamicHead.toFixed(4)} m`} />
              <ReportField label="沿程损失" value={`${result.frictionLoss.toFixed(3)} m`} />
              <ReportField label="局部损失" value={`${result.localLoss.toFixed(3)} m`} />
              <ReportField label="总管损" value={`${result.totalLoss.toFixed(2)} m`} highlight />
              <ReportField label="总扬程" value={`${result.totalHead.toFixed(2)} m`} highlight bold />
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs mt-2">
              <ReportField label="扬程偏差" value={`${result.headDeviation.toFixed(1)}%`} warn={Math.abs(result.headDeviation) > 10} />
              <ReportField label="管损占比" value={`${result.lossRatio.toFixed(1)}%`} warn={result.lossRatio > 25} />
              <ReportField label="泵效率" value={`${result.pumpEfficiency.toFixed(1)}%`} warn={result.pumpEfficiency < 60} />
            </div>
            <div className="text-[11px] text-[#a8d8ea]/40 mt-2">
              公式：{result.formulaUsed} | 雷诺数 Re = {result.reynoldsNumber.toFixed(0)} | 摩擦系数 f = {result.frictionFactor.toFixed(5)}
            </div>
          </section>

          {batch.corrections.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-[#a8d8ea] mb-2">三、人工修正记录</h4>
              <div className="space-y-1">
                {batch.corrections.map((c) => (
                  <div key={c.id} className="text-xs text-[#e2e8f0] flex items-center gap-2">
                    <span className="text-[#a8d8ea]/60">{c.fieldName}:</span>
                    <span className="text-[#e94560]/70 line-through">{c.originalValue} {c.originalUnit}</span>
                    <span className="text-[#a8d8ea]/40">→</span>
                    <span className="text-[#16c79a]">{c.correctedValue} {c.correctedUnit}</span>
                    <span className="text-[#a8d8ea]/40">（{c.reason}）</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {batch.timeValidation && (batch.timeValidation.message || batch.timeValidation.intervals.length > 0) && (
            <section>
              <h4 className="text-sm font-semibold text-[#a8d8ea] mb-2">
                （附）采样时间间隔校验
              </h4>
              <div className={`text-xs px-3 py-2 rounded border ${
                batch.timeValidation.valid
                  ? 'bg-[#0f3460]/20 border-[#0f3460]/30 text-[#a8d8ea]/70'
                  : 'bg-yellow-900/20 border-yellow-500/40 text-yellow-400'
              }`}>
                {batch.timeValidation.message || '采样间隔正常'}
                {batch.timeValidation.intervals.length > 0 && (
                  <div className="mt-1 font-mono opacity-80">
                    相邻间隔（秒）: {batch.timeValidation.intervals.map((s) => s.toFixed(0)).join(' / ')}
                  </div>
                )}
              </div>
            </section>
          )}

          {alerts.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-[#a8d8ea] mb-2">{batch.corrections.length > 0 ? '四' : '三'}、阈值提醒</h4>
              <div className="space-y-2">
                {alerts.map((a) => (
                  <div key={a.id} className={`text-xs px-3 py-2 rounded border ${
                    a.level === 'danger' ? 'bg-red-900/20 border-red-500/30 text-red-400' :
                    a.level === 'warning' ? 'bg-orange-900/20 border-orange-500/30 text-orange-400' :
                    'bg-yellow-900/20 border-yellow-500/30 text-yellow-400'
                  }`}>
                    <span className="font-medium">[{a.alertType}]</span> {a.message}
                    <div className="mt-1 opacity-80">💡 {a.suggestion}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {suggestions.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-[#a8d8ea] mb-2">
                {batch.corrections.length > 0 ? (alerts.length > 0 ? '五' : '四') : (alerts.length > 0 ? '四' : '三')}、处理建议
              </h4>
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <div key={s.id} className="text-xs bg-[#1a1a2e] rounded border border-[#0f3460]/30 px-3 py-2">
                    <span className="text-[#a8d8ea] font-medium">{s.category}：</span>
                    <span className="text-[#e2e8f0]">{s.action}</span>
                    <div className="text-[#a8d8ea]/50 mt-1">{s.explanation}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {conflicts.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-[#a8d8ea] mb-2">六、数据冲突</h4>
              <div className="space-y-2">
                {conflicts.map((c) => (
                  <div key={c.id} className="text-xs bg-[#1a1a2e] rounded border border-[#e94560]/30 px-3 py-2">
                    <div className="text-[#e94560] font-medium mb-1">{c.fieldName} 存在冲突</div>
                    <div className="grid grid-cols-2 gap-2 mb-1">
                      <div>巡检表: <span className="font-mono text-[#a8d8ea]">{c.inspectionValue}</span></div>
                      <div>传感器: <span className="font-mono text-[#16c79a]">{c.importedValue}</span></div>
                    </div>
                    <div className="text-[#a8d8ea]/60">{c.evidence}</div>
                    <div className="mt-1">
                      {c.resolved
                        ? <span className="text-[#16c79a]">✓ 已采用{c.chosenSide === 'inspection' ? '巡检表' : '传感器'}数据</span>
                        : <span className="text-[#e94560]/80">⚠ 未解决</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {batch.fieldNotes.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-[#a8d8ea] mb-2">七、现场备注（原始保留）</h4>
              <div className="space-y-1">
                {batch.fieldNotes.map((n) => (
                  <div key={n.id} className="text-xs text-[#e2e8f0] bg-[#1a1a2e] rounded px-3 py-1.5">
                    <span className="text-[#a8d8ea]/40">[{new Date(n.noteTime).toLocaleString('zh-CN')} {n.author}]</span> {n.content}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h4 className="text-sm font-semibold text-[#a8d8ea] mb-2">八、传感器原始数据</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#0f3460]/40 text-[#a8d8ea]/60">
                    <th className="py-1.5 px-2 text-left">参数</th>
                    <th className="py-1.5 px-2 text-left">原始值</th>
                    <th className="py-1.5 px-2 text-left">单位</th>
                    <th className="py-1.5 px-2 text-left">SI标准值</th>
                    <th className="py-1.5 px-2 text-left">时间</th>
                    <th className="py-1.5 px-2 text-left">方向</th>
                    <th className="py-1.5 px-2 text-left">来源</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.sensorRecords.map((r) => (
                    <tr key={r.id} className="border-b border-[#0f3460]/20">
                      <td className="py-1 px-2 text-[#e2e8f0]">{r.parameterName}</td>
                      <td className="py-1 px-2 font-mono text-[#a8d8ea]">{r.rawValue}</td>
                      <td className="py-1 px-2 text-[#a8d8ea]/60">{r.rawUnit}</td>
                      <td className="py-1 px-2 font-mono text-[#16c79a]">{r.standardValue?.toExponential(3)} {r.standardUnit}</td>
                      <td className="py-1 px-2 text-[#a8d8ea]/40">{new Date(r.timestamp).toLocaleString('zh-CN')}</td>
                      <td className="py-1 px-2 text-[#a8d8ea]/40">{r.direction || '-'}</td>
                      <td className="py-1 px-2 text-[#a8d8ea]/40">{r.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="border-t border-[#0f3460]/40 pt-3 text-[10px] text-[#a8d8ea]/30 flex items-center justify-between">
            <span>报告生成时间：{new Date().toLocaleString('zh-CN')}</span>
            <span>批次ID：{batch.id}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReportField({ label, value, highlight, bold, warn }: { label: string; value: string; highlight?: boolean; bold?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 px-2 rounded bg-[#1a1a2e]/60">
      <span className="text-[#a8d8ea]/60">{label}</span>
      <span className={`font-mono ${bold ? 'font-bold' : ''} ${warn ? 'text-[#e94560]' : highlight ? 'text-[#a8d8ea]' : 'text-[#e2e8f0]'}`}>
        {value}
      </span>
    </div>
  )
}

function generateTextReport(batch: ReturnType<typeof useStore.getState>['batches'][0]): string {
  const r = batch.result!
  const lines: string[] = []
  lines.push('=' .repeat(60))
  lines.push('水泵扬程管损估算报告')
  lines.push('='.repeat(60))
  lines.push(`计算时间：${new Date(r.calcTime).toLocaleString('zh-CN')}`)
  lines.push(`操作人：${batch.operatorName}`)
  lines.push(`数据来源：${batch.source}`)
  lines.push('')
  lines.push('一、设备参数')
  lines.push('-'.repeat(40))
  lines.push(`泵型号：${batch.equipmentParams.pumpModel}`)
  lines.push(`额定扬程：${batch.equipmentParams.ratedHead} ${batch.equipmentParams.ratedHeadUnit}`)
  lines.push(`额定流量：${batch.equipmentParams.ratedFlow} ${batch.equipmentParams.ratedFlowUnit}`)
  lines.push(`管径：${batch.equipmentParams.pipeDiameter} ${batch.equipmentParams.pipeDiameterUnit}`)
  lines.push(`管长：${batch.equipmentParams.pipeLength} ${batch.equipmentParams.pipeLengthUnit}`)
  lines.push(`吸入压力：${batch.equipmentParams.suctionPressure} ${batch.equipmentParams.suctionPressureUnit}`)
  lines.push(`排出压力：${batch.equipmentParams.dischargePressure} ${batch.equipmentParams.dischargePressureUnit}`)
  lines.push('')
  lines.push('二、计算结果')
  lines.push('-'.repeat(40))
  lines.push(`静扬程：${r.staticHead.toFixed(2)} m`)
  lines.push(`动扬程：${r.dynamicHead.toFixed(4)} m`)
  lines.push(`沿程损失：${r.frictionLoss.toFixed(3)} m`)
  lines.push(`局部损失：${r.localLoss.toFixed(3)} m`)
  lines.push(`总管损：${r.totalLoss.toFixed(2)} m`)
  lines.push(`总扬程：${r.totalHead.toFixed(2)} m`)
  lines.push(`扬程偏差：${r.headDeviation.toFixed(1)}%`)
  lines.push(`管损占比：${r.lossRatio.toFixed(1)}%`)
  lines.push(`泵效率：${r.pumpEfficiency.toFixed(1)}%`)
  lines.push(`公式：${r.formulaUsed}`)
  lines.push(`雷诺数 Re = ${r.reynoldsNumber.toFixed(0)}`)
  lines.push(`摩擦系数 f = ${r.frictionFactor.toFixed(5)}`)
  lines.push('')

  if (batch.timeValidation && (batch.timeValidation.message || batch.timeValidation.intervals.length > 0)) {
    lines.push('（附）采样时间间隔校验')
    lines.push('-'.repeat(40))
    lines.push(batch.timeValidation.message || '采样间隔正常')
    if (batch.timeValidation.intervals.length > 0) {
      lines.push(`相邻间隔（秒）: ${batch.timeValidation.intervals.map((s) => s.toFixed(0)).join(' / ')}`)
    }
    lines.push('')
  }

  if (batch.alerts.length > 0) {
    lines.push('三、阈值提醒')
    lines.push('-'.repeat(40))
    batch.alerts.forEach((a) => {
      lines.push(`[${a.alertType}] ${a.message}`)
      lines.push(`  建议：${a.suggestion}`)
    })
    lines.push('')
  }

  if (batch.suggestions.length > 0) {
    lines.push('四、处理建议')
    lines.push('-'.repeat(40))
    batch.suggestions.forEach((s) => {
      lines.push(`[${s.category}] ${s.action}`)
      lines.push(`  说明：${s.explanation}`)
    })
    lines.push('')
  }

  if (batch.corrections.length > 0) {
    lines.push('五、人工修正记录')
    lines.push('-'.repeat(40))
    batch.corrections.forEach((c) => {
      lines.push(`${c.fieldName}: ${c.originalValue} ${c.originalUnit} → ${c.correctedValue} ${c.correctedUnit}（${c.reason}）`)
    })
    lines.push('')
  }

  if (batch.fieldNotes.length > 0) {
    lines.push('六、现场备注（原始保留）')
    lines.push('-'.repeat(40))
    batch.fieldNotes.forEach((n) => {
      lines.push(`[${new Date(n.noteTime).toLocaleString('zh-CN')} ${n.author}] ${n.content}`)
    })
    lines.push('')
  }

  if (batch.conflicts.length > 0) {
    lines.push('七、数据冲突')
    lines.push('-'.repeat(40))
    batch.conflicts.forEach((c) => {
      lines.push(`${c.fieldName}: 巡检表=${c.inspectionValue}, 传感器=${c.importedValue}`)
      lines.push(`  ${c.evidence}`)
      lines.push(`  ${c.resolved ? `已采用${c.chosenSide === 'inspection' ? '巡检表' : '传感器'}` : '未解决'}`)
    })
    lines.push('')
  }

  lines.push('='.repeat(60))
  lines.push(`报告生成时间：${new Date().toLocaleString('zh-CN')}`)
  lines.push(`批次ID：${batch.id}`)
  return lines.join('\n')
}
