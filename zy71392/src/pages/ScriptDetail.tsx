import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileCode, Terminal, Shield, AlertTriangle, RefreshCw, Plus, ChevronRight } from 'lucide-react';
import { api, type Script, type ApiCall, type Permission, type RiskScore } from '@/utils/api';
import StatusBadge from '@/components/StatusBadge';
import RiskBadge from '@/components/RiskBadge';
import { useAppStore } from '@/store/appStore';

export default function ScriptDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const scriptId = parseInt(id || '0', 10);
  const [data, setData] = useState<{
    script: Script;
    api_calls: ApiCall[];
    runtime_logs: Array<{ id: number; content: string; captured_at: string }>;
    permissions: Permission[];
    risk_score?: RiskScore;
  } | null>(null);
  const [logInput, setLogInput] = useState('');
  const [showLogInput, setShowLogInput] = useState(false);
  const [activeTab, setActiveTab] = useState<'source' | 'calls' | 'permissions' | 'logs'>('source');
  const { showToast, setLoading } = useAppStore();

  useEffect(() => {
    load();
  }, [scriptId]);

  async function load() {
    setData(await api.scripts.get(scriptId));
  }

  async function handleReparse() {
    setLoading('parse', true);
    try {
      await api.scripts.parse(scriptId);
      await load();
      showToast('重新解析完成', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoading('parse', false);
    }
  }

  async function handleAddLog() {
    if (!logInput.trim()) return;
    setLoading('log', true);
    try {
      await api.scripts.addRuntimeLog(scriptId, logInput);
      setLogInput('');
      setShowLogInput(false);
      await load();
      showToast('运行日志已添加', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoading('log', false);
    }
  }

  if (!data) return <div className="p-8 text-center text-gray-400">加载中...</div>;

  const tabs = [
    { key: 'source', icon: FileCode, label: '脚本源码' },
    { key: 'calls', icon: Terminal, label: `API调用 (${data.api_calls.length})` },
    { key: 'permissions', icon: Shield, label: `现有权限 (${data.permissions.length})` },
    { key: 'logs', icon: Terminal, label: `运行日志 (${data.runtime_logs.length})` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <button onClick={() => navigate('/scripts')} className="hover:text-gray-200">脚本列表</button>
            <ChevronRight size={14} />
            <span>{data.script.name}</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            {data.script.name}
            <span className="text-xs uppercase px-2 py-1 bg-bg-tertiary rounded">
              {data.script.cloud_platform}
            </span>
            {data.risk_score && <RiskBadge score={data.risk_score.total_score} />}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary" onClick={handleReparse}>
            <RefreshCw size={16} className="inline mr-2" />
            重新解析
          </button>
          <button className="btn-primary" onClick={() => navigate(`/permissions/${scriptId}`)}>
            <Shield size={16} className="inline mr-2" />
            权限推导
          </button>
        </div>
      </div>

      <div className="flex border-b border-gray-700/50">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.key
                ? 'text-brand-400 border-brand-400'
                : 'text-gray-400 border-transparent hover:text-gray-200'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'source' && (
        <div className="card p-0 overflow-hidden">
          <pre className="font-mono text-sm p-4 overflow-auto max-h-[600px]">
            <code>{data.script.content}</code>
          </pre>
        </div>
      )}

      {activeTab === 'calls' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">识别的API调用</h3>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-400">
                静态: {data.api_calls.filter(c => c.source === 'static').length}
              </span>
              <span className="text-gray-400">
                动态: {data.api_calls.filter(c => c.source === 'dynamic').length}
              </span>
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700/50">
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-400">服务</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-400">操作</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-400">来源</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-400">行号</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-400">上下文</th>
              </tr>
            </thead>
            <tbody>
              {data.api_calls.map(c => (
                <tr key={c.id} className="border-b border-gray-700/30 last:border-0">
                  <td className="py-2 px-3 text-sm font-medium">{c.service}</td>
                  <td className="py-2 px-3 text-sm text-gray-300">{c.action}</td>
                  <td className="py-2 px-3"><StatusBadge status={c.source} /></td>
                  <td className="py-2 px-3 text-sm text-gray-400">{c.line_number || '-'}</td>
                  <td className="py-2 px-3 text-sm text-gray-500 truncate max-w-xs" title={c.context}>
                    {c.context || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'permissions' && (
        <div className="card">
          <h3 className="font-semibold mb-4">现有权限策略</h3>
          {data.permissions.length > 0 ? (
            <div className="space-y-2">
              {data.permissions.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg">
                  <span className="font-mono text-sm">{p.service}:{p.action}</span>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm py-4 text-center">未提供现有权限策略</div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">运行日志</h3>
            <button className="btn-secondary text-sm py-1.5" onClick={() => setShowLogInput(!showLogInput)}>
              <Plus size={14} className="inline mr-1" />
              添加日志
            </button>
          </div>

          {showLogInput && (
            <div className="mb-4 p-4 bg-bg-tertiary rounded-lg">
              <textarea
                value={logInput}
                onChange={e => setLogInput(e.target.value)}
                placeholder="粘贴执行脚本时的命令行输出，用于识别动态API调用..."
                className="w-full h-32 bg-bg-primary border border-gray-600 rounded-lg p-3 font-mono text-sm text-gray-200 resize-none focus:outline-none focus:border-brand-500 mb-3"
              />
              <div className="flex justify-end gap-2">
                <button className="btn-secondary text-sm py-1.5" onClick={() => setShowLogInput(false)}>取消</button>
                <button className="btn-primary text-sm py-1.5" onClick={handleAddLog}>确认添加</button>
              </div>
            </div>
          )}

          {data.runtime_logs.length > 0 ? (
            <div className="space-y-3">
              {data.runtime_logs.map(log => (
                <div key={log.id} className="p-4 bg-bg-tertiary rounded-lg">
                  <div className="text-xs text-gray-500 mb-2">{new Date(log.captured_at).toLocaleString('zh-CN')}</div>
                  <pre className="font-mono text-xs text-gray-300 whitespace-pre-wrap">{log.content.slice(0, 500)}</pre>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm py-8 text-center">
              <AlertTriangle size={32} className="mx-auto mb-2 opacity-50" />
              暂无运行日志，添加日志可帮助识别动态API调用
            </div>
          )}
        </div>
      )}
    </div>
  );
}
