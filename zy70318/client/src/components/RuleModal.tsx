import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { DegradeRule, Service } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (rule: Partial<DegradeRule>) => void;
  rule?: DegradeRule | null;
  services: Service[];
}

const ACTIONS = [
  { value: 'cache', label: '返回旧缓存' },
  { value: 'fallback', label: '返回兜底值' },
  { value: 'block', label: '阻断请求' },
  { value: 'no_degrade', label: '不降级（静默）' },
];

const STATUSES = ['timeout', 'failed'];

export default function RuleModal({ open, onClose, onSave, rule, services }: Props) {
  const [form, setForm] = useState<Partial<DegradeRule>>({
    name: '',
    targetService: '',
    action: 'fallback',
    enabled: true,
    priority: 1,
    description: '',
    conditions: { status: ['timeout', 'failed'] },
    fallbackData: null,
    cacheExpireSeconds: 300,
  });

  useEffect(() => {
    if (rule) {
      setForm(rule);
    } else {
      setForm({
        name: '',
        targetService: services[0]?.id || '',
        action: 'fallback',
        enabled: true,
        priority: 1,
        description: '',
        conditions: { status: ['timeout', 'failed'] },
        fallbackData: null,
        cacheExpireSeconds: 300,
      });
    }
  }, [rule, services, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  const handleStatusToggle = (status: string) => {
    const current = form.conditions?.status || [];
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    setForm({ ...form, conditions: { status: updated } });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{rule ? '编辑降级规则' : '新建降级规则'}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>规则名称</label>
              <input
                type="text"
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如：推荐服务超时降级"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>目标服务</label>
                <select
                  value={form.targetService || ''}
                  onChange={(e) => setForm({ ...form, targetService: e.target.value })}
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.role === 'core' ? '(核心)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>降级动作</label>
                <select
                  value={form.action || 'fallback'}
                  onChange={(e) =>
                    setForm({ ...form, action: e.target.value as any })
                  }
                >
                  {ACTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>触发条件（服务状态）</label>
              <div style={{ display: 'flex', gap: 12 }}>
                {STATUSES.map((s) => (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={form.conditions?.status?.includes(s)}
                      onChange={() => handleStatusToggle(s)}
                    />
                    {s === 'timeout' ? '超时' : '失败'}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>优先级</label>
                <input
                  type="number"
                  value={form.priority || 1}
                  onChange={(e) =>
                    setForm({ ...form, priority: parseInt(e.target.value) })
                  }
                  min="1"
                />
              </div>

              <div className="form-group">
                <label>缓存过期（秒）</label>
                <input
                  type="number"
                  value={form.cacheExpireSeconds || 300}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      cacheExpireSeconds: parseInt(e.target.value),
                    })
                  }
                  min="0"
                />
              </div>
            </div>

            {(form.action === 'fallback' || form.action === 'cache') && (
              <div className="form-group">
                <label>
                  {form.action === 'fallback' ? '兜底数据 (JSON)' : '默认缓存数据 (JSON)'}
                </label>
                <textarea
                  rows={4}
                  value={
                    form.fallbackData
                      ? JSON.stringify(form.fallbackData, null, 2)
                      : ''
                  }
                  onChange={(e) => {
                    try {
                      setForm({
                        ...form,
                        fallbackData: e.target.value
                          ? JSON.parse(e.target.value)
                          : null,
                      });
                    } catch {}
                  }}
                  placeholder='{"value": "兜底值"}'
                />
              </div>
            )}

            <div className="form-group">
              <label>描述</label>
              <textarea
                rows={2}
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="规则描述..."
              />
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id="enabled"
                checked={form.enabled ?? true}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              <label htmlFor="enabled" style={{ margin: 0 }}>
                启用规则
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary">
              {rule ? '保存' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
