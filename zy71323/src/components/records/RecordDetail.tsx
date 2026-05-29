import { X, Copy, CheckCircle2, AlertTriangle, FileText, Zap, Waves, Activity, TrendingUp, Calendar, Gauge, Clock, Hash, GitBranch, Check, AlertCircle } from 'lucide-react';
import type { EstimationRecord } from '@/types';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface RecordDetailProps { record: EstimationRecord; onClose: () => void; }

function fmtDT(iso: string) { return new Date(iso).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
function fmtE(v: number | undefined | null): string {
  if (v === undefined || v === null) return '--';
  if (v >= 1000000) return `${(v / 1000000).toFixed(4)} MWh`;
  if (v >= 1000) return `${(v / 1000).toFixed(3)} kWh`;
  return `${v.toFixed(2)} Wh`;
}

const statusMap = {
  valid: { label: '有效', className: 'bg-success-500/20 text-success-500 border-success-500/30', icon: CheckCircle2 },
  invalid: { label: '无效', className: 'bg-alert-500/20 text-alert-500 border-alert-500/30', icon: AlertTriangle },
  draft: { label: '草稿', className: 'bg-ocean-500/20 text-ocean-400 border-ocean-500/30', icon: FileText },
};

type TabId = 'params' | 'results' | 'validation' | 'history';

export function RecordDetail({ record, onClose }: RecordDetailProps) {
  const [tab, setTab] = useState<TabId>('params');
  const [copied, setCopied] = useState(false);
  const status = statusMap[record.status];
  const StatusIcon = status.icon;

  const copyId = async () => { await navigator.clipboard.writeText(record.id); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const Tab = ({ id, label }: { id: TabId; label: string }) => (
    <button onClick={() => setTab(id)} className={cn('px-4 py-2 text-sm font-medium transition-colors border-b-2',
      tab === id ? 'text-tech-400 border-tech-400' : 'text-ocean-400 border-transparent hover:text-ocean-200')}>{label}</button>
  );

  const Row = ({ label, value, hl }: { label: string; value: React.ReactNode; hl?: boolean }) => (
    <div className="flex items-center justify-between py-2 border-b border-ocean-700/50 last:border-0">
      <span className="text-ocean-400 text-sm">{label}</span>
      <span className={cn('text-sm', hl ? 'text-tech-400 font-mono font-semibold' : 'text-ocean-200')}>{value}</span>
    </div>
  );

  const Sec = ({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) => (
    <div className="bg-ocean-700/30 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-ocean-200 mb-3 flex items-center gap-2"><Icon className="w-4 h-4 text-tech-400" />{title}</h3>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-ocean-900/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-ocean-800 rounded-2xl border border-ocean-600 shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-ocean-700">
          <div className="flex items-center gap-4">
            <div className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border', status.className)}>
              <StatusIcon className="w-4 h-4" />{status.label}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">记录详情</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Hash className="w-3.5 h-3.5 text-ocean-500" />
                <button onClick={copyId} className="flex items-center gap-1.5 text-ocean-400 hover:text-tech-400 transition-colors" title={record.id}>
                  {copied ? <Check className="w-3.5 h-3.5 text-success-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="font-mono text-xs">{record.id}</span>
                </button>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-ocean-700 text-ocean-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-6 px-5 border-b border-ocean-700 bg-ocean-800/50">
          <Tab id="params" label="参数配置" />
          <Tab id="results" label="计算结果" />
          <Tab id="validation" label="校验信息" />
          <Tab id="history" label="修改历史" />
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'params' && (
            <div className="space-y-6 animate-fade-in">
              <Sec icon={Waves} title="潮汐参数">
                <Row label="潮差" value={`${record.params.tidalRange} ${record.params.tidalRangeUnit}`} />
                <Row label="流速" value={`${record.params.flowVelocity} ${record.params.flowVelocityUnit}`} />
                <Row label="叶轮面积" value={`${record.params.impellerArea} ${record.params.impellerAreaUnit}`} />
                <Row label="效率" value={`${(record.params.efficiency * 100).toFixed(1)}%`} />
              </Sec>
              <Sec icon={Gauge} title="设备约束">
                <Row label="额定功率" value={`${record.params.deviceConstraints.ratedPower} kW`} />
                <Row label="最大流速" value={`${record.params.deviceConstraints.maxFlowVelocity} m/s`} />
                <Row label="最小流速" value={`${record.params.deviceConstraints.minFlowVelocity} m/s`} />
                <Row label="最大效率" value={`${(record.params.deviceConstraints.maxEfficiency * 100).toFixed(1)}%`} />
                <Row label="叶轮直径" value={`${record.params.deviceConstraints.impellerDiameter} m`} />
              </Sec>
              <Sec icon={Activity} title={`潮汐周期分段 (${record.params.tideCycles.length} 段)`}>
                <div className="space-y-2">
                  {record.params.tideCycles.map((s, i) => (
                    <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-ocean-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-ocean-600 text-ocean-300 text-xs flex items-center justify-center">{i + 1}</span>
                        <span className="text-ocean-400 text-xs uppercase">{s.phase}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-ocean-300">{s.startTime}-{s.endTime}h</span>
                        <span className="text-ocean-400">潮高: {s.tideHeight}m</span>
                        <span className="text-ocean-400">流速: {s.flowVelocity}m/s</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Sec>
              {record.note && <div className="bg-ocean-700/30 rounded-xl p-4"><h3 className="text-sm font-semibold text-ocean-200 mb-2">备注</h3><p className="text-ocean-300 text-sm">{record.note}</p></div>}
            </div>
          )}

          {tab === 'results' && record.result && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-tech-500/10 to-ocean-700/30 rounded-xl p-5 border border-tech-500/30">
                  <div className="flex items-center justify-between mb-2"><span className="text-xs text-ocean-400">总能量</span><Zap className="w-5 h-5 text-tech-400" /></div>
                  <p className="text-2xl font-bold text-white font-mono">{fmtE(record.result.totalEnergy)}</p>
                </div>
                <div className="bg-ocean-700/30 rounded-xl p-5 border border-ocean-600">
                  <div className="flex items-center justify-between mb-2"><span className="text-xs text-ocean-400">容量系数</span><Gauge className="w-5 h-5 text-ocean-400" /></div>
                  <p className="text-2xl font-bold text-white font-mono">{(record.result.capacityFactor * 100).toFixed(2)}%</p>
                </div>
              </div>
              <Sec icon={TrendingUp} title="能量构成">
                <Row label="势能 (Ep)" value={fmtE(record.result.potentialEnergy)} />
                <Row label="动能 (Ek)" value={fmtE(record.result.kineticEnergy)} />
                <Row label="日发电量" value={fmtE(record.result.dailyGeneration)} hl />
                <Row label="年发电量" value={fmtE(record.result.annualGeneration)} hl />
              </Sec>
            </div>
          )}

          {tab === 'results' && !record.result && (
            <div className="text-center py-12"><FileText className="w-12 h-12 text-ocean-500 mx-auto mb-4 opacity-50" /><p className="text-ocean-400">暂无计算结果</p></div>
          )}

          {tab === 'validation' && (
            <div className="space-y-6 animate-fade-in">
              <div className={cn('rounded-xl p-4 border', record.validation.valid ? 'bg-success-500/10 border-success-500/30' : 'bg-alert-500/10 border-alert-500/30')}>
                <div className="flex items-center gap-3">
                  {record.validation.valid ? <CheckCircle2 className="w-6 h-6 text-success-500" /> : <AlertCircle className="w-6 h-6 text-alert-500" />}
                  <div>
                    <p className={cn('font-semibold', record.validation.valid ? 'text-success-500' : 'text-alert-500')}>
                      {record.validation.valid ? '参数校验通过' : '参数校验未通过'}
                    </p>
                    <p className="text-ocean-400 text-sm">{record.validation.errors.length} 个错误，{record.validation.warnings.length} 个警告</p>
                  </div>
                </div>
              </div>
              {record.validation.errors.length > 0 && (
                <div className="bg-ocean-700/30 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-alert-500 mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4" />错误 ({record.validation.errors.length})</h3>
                  <div className="space-y-2">
                    {record.validation.errors.map((e, i) => (
                      <div key={i} className="p-3 bg-alert-500/10 border border-alert-500/20 rounded-lg">
                        <p className="text-ocean-200 text-sm font-medium">{e.message}</p>
                        <p className="text-ocean-400 text-xs mt-1">字段: {e.field} | 建议: {e.suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-ocean-700/30 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-ocean-200 mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-tech-400" />时间线</h3>
                <div className="relative pl-6 space-y-4">
                  <div className="absolute left-2 top-2 bottom-2 w-px bg-ocean-600" />
                  <div className="relative">
                    <div className="absolute -left-6 w-4 h-4 rounded-full bg-success-500 border-2 border-ocean-800" />
                    <div className="bg-ocean-800/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-success-500 font-medium">创建</span>
                        <span className="text-xs text-ocean-500">{fmtDT(record.createdAt)}</span>
                      </div>
                      <p className="text-sm text-ocean-300">初始版本 v{record.version}</p>
                    </div>
                  </div>
                  {record.parentId && (
                    <div className="relative">
                      <div className="absolute -left-6 w-4 h-4 rounded-full bg-ocean-500 border-2 border-ocean-800" />
                      <div className="bg-ocean-800/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <GitBranch className="w-3 h-3 text-ocean-400" />
                          <span className="text-xs text-ocean-400 font-medium">续算来源</span>
                        </div>
                        <p className="text-sm text-ocean-300 font-mono">{record.parentId}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <Sec icon={Calendar} title="版本信息">
                <Row label="当前版本" value={`v${record.version}`} />
                <Row label="创建时间" value={fmtDT(record.createdAt)} />
                <Row label="更新时间" value={fmtDT(record.updatedAt)} />
                {record.parentId && <Row label="父记录ID" value={<span className="font-mono">{record.parentId}</span>} />}
              </Sec>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-5 border-t border-ocean-700 bg-ocean-800/50">
          <div className="flex items-center gap-2 text-ocean-400 text-sm"><Calendar className="w-4 h-4" /><span>创建于 {fmtDT(record.createdAt)}</span></div>
          <button onClick={onClose} className="px-5 py-2 rounded-lg bg-ocean-700 hover:bg-ocean-600 text-ocean-200 text-sm transition-colors">关闭</button>
        </div>
      </div>
    </div>
  );
}
