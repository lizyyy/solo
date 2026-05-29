import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileCode, Trash2, Eye } from 'lucide-react';
import { api, type Script } from '@/utils/api';
import RiskBadge from '@/components/RiskBadge';
import { useAppStore } from '@/store/appStore';

export default function ScriptList() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const { showToast, setLoading } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setScripts(await api.scripts.list());
  }

  async function handleDelete(id: number) {
    if (!confirm('确定删除此脚本？')) return;
    setLoading('delete', true);
    try {
      await api.scripts.delete(id);
      showToast('删除成功', 'success');
      load();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoading('delete', false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">脚本列表</h1>
          <p className="text-gray-400 text-sm mt-1">所有已导入的脚本</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/import')}>
          + 导入脚本
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700/50">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">脚本名称</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">云平台</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">API调用</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">风险</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">导入时间</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">操作</th>
            </tr>
          </thead>
          <tbody>
            {scripts.length > 0 ? (
              scripts.map(s => (
                <tr key={s.id} className="border-b border-gray-700/30 last:border-0 hover:bg-bg-tertiary/30">
                  <td className="py-3 px-4">
                    <button onClick={() => navigate(`/scripts/${s.id}`)} className="flex items-center gap-2 hover:text-brand-400 transition-colors">
                      <FileCode size={16} className="text-gray-400" />
                      <span className="font-medium">{s.name}</span>
                    </button>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-400 uppercase">{s.cloud_platform}</td>
                  <td className="py-3 px-4 text-sm">{s.api_call_count || 0}</td>
                  <td className="py-3 px-4"><RiskBadge score={s.risk_score || 0} size="sm" /></td>
                  <td className="py-3 px-4 text-sm text-gray-400">{new Date(s.created_at).toLocaleDateString('zh-CN')}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => navigate(`/scripts/${s.id}`)} className="p-1.5 hover:bg-bg-tertiary rounded transition-colors">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">暂无脚本，请先导入</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
