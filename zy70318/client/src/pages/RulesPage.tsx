import { useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useAppStore } from '../store';
import RuleModal from '../components/RuleModal';
import type { DegradeRule } from '../types';

export default function RulesPage() {
  const rules = useAppStore((s) => s.rules);
  const services = useAppStore((s) => s.services);
  const createRule = useAppStore((s) => s.createRule);
  const updateRule = useAppStore((s) => s.updateRule);
  const deleteRule = useAppStore((s) => s.deleteRule);
  const currentDrill = useAppStore((s) => s.currentDrill);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DegradeRule | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDrillRunning = currentDrill?.status === 'running';

  const getServiceName = (id: string) => services.find((s) => s.id === id)?.name || id;

  const handleSave = async (rule: Partial<DegradeRule>) => {
    try {
      setError(null);
      if (editing) {
        await updateRule(editing.id, rule);
      } else {
        await createRule(rule);
      }
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此降级规则？')) return;
    try {
      await deleteRule(id);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    }
  };

  return (
    <div>
      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      {isDrillRunning && (
        <div className="alert alert-warning">
          ⚠️ 演练进行中，降级规则处于只读状态
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>降级规则</h2>
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            disabled={isDrillRunning}
          >
            <Plus size={16} /> 新建规则
          </button>
        </div>

        <div className="alert alert-info">
          规则优先级：核心接口不能静默降级（必须有规则或阻断）；演练期间禁止修改规则；缓存过期时核心接口会自动阻断。
        </div>

        {rules.length === 0 ? (
          <div className="empty">暂无降级规则</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>规则名称</th>
                <th>目标服务</th>
                <th>降级动作</th>
                <th>触发条件</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{rule.name}</div>
                    <div className="muted">{rule.description}</div>
                  </td>
                  <td>{getServiceName(rule.targetService)}</td>
                  <td>
                    <span
                      className={`badge badge-${
                        rule.action === 'block'
                          ? 'block'
                          : rule.action === 'cache'
                          ? 'cache'
                          : rule.action === 'fallback'
                          ? 'fallback'
                          : 'disabled'
                      }`}
                    >
                      {rule.action === 'cache'
                        ? '返回缓存'
                        : rule.action === 'fallback'
                        ? '返回兜底值'
                        : rule.action === 'block'
                        ? '阻断请求'
                        : '不降级'}
                    </span>
                  </td>
                  <td>
                    {rule.conditions.status
                      .map((s) => (s === 'timeout' ? '超时' : '失败'))
                      .join(', ')}
                  </td>
                  <td>
                    <span className={rule.enabled ? 'badge badge-enabled' : 'badge badge-disabled'}>
                      {rule.enabled ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td>
                    <div className="action-bar">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setEditing(rule);
                          setModalOpen(true);
                        }}
                        disabled={isDrillRunning}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDelete(rule.id)}
                        disabled={isDrillRunning}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <RuleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        rule={editing}
        services={services}
      />
    </div>
  );
}
