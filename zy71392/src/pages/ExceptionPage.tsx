import { useEffect, useState } from 'react';
import { ShieldCheck, Plus, Check, X, Calendar, AlertTriangle } from 'lucide-react';
import { api, type Exception, type ExceptionStatus } from '@/utils/api';
import StatusBadge from '@/components/StatusBadge';
import { useAppStore } from '@/store/appStore';

export default function ExceptionPage() {
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [filter, setFilter] = useState<ExceptionStatus | 'all'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [newExc, setNewExc] = useState({ script_id: 0, reason: '', expires_at: '', impact_scope: '', risk_note: '' });
  const { showToast, setLoading } = useAppStore();

  useEffect(() => {
    load();
  }, [filter]);

  async function load() {
    const list = await api.exceptions.list(filter === 'all' ? undefined : { status: filter });
    setExceptions(list);
  }

  async function handleCreate() {
    if (!newExc.reason.trim()) {
      showToast('请填写例外原因', 'error');
      return;
    }
    setLoading('create', true);
    try {
      await api.exceptions.create(newExc);
      showToast('创建成功', 'success');
      setShowCreate(false);
      setNewExc({ script_id: 0, reason: '', expires_at: '', impact_scope: '', risk_note: '' });
      load();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoading('create', false);
    }
  }

  async function handleApprove(id: number) {
    try {
      await api.exceptions.update(id, { status: 'approved' });
      showToast('已批准', 'success');
      load();
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  }

  async function handleReject(id: number) {
    try {
      await api.exceptions.update(id, { status: 'rejected' });
      showToast('已拒绝', 'success');
      load();
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('确定删除？')) return;
    try {
      await api.exceptions.delete(id);
      showToast('已删除', 'success');
      load();
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  }

  const isLongRunning = (e: Exception) => {
    if (e.status !== 'approved') return false;
    if (!e.expires_at) return true;
    const created = new Date(e.created_at);
    const now = new Date();
    return (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24) > 30;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <ShieldCheck size={24} className="text-brand-400" />
            例外管理
          </h1>
          <p className="text-gray-400 text-sm mt-1">管理权限例外的申请、审批和到期</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={18} className="inline mr-2" />
          新增例外
        </button>
      </div>

      {showCreate && (
        <div className="card">
          <h3 className="font-semibold mb-4">新增例外</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">关联脚本ID</label>
              <input
                type="number"
                value={newExc.script_id}
                onChange={e => setNewExc({ ...newExc, script_id: parseInt(e.target.value, 10) })}
                className="input"
                placeholder="脚本ID"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">到期时间</label>
              <input
                type="date"
                value={newExc.expires_at}
                onChange={e => setNewExc({ ...newExc, expires_at: e.target.value })}
                className="input"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">例外原因</label>
              <textarea
                value={newExc.reason}
                onChange={e => setNewExc({ ...newExc, reason: e.target.value })}
                className="input h-24 resize-none"
                placeholder="说明为什么需要此例外..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">影响范围</label>
              <input
                type="text"
                value={newExc.impact_scope}
                onChange={e => setNewExc({ ...newExc, impact_scope: e.target.value })}
                className="input"
                placeholder="脚本名称或模块"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">风险说明</label>
              <input
                type="text"
                value={newExc.risk_note}
                onChange={e => setNewExc({ ...newExc, risk_note: e.target.value })}
                className="input"
                placeholder="风险备注"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button className="btn-secondary" onClick={() => setShowCreate(false)}>取消</button>
            <button className="btn-primary" onClick={handleCreate}>创建</button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {(['all', 'pending', 'approved', 'rejected', 'expired'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                : 'bg-bg-tertiary text-gray-400 hover:text-gray-200'
            }`}
          >
            {f === 'all' ? '全部' :
             f === 'pending' ? '待审批' :
             f === 'approved' ? '已批准' :
             f === 'rejected' ? '已拒绝' : '已过期'}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700/50">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">状态</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">脚本</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">原因</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">到期</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">风险</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-400 w-32">操作</th>
            </tr>
          </thead>
          <tbody>
            {exceptions.length > 0 ? exceptions.map(e => (
              <tr key={e.id} className="border-b border-gray-700/30 last:border-0">
                <td className="py-3 px-4">
                  <StatusBadge status={e.status} />
                </td>
                <td className="py-3 px-4 text-sm">
                  {e.script_id ? `脚本 #${e.script_id}` : '-'}
                </td>
                <td className="py-3 px-4 text-sm text-gray-300 max-w-xs truncate" title={e.reason}>
                  {e.reason}
                </td>
                <td className="py-3 px-4 text-sm">
                  <div className="flex items-center gap-1 text-gray-400">
                    <Calendar size={14} />
                    {e.expires_at || '永久'}
                  </div>
                </td>
                <td className="py-3 px-4">
                  {isLongRunning(e) && (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <AlertTriangle size={12} />
                      长期有效
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {e.status === 'pending' && (
                      <>
                        <button onClick={() => handleApprove(e.id)} className="p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded transition-colors">
                          <Check size={16} />
                        </button>
                        <button onClick={() => handleReject(e.id)} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded transition-colors">
                          <X size={16} />
                        </button>
                      </>
                    )}
                    <button onClick={() => handleDelete(e.id)} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">暂无例外记录</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
