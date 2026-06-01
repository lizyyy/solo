import { useStore } from '@/store';
import { History, ArrowUpRight, ArrowDownRight, Minus, RotateCcw, GitBranch, User, Clock } from 'lucide-react';

const PARAM_LABELS: Record<string, string> = {
  iceArea: '冰面面积', iceThickness: '冰层厚度', iceTemperature: '冰面温度',
  ambientTemperature: '环境温度', ambientHumidity: '环境湿度', peopleCount: '人员数量',
  equipmentPower: '设备功率', lightingPower: '照明功率',
};

const DECISION_TYPE_MAP: Record<string, string> = {
  parameter_change: '参数变更', status_change: '状态变更',
  conflict_resolve: '冲突处理', extreme_handle: '极端值处理',
};

export default function HistoryPage() {
  const batches = useStore(s => s.batches);
  const comparisonBatchIds = useStore(s => s.comparisonBatchIds);
  const toggleComparisonBatch = useStore(s => s.toggleComparisonBatch);
  const loadBatch = useStore(s => s.loadBatch);

  const selected = batches.filter(b => comparisonBatchIds.includes(b.id));

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-2">
        <History className="w-5 h-5 text-primary-600" />
        <h2 className="text-xl font-bold">历史对比</h2>
      </div>

      <div className="industrial-card">
        <div className="industrial-card-header">批次列表（勾选以对比）</div>
        <table className="industrial-table">
          <thead><tr><th></th><th>批次名称</th><th>状态</th><th>创建时间</th><th>记录数</th><th>异常数</th><th>操作</th></tr></thead>
          <tbody>
            {batches.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-6 text-industrial-400">暂无批次</td></tr>
            ) : batches.map(b => (
              <tr key={b.id}>
                <td><input type="checkbox" checked={comparisonBatchIds.includes(b.id)} onChange={() => toggleComparisonBatch(b.id)} /></td>
                <td className="font-medium">{b.name}</td>
                <td><span className="status-badge status-badge-normal">{b.status}</span></td>
                <td className="font-mono text-xs">{new Date(b.createdAt).toLocaleString('zh-CN')}</td>
                <td className="font-mono">{b.records.length}</td>
                <td className="font-mono text-red-600">{b.abnormalRecords.length}</td>
                <td><button className="industrial-btn text-xs px-2 py-1 flex items-center gap-1" onClick={() => loadBatch(b.id)}><RotateCcw size={12} />载入</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected.length >= 2 && (
        <>
          <div className="industrial-card">
            <div className="industrial-card-header flex items-center gap-1"><GitBranch size={14} />参数对比</div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="industrial-table">
                <thead>
                  <tr><th>参数</th>{selected.map(b => <th key={b.id}>{b.name}</th>)}</tr>
                </thead>
                <tbody>
                  {Object.keys(PARAM_LABELS).map(key => (
                    <tr key={key}>
                      <td className="text-industrial-600">{PARAM_LABELS[key]}</td>
                      {selected.map((b, i) => {
                        const val = (b.parameters as any)[key];
                        const prev = i > 0 ? (selected[i - 1].parameters as any)[key] : val;
                        const diff = val !== prev;
                        return (
                          <td key={b.id} className={`font-mono ${diff && i > 0 ? 'bg-amber-50 font-semibold text-amber-700' : ''}`}>
                            <span className="flex items-center gap-1">
                              {val}
                              {i > 0 && <DiffArrow curr={val} prev={prev} />}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="industrial-card">
            <div className="industrial-card-header">结果对比</div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="industrial-table">
                <thead>
                  <tr><th>指标</th>{selected.map(b => <th key={b.id}>{b.name}</th>)}</tr>
                </thead>
                <tbody>
                  <CompareRow label="稳健均值 (kW)" values={selected.map(b => robustMean(b))} />
                  <CompareRow label="最大负荷 (kW)" values={selected.map(b => b.calculationResults.length > 0 ? Math.max(...b.calculationResults.map(r => r.totalLoad)) : 0)} />
                  <CompareRow label="异常数量" values={selected.map(b => b.abnormalRecords.length)} />
                  <CompareRow label="记录总数" values={selected.map(b => b.records.length)} />
                </tbody>
              </table>
            </div>
          </div>

          <div className="industrial-card">
            <div className="industrial-card-header flex items-center gap-1"><Clock size={14} />决策留痕时间线</div>
            <div className="p-4 space-y-3">
              {selected.flatMap(b => b.decisionTraces.map(t => ({ ...t, batchName: b.name })))
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                .map(t => (
                  <div key={t.id} className="flex items-start gap-3 border-l-2 border-primary-300 pl-4 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-industrial-500 mb-0.5">
                        <Clock size={11} />{new Date(t.timestamp).toLocaleString('zh-CN')}
                        <User size={11} />{t.operator}
                        <span className="status-badge status-badge-old">{DECISION_TYPE_MAP[t.decisionType] || t.decisionType}</span>
                        <span className="text-industrial-400">| {t.batchName}</span>
                      </div>
                      <div className="text-sm flex items-center gap-2">
                        <span className="font-mono text-red-500 line-through">{fmtVal(t.beforeValue)}</span>
                        <span className="text-industrial-400">→</span>
                        <span className="font-mono text-green-600">{fmtVal(t.afterValue)}</span>
                      </div>
                      <p className="text-xs text-industrial-500 mt-0.5">{t.reason}</p>
                    </div>
                  </div>
                ))}
              {selected.every(b => b.decisionTraces.length === 0) && (
                <p className="text-center text-industrial-400 text-sm py-4">选中批次暂无决策记录</p>
              )}
            </div>
          </div>
        </>
      )}

      {selected.length === 1 && (
        <p className="text-center text-industrial-400 text-sm py-6">请再勾选一个批次以启用对比功能</p>
      )}
    </div>
  );
}

function robustMean(b: { calculationResults: { totalLoad: number; recordId: string }[]; records: { id: string; recordStatus: string }[] }) {
  const nonExt = b.calculationResults.filter(r => !b.records.find(rec => rec.id === r.recordId && rec.recordStatus === 'extreme'));
  return nonExt.length > 0 ? nonExt.reduce((s, r) => s + r.totalLoad, 0) / nonExt.length : 0;
}

function DiffArrow({ curr, prev }: { curr: number; prev: number }) {
  if (curr > prev) return <ArrowUpRight size={12} className="text-red-500" />;
  if (curr < prev) return <ArrowDownRight size={12} className="text-green-500" />;
  return <Minus size={12} className="text-industrial-300" />;
}

function CompareRow({ label, values }: { label: string; values: number[] }) {
  return (
    <tr>
      <td className="text-industrial-600">{label}</td>
      {values.map((v, i) => {
        const prev = i > 0 ? values[i - 1] : v;
        const diff = v !== prev && i > 0;
        return (
          <td key={i} className={`font-mono ${diff ? 'bg-amber-50 font-semibold' : ''}`}>
            <span className="flex items-center gap-1">
              {v.toFixed(2)}
              {i > 0 && <DiffArrow curr={v} prev={prev} />}
            </span>
          </td>
        );
      })}
    </tr>
  );
}

function fmtVal(v: any): string {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'object') return '{…}';
  return String(v);
}
