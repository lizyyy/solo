import { useState } from 'react';
import { useStore } from '@/store';
import { DataCleaner } from '@/utils/dataCleaner';
import { FileText, Download, Clock, Link, AlertOctagon } from 'lucide-react';

const SEV: Record<string, { l: string; c: string }> = { low: { l: '低', c: 'status-badge-normal' }, medium: { l: '中', c: 'status-badge-old' }, high: { l: '高', c: 'status-badge-pending' }, critical: { l: '严重', c: 'status-badge-extreme' } };
const CFM: Record<string, { l: string; c: string }> = { pending: { l: '待确认', c: 'status-badge-pending' }, confirmed: { l: '已确认', c: 'status-badge-extreme' }, rejected: { l: '已驳回', c: 'status-badge-normal' } };
const RS: Record<string, { l: string; c: string }> = { normal: { l: '正常', c: 'status-badge-normal' }, pending: { l: '待确认', c: 'status-badge-pending' }, old_caliber: { l: '旧口径', c: 'status-badge-old' }, extreme: { l: '极端值', c: 'status-badge-extreme' } };

export default function Report() {
  const currentBatch = useStore(s => s.currentBatch);
  const exportReport = useStore(s => s.exportReport);
  const [genTime] = useState(() => new Date().toLocaleString('zh-CN'));

  if (!currentBatch) return <div className="flex items-center justify-center h-64 text-industrial-400 font-mono text-sm">请先选择或创建批次</div>;

  const b = currentBatch;
  const clean = b.records.filter(r => r.dataStatus === 'clean').length;
  const miss = b.records.filter(r => r.dataStatus === 'missing').length;
  const unit = b.records.filter(r => r.dataStatus === 'unit_mismatch').length;
  const expectedInterval = b.thresholds?.expectedIntervalMinutes ?? 30;
  const gapResult = b.records.length >= 2 ? DataCleaner.detectGaps(b.records, expectedInterval) : { gaps: [] };
  const gapCount = gapResult.gaps.length;
  const nonExt = b.calculationResults.filter(r => !b.records.find(rec => rec.id === r.recordId && rec.recordStatus === 'extreme'));
  const rMean = nonExt.length > 0 ? nonExt.reduce((s, r) => s + r.totalLoad, 0) / nonExt.length : 0;
  const mLoad = b.calculationResults.length > 0 ? Math.max(...b.calculationResults.map(r => r.totalLoad)) : 0;

  const handleExport = (fmt: 'markdown' | 'pdf') => {
    const blob = exportReport(b.id, fmt);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${b.name}_报告.${fmt === 'markdown' ? 'md' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary-600" /><h2 className="text-xl font-bold">诊断报告</h2>
          <span className="text-xs text-industrial-400 font-mono flex items-center gap-1"><Clock size={12} />{genTime}</span>
        </div>
        <div className="flex gap-2">
          <button className="industrial-btn flex items-center gap-1" onClick={() => handleExport('markdown')}><Download size={14} />导出Markdown</button>
          <button className="industrial-btn-primary flex items-center gap-1" onClick={() => handleExport('pdf')}><Download size={14} />导出PDF</button>
        </div>
      </div>

      <div className="industrial-card max-h-[75vh] overflow-y-auto scrollbar-thin">
        <div className="p-4 space-y-5">
          <Sec title="一、物理参数"><table className="industrial-table"><thead><tr><th>参数</th><th>值</th><th>单位</th></tr></thead><tbody>
            <KV k="冰面面积" v={b.parameters.iceArea} u={b.parameters.iceAreaUnit} /><KV k="冰层厚度" v={b.parameters.iceThickness} u={b.parameters.iceThicknessUnit} />
            <KV k="冰面温度" v={b.parameters.iceTemperature} u={b.parameters.iceTemperatureUnit} /><KV k="环境温度" v={b.parameters.ambientTemperature} u={b.parameters.ambientTemperatureUnit} />
            <KV k="环境湿度" v={b.parameters.ambientHumidity} u="%" /><KV k="人员数量" v={b.parameters.peopleCount} u="人" />
            <KV k="设备功率" v={b.parameters.equipmentPower} u={b.parameters.equipmentPowerUnit} /><KV k="照明功率" v={b.parameters.lightingPower} u={b.parameters.lightingPowerUnit} />
          </tbody></table></Sec>

          <Sec title="二、安全阈值"><table className="industrial-table"><thead><tr><th>阈值项</th><th>值</th><th>单位</th></tr></thead><tbody>
            <KV k="最大制冷负荷" v={b.thresholds.maxCoolingLoad} u={b.thresholds.maxCoolingLoadUnit} />
            <KV k="警告比例" v={`${(b.thresholds.warningRatio * 100).toFixed(0)}%`} u="-" />
            <KV k="极端值检测阈值" v={b.thresholds.extremeOutlierThreshold} u="IQR倍数" />
          </tbody></table></Sec>

          <Sec title="三、数据质量">
            <div className="grid grid-cols-5 gap-3 text-center">
              <Stat label="总记录" value={b.records.length} /><Stat label="完整" value={clean} cls="text-green-600" />
              <Stat label="缺失字段" value={miss} cls="text-amber-600" /><Stat label="单位混写" value={unit} cls="text-red-600" />
              <Stat label="采样缺口" value={gapCount} cls="text-purple-600" />
            </div>
            {gapCount > 0 && (
              <div className="mt-3 bg-purple-50 border border-purple-200 rounded p-3">
                <div className="font-mono text-xs font-semibold text-purple-700 mb-2">时间序列采样缺口（期望间隔: {expectedInterval}分钟）</div>
                {gapResult.gaps.map((g, i) => (
                  <div key={i} className="font-mono text-xs text-purple-600 mb-1">
                    缺口#{i + 1}: 预期 {new Date(g.expectedTime).toLocaleString('zh-CN')}，实际 {new Date(g.actualTime).toLocaleString('zh-CN')}（间隔 {g.gapMinutes.toFixed(0)} 分钟）
                  </div>
                ))}
              </div>
            )}
          </Sec>

          <Sec title="四、计算结果">
            <p className="text-xs text-industrial-500 mb-2">稳健均值: <span className="font-mono font-semibold text-primary-700">{rMean.toFixed(2)} kW</span> | 最大负荷: <span className="font-mono font-semibold text-red-600">{mLoad.toFixed(2)} kW</span></p>
            <table className="industrial-table"><thead><tr><th>#</th><th>时间</th><th>温度</th><th>湿度</th><th>总负荷</th><th>状态</th><th>来源</th></tr></thead>
            <tbody>{b.records.map((r, i) => {
              const res = b.calculationResults.find(c => c.recordId === r.id);
              const src = r.sources[0];
              return <tr key={r.id}><td className="font-mono">{i + 1}</td><td className="font-mono text-xs">{new Date(r.timestamp).toLocaleString('zh-CN')}</td>
                <td>{r.temperature}{r.temperatureUnit}</td><td>{r.humidity}%</td>
                <td className="font-semibold">{res ? `${res.totalLoad.toFixed(2)} ${res.totalLoadUnit}` : '-'}</td>
                <td><span className={`status-badge ${RS[r.recordStatus]?.c ?? 'status-badge-normal'}`}>{RS[r.recordStatus]?.l ?? r.recordStatus}</span></td>
                <td>{src ? <SrcLink file={src.sourceFile} line={src.sourceLine} /> : '-'}</td></tr>;
            })}</tbody></table>
          </Sec>

          <div className="border-l-4 border-red-500 pl-4 bg-red-50/50 rounded-r">
            <Sec title="五、极端值与异常" icon={<AlertOctagon size={16} className="text-red-600" />}>
              {b.abnormalRecords.length === 0 ? <p className="text-industrial-400 text-sm py-2">未检测到异常记录</p> : (
                <div className="space-y-2">{b.abnormalRecords.map(a => {
                  const sv = SEV[a.severity] || SEV.low; const cf = CFM[a.confirmStatus] || CFM.pending;
                  const rec = b.records.find(r => r.id === a.recordId); const src = rec?.sources[0];
                  return <div key={a.id} className="border border-red-200 bg-white rounded p-3 space-y-1">
                    <div className="flex items-center gap-2"><span className={`status-badge ${sv.c}`}>{sv.l}</span><span className={`status-badge ${cf.c}`}>{cf.l}</span>
                      <span className="font-mono text-xs text-industrial-500">#{a.id.slice(0, 8)}</span>{src && <SrcLink file={src.sourceFile} line={src.sourceLine} />}</div>
                    <p className="text-sm">{a.description}</p>
                    <p className="text-xs text-industrial-500">阈值 {a.threshold.toFixed(2)} kW | 实际 {a.actualValue.toFixed(2)} kW</p>
                  </div>;
                })}</div>
              )}
            </Sec>
          </div>

          {b.inspectionData.length > 0 && <Sec title="六、巡检表冲突"><div className="space-y-3">{b.inspectionData.map(ins => (
            <div key={ins.id} className="border border-amber-300 bg-amber-50/50 rounded p-3">
              <div className="flex items-center gap-2 mb-1"><span className="font-semibold text-sm">{ins.source}</span>
                <span className="status-badge status-badge-old">{ins.caliber === 'old' ? '旧口径' : '新口径'}</span>
                <span className={`status-badge ${ins.conflictStatus === 'resolved' ? 'status-badge-normal' : 'status-badge-pending'}`}>{ins.conflictStatus === 'resolved' ? '已解决' : '待处理'}</span></div>
              {ins.conflictEvidence && <ul className="text-xs text-industrial-600 list-disc list-inside space-y-0.5">{ins.conflictEvidence.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>}
            </div>))}</div></Sec>}

          {b.decisionTraces.length > 0 && <Sec title="七、决策留痕"><table className="industrial-table"><thead><tr><th>时间</th><th>操作人</th><th>类型</th><th>变更前</th><th>变更后</th><th>原因</th></tr></thead>
            <tbody>{b.decisionTraces.map(t => <tr key={t.id}>
              <td className="font-mono text-xs">{new Date(t.timestamp).toLocaleString('zh-CN')}</td><td>{t.operator}</td><td>{t.decisionType}</td>
              <td className="font-mono text-xs max-w-[120px] truncate">{typeof t.beforeValue === 'object' ? '…' : String(t.beforeValue)}</td>
              <td className="font-mono text-xs max-w-[120px] truncate">{typeof t.afterValue === 'object' ? '…' : String(t.afterValue)}</td>
              <td className="text-xs">{t.reason}</td></tr>)}</tbody></table></Sec>}
        </div>
      </div>
    </div>
  );
}

function Sec({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return <div><h3 className="text-base font-bold text-primary-800 mb-2 flex items-center gap-1.5">{icon}{title}</h3>{children}</div>;
}
function KV({ k, v, u }: { k: string; v: string | number; u: string }) {
  return <tr><td className="text-industrial-600">{k}</td><td className="font-mono font-semibold">{v}</td><td className="text-industrial-500">{u}</td></tr>;
}
function Stat({ label, value, cls }: { label: string; value: number; cls?: string }) {
  return <div className="industrial-card p-3"><div className="text-xs text-industrial-500">{label}</div><div className={`text-xl font-bold font-mono ${cls ?? ''}`}>{value}</div></div>;
}
function SrcLink({ file, line }: { file: string; line: number }) {
  return <span className="inline-flex items-center gap-0.5 text-xs text-primary-600 hover:text-primary-800 cursor-pointer font-mono"><Link size={10} />{file}#{line}</span>;
}
