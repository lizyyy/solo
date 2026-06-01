import { useStore } from '@/store';
import { Snowflake, AlertTriangle, Upload, Calculator, ClipboardCheck, FileText, History, Plus, Database, User } from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: '草稿', cls: 'status-badge-pending' },
  processing: { label: '计算中', cls: 'status-badge-old' },
  completed: { label: '已完成', cls: 'status-badge-normal' },
  archived: { label: '已归档', cls: 'status-badge-old' },
};

const NAV_CARDS = [
  { key: 'import', label: '数据导入', icon: Upload, tab: 'import' },
  { key: 'calculate', label: '负荷计算', icon: Calculator, tab: 'calculate' },
  { key: 'detection', label: '异常检测', icon: AlertTriangle, tab: 'detection' },
  { key: 'inspection', label: '校验比对', icon: ClipboardCheck, tab: 'inspection' },
  { key: 'report', label: '诊断报告', icon: FileText, tab: 'report' },
  { key: 'history', label: '决策追溯', icon: History, tab: 'history' },
];

export default function Workbench() {
  const { batches, operatorName, setOperatorName, createBatch, generateSampleData, setActiveTab, loadBatch, deleteBatch } = useStore();

  const totalRecords = batches.reduce((s, b) => s + b.records.length, 0);
  const totalAbnormal = batches.reduce((s, b) => s + b.abnormalRecords.length, 0);

  const handleCreateBatch = () => {
    const name = `批次 ${batches.length + 1}`;
    const batch = createBatch(name);
    loadBatch(batch.id);
    setActiveTab('import');
  };

  const handleLoadSample = () => {
    const batch = generateSampleData();
    loadBatch(batch.id);
    setActiveTab('calculate');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Snowflake className="w-7 h-7 text-primary-600" />
          <h1 className="text-2xl font-bold">冰场冷负荷诊断工作台</h1>
        </div>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-industrial-500" />
          <input
            className="industrial-input w-40"
            placeholder="操作员姓名"
            value={operatorName}
            onChange={(e) => setOperatorName(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="industrial-card">
          <div className="industrial-card-header">总批次</div>
          <div className="p-4 text-3xl font-bold font-mono text-primary-700">{batches.length}</div>
        </div>
        <div className="industrial-card">
          <div className="industrial-card-header">总记录数</div>
          <div className="p-4 text-3xl font-bold font-mono text-primary-700">{totalRecords}</div>
        </div>
        <div className="industrial-card">
          <div className="industrial-card-header">异常记录</div>
          <div className="p-4 text-3xl font-bold font-mono text-alert-600">{totalAbnormal}</div>
        </div>
      </div>

      {batches.length === 0 && (
        <div className="industrial-card border-alert-400 border-2">
          <div className="p-8 text-center space-y-4">
            <Database className="w-12 h-12 mx-auto text-alert-500" />
            <p className="text-lg font-semibold text-primary-700">首次使用？加载示例数据快速体验</p>
            <p className="text-sm text-industrial-500">将生成一组模拟冰场运行数据，包含正常与异常记录</p>
            <button className="industrial-btn-danger" onClick={handleLoadSample}>
              <span className="flex items-center gap-2"><Database className="w-4 h-4" />加载示例数据</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-6 gap-3">
        {NAV_CARDS.map(({ key, label, icon: Icon, tab }) => (
          <button
            key={key}
            onClick={() => setActiveTab(tab)}
            className="industrial-card p-4 text-center hover:bg-primary-50 transition-colors cursor-pointer"
          >
            <Icon className="w-6 h-6 mx-auto mb-2 text-primary-600" />
            <span className="text-sm font-medium">{label}</span>
          </button>
        ))}
      </div>

      <div className="industrial-card">
        <div className="industrial-card-header flex items-center justify-between">
          <span>批次列表</span>
          <div className="flex gap-2">
            <button className="industrial-btn-primary text-xs px-3 py-1" onClick={handleCreateBatch}>
              <span className="flex items-center gap-1"><Plus className="w-3 h-3" />新建批次</span>
            </button>
            <button className="industrial-btn text-xs px-3 py-1" onClick={handleLoadSample}>
              <span className="flex items-center gap-1"><Database className="w-3 h-3" />示例数据</span>
            </button>
          </div>
        </div>
        {batches.length === 0 ? (
          <div className="p-8 text-center text-industrial-400 text-sm">暂无批次，请新建或加载示例数据</div>
        ) : (
          <table className="industrial-table">
            <thead>
              <tr>
                <th>批次名称</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>记录数</th>
                <th>异常数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const st = STATUS_MAP[b.status] || STATUS_MAP.draft;
                return (
                  <tr key={b.id}>
                    <td className="font-medium">{b.name}</td>
                    <td><span className={`status-badge ${st.cls}`}>{st.label}</span></td>
                    <td className="font-mono text-xs">{new Date(b.createdAt).toLocaleString('zh-CN')}</td>
                    <td className="font-mono">{b.records.length}</td>
                    <td className="font-mono text-alert-600">{b.abnormalRecords.length}</td>
                    <td className="space-x-2">
                      <button className="industrial-btn text-xs px-2 py-1" onClick={() => { loadBatch(b.id); setActiveTab('calculate'); }}>进入</button>
                      <button className="industrial-btn-danger text-xs px-2 py-1" onClick={() => deleteBatch(b.id)}>删除</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
