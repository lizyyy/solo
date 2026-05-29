import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, ChevronRight, RefreshCw, Check, AlertCircle, X } from 'lucide-react';
import { api, type PermissionDiff, type Script } from '@/utils/api';
import StatusBadge from '@/components/StatusBadge';
import { useAppStore } from '@/store/appStore';

export default function PermissionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const scriptId = parseInt(id || '0', 10);
  const [diff, setDiff] = useState<PermissionDiff | null>(null);
  const [script, setScript] = useState<Script | null>(null);
  const [filter, setFilter] = useState<'all' | 'removed' | 'added' | 'kept'>('all');
  const { showToast, setLoading } = useAppStore();

  useEffect(() => {
    load();
  }, [scriptId]);

  async function load() {
    const [s, d] = await Promise.all([
      api.scripts.get(scriptId).then(r => r.script),
      api.scripts.getPermissions(scriptId),
    ]);
    setScript(s);
    setDiff(d);
  }

  async function handleRederive() {
    setLoading('derive', true);
    try {
      const d = await api.scripts.derivePermissions(scriptId);
      setDiff(d);
      showToast('重新推导完成', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoading('derive', false);
    }
  }

  async function handleApply() {
    if (!confirm('确定应用最小权限策略？这将覆盖现有权限配置。')) return;
    setLoading('apply', true);
    try {
      await api.scripts.applyPolicy(scriptId);
      showToast('已应用最小权限策略', 'success');
      load();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoading('apply', false);
    }
  }

  async function addException(p: { service: string; action: string }, type: 'keep' | 'remove') {
    try {
      await api.exceptions.create({
        script_id: scriptId,
        reason: type === 'keep' ? `保留权限: ${p.service}:${p.action}` : `豁免权限: ${p.service}:${p.action}`,
        impact_scope: script?.name,
        risk_note: '手动例外，需要定期复核',
      });
      showToast('已添加例外', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  }

  if (!diff || !script) return <div className="p-8 text-center text-gray-400">加载中...</div>;

  const allItems = [
    ...diff.removed.map(p => ({ ...p, rowType: 'removed' as const })),
    ...diff.added.map(p => ({ ...p, rowType: 'added' as const })),
    ...diff.kept.map(p => ({ ...p, rowType: 'kept' as const })),
  ];

  const filtered = filter === 'all' ? allItems : allItems.filter(i => i.rowType === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <button onClick={() => navigate('/scripts')} className="hover:text-gray-200">脚本列表</button>
            <ChevronRight size={14} />
            <button onClick={() => navigate(`/scripts/${scriptId}`)} className="hover:text-gray-200">{script.name}</button>
            <ChevronRight size={14} />
            <span>权限推导</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Shield size={24} className="text-brand-400" />
            权限推导结果
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary" onClick={handleRederive}>
            <RefreshCw size={16} className="inline mr-2" />
            重新推导
          </button>
          <button className="btn-primary" onClick={handleApply}>
            <Check size={16} className="inline mr-2" />
            应用最小权限
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">现有权限</div>
          <div className="text-2xl font-bold">{diff.existing_permissions.length}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">推导最小集</div>
          <div className="text-2xl font-bold text-brand-400">{diff.derived_permissions.length}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">建议移除</div>
          <div className="text-2xl font-bold text-red-400">{diff.removed.length}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">需要新增</div>
          <div className="text-2xl font-bold text-emerald-400">{diff.added.length}</div>
        </div>
      </div>

      <div className="flex gap-2">
        {(['all', 'removed', 'added', 'kept'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                : 'bg-bg-tertiary text-gray-400 hover:text-gray-200'
            }`}
          >
            {f === 'all' ? `全部 (${allItems.length})` :
             f === 'removed' ? `移除 (${diff.removed.length})` :
             f === 'added' ? `新增 (${diff.added.length})` :
             `保留 (${diff.kept.length})`}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700/50">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400 w-24">变更</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">服务</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">操作</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">说明</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-400 w-32">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, idx) => (
              <tr key={`${p.rowType}-${idx}`} className={`border-b border-gray-700/30 last:border-0 ${
                p.rowType === 'removed' ? 'bg-red-500/5' :
                p.rowType === 'added' ? 'bg-emerald-500/5' : ''
              }`}>
                <td className="py-3 px-4"><StatusBadge status={p.rowType} /></td>
                <td className="py-3 px-4 text-sm font-medium">{p.service}</td>
                <td className="py-3 px-4 text-sm text-gray-300 font-mono">{p.action}</td>
                <td className="py-3 px-4 text-sm text-gray-400">{p.reason || '-'}</td>
                <td className="py-3 px-4 text-right">
                  {p.rowType === 'removed' && (
                    <button
                      onClick={() => addException(p, 'keep')}
                      className="p-1.5 hover:bg-bg-tertiary rounded transition-colors text-gray-400 hover:text-amber-400"
                      title="保留为例外"
                    >
                      <AlertCircle size={16} />
                    </button>
                  )}
                  {p.rowType === 'added' && (
                    <button
                      onClick={() => addException(p, 'remove')}
                      className="p-1.5 hover:bg-bg-tertiary rounded transition-colors text-gray-400 hover:text-amber-400"
                      title="不添加为例外"
                    >
                      <X size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
