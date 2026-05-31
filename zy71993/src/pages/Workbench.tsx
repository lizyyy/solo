import { useStore } from '@/store/useStore';
import { Upload, FileJson, FileText, FileWarning, RotateCcw, Zap, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { STATUS_LABEL, STATUS_COLORS } from '@/types';
import type { DataSourceMeta } from '@/types';

const DS_CONFIG: Record<DataSourceMeta['type'], { label: string; icon: typeof FileJson; accept: string }> = {
  snapshot: { label: '目录快照', icon: FileJson, accept: '.json' },
  checksum: { label: '校验值清单', icon: FileText, accept: '.csv,.json' },
  failure_log: { label: '失败日志', icon: FileWarning, accept: '.txt,.log,.json' },
  rollback: { label: '回滚记录', icon: RotateCcw, accept: '.json' },
};

const PIE_COLORS = ['#10b981', '#e94560', '#f59e0b', '#8b5cf6', '#f97316', '#6366f1'];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function Workbench() {
  const {
    machineId,
    dataSources,
    result,
    isVerifying,
    setMachineId,
    setDataSource,
    loadSnapshot,
    loadChecksum,
    loadFailureLog,
    loadRollback,
    runVerify,
    loadMockData,
  } = useStore();

  const handleFileUpload = (type: DataSourceMeta['type']) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const data = JSON.parse(text);
        switch (type) {
          case 'snapshot': loadSnapshot(data); break;
          case 'checksum': loadChecksum(data); break;
          case 'failure_log': loadFailureLog(data); break;
          case 'rollback': loadRollback(data); break;
        }
        setDataSource(type, file.name, true);
      } catch {
        setDataSource(type, file.name, false, '文件解析失败');
      }
    };
    reader.readAsText(file);
  };

  const pieData = result
    ? [
        { name: '正常', value: result.summary.normal, color: PIE_COLORS[0] },
        { name: '缺失', value: result.summary.missingFile, color: PIE_COLORS[1] },
        { name: '损坏', value: result.summary.corrupted, color: PIE_COLORS[2] },
        { name: '重复', value: result.summary.duplicate, color: PIE_COLORS[3] },
        { name: '校验值陈旧', value: result.summary.staleChecksum, color: PIE_COLORS[4] },
      ].filter((d) => d.value > 0)
    : [];

  const loadedCount = dataSources.filter((d) => d.loaded).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">核验工作台</h2>
          <p className="text-sm text-slate-500 mt-1">加载数据源，一键核验备份完整性</p>
        </div>
        <button
          onClick={loadMockData}
          className="px-4 py-2 rounded-lg bg-navy-600 text-slate-300 text-sm hover:bg-navy-500 transition-colors border border-navy-500/50"
        >
          加载演示数据
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1">
          <div className="bg-navy-800/80 rounded-xl border border-navy-500/30 p-4">
            <label className="block text-xs font-medium text-slate-400 mb-2">目标机器</label>
            <input
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              placeholder="例如: srv-prod-01"
              className="w-full bg-navy-900 border border-navy-500/40 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-cyan/50"
            />
          </div>
        </div>
        <div className="lg:col-span-3">
          <div className="bg-navy-800/80 rounded-xl border border-navy-500/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-300">数据源</h3>
              <span className="text-xs text-slate-500">{loadedCount}/4 已加载</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(Object.entries(DS_CONFIG) as [DataSourceMeta['type'], typeof DS_CONFIG['snapshot']][]).map(([type, config]) => {
                const ds = dataSources.find((d) => d.type === type);
                const Icon = config.icon;
                return (
                  <label
                    key={type}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                      ds?.loaded
                        ? 'bg-accent-green/5 border-accent-green/30'
                        : ds?.error
                        ? 'bg-accent-red/5 border-accent-red/30'
                        : 'bg-navy-700/50 border-navy-500/30 hover:border-accent-cyan/30'
                    }`}
                  >
                    <input type="file" accept={config.accept} onChange={handleFileUpload(type)} className="hidden" />
                    <Icon className={`w-5 h-5 ${ds?.loaded ? 'text-accent-green' : ds?.error ? 'text-accent-red' : 'text-slate-500'}`} />
                    <span className="text-xs text-slate-400">{config.label}</span>
                    {ds?.loaded && <span className="text-[10px] text-accent-green truncate max-w-full">{ds.fileName}</span>}
                    {ds?.error && <span className="text-[10px] text-accent-red">{ds.error}</span>}
                    {!ds && <Upload className="w-3 h-3 text-slate-600" />}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={runVerify}
          disabled={isVerifying || loadedCount === 0}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-accent-cyan to-accent-blue text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all glow-cyan"
        >
          {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {isVerifying ? '核验中...' : '开始核验'}
        </button>
        {loadedCount === 0 && (
          <span className="text-xs text-slate-500">请先加载数据源或使用演示数据</span>
        )}
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: '总备份包', value: result.summary.total, color: 'text-white' },
              { label: '正常', value: result.summary.normal, color: 'text-accent-green' },
              { label: '缺失', value: result.summary.missingFile, color: 'text-accent-red' },
              { label: '损坏', value: result.summary.corrupted, color: 'text-accent-amber' },
              { label: '异常', value: result.summary.duplicate + result.summary.staleChecksum + result.summary.other, color: 'text-accent-purple' },
            ].map((card) => (
              <div key={card.label} className="bg-navy-800/80 rounded-xl border border-navy-500/30 p-4 card-hover">
                <p className="text-xs text-slate-500 mb-1">{card.label}</p>
                <p className={`text-2xl font-bold font-mono ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-navy-800/80 rounded-xl border border-navy-500/30 p-5">
              <h3 className="text-sm font-medium text-slate-300 mb-4">状态分布</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={2}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1a1a2e', border: '1px solid #233554', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="lg:col-span-2 bg-navy-800/80 rounded-xl border border-navy-500/30 p-5">
              <h3 className="text-sm font-medium text-slate-300 mb-4">备份包列表</h3>
              <div className="overflow-x-auto max-h-[230px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-navy-500/30">
                      <th className="text-left py-2 pr-3 font-medium">名称</th>
                      <th className="text-left py-2 pr-3 font-medium">大小</th>
                      <th className="text-left py-2 pr-3 font-medium">状态</th>
                      <th className="text-left py-2 font-medium">校验</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.packages.map((pkg, i) => (
                      <tr
                        key={i}
                        className={`border-b border-navy-500/10 ${
                          pkg.status !== 'ok' ? 'bg-accent-red/5' : ''
                        }`}
                      >
                        <td className="py-2 pr-3 font-mono text-slate-300 max-w-[260px] truncate" title={pkg.path}>
                          {pkg.name}
                        </td>
                        <td className="py-2 pr-3 text-slate-400 font-mono">{formatBytes(pkg.size)}</td>
                        <td className="py-2 pr-3">
                          <span className={`${STATUS_COLORS[pkg.status]} font-medium`}>
                            {STATUS_LABEL[pkg.status]}
                          </span>
                        </td>
                        <td className="py-2">
                          {pkg.checksumMatch === true && <CheckCircle2 className="w-3.5 h-3.5 text-accent-green inline" />}
                          {pkg.checksumMatch === false && <XCircle className="w-3.5 h-3.5 text-accent-red inline" />}
                          {pkg.checksumMatch === undefined && <span className="text-slate-600">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
