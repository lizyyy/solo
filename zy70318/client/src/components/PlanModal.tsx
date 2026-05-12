import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { DrillPlan, Service, InjectedFault } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (plan: Partial<DrillPlan>) => void;
  plan?: DrillPlan | null;
  services: Service[];
}

const ENDPOINTS = [
  { value: '/api/v1/homepage', label: '首页推荐 GET /api/v1/homepage' },
  { value: '/api/v1/order', label: '下单 POST /api/v1/order' },
  { value: '/api/v1/member/benefits', label: '会员权益 GET /api/v1/member/benefits' },
];

const defaultFault: InjectedFault = {
  serviceId: '',
  faultType: 'timeout',
  timeoutMs: 5000,
  errorRate: 1,
};

export default function PlanModal({ open, onClose, onSave, plan, services }: Props) {
  const [form, setForm] = useState<Partial<DrillPlan>>({
    name: '',
    description: '',
    endpoint: '/api/v1/homepage',
    method: 'GET',
    requestBody: {},
    injectedFaults: [],
  });

  useEffect(() => {
    if (plan) {
      setForm(plan);
    } else {
      setForm({
        name: '',
        description: '',
        endpoint: '/api/v1/homepage',
        method: 'GET',
        requestBody: {},
        injectedFaults: [
          { ...defaultFault, serviceId: services[0]?.id || '' },
        ],
      });
    }
  }, [plan, services, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  const addFault = () => {
    setForm({
      ...form,
      injectedFaults: [...(form.injectedFaults || []), { ...defaultFault }],
    });
  };

  const updateFault = (index: number, updates: Partial<InjectedFault>) => {
    const faults = [...(form.injectedFaults || [])];
    faults[index] = { ...faults[index], ...updates };
    setForm({ ...form, injectedFaults: faults });
  };

  const removeFault = (index: number) => {
    const faults = (form.injectedFaults || []).filter((_, i) => i !== index);
    setForm({ ...form, injectedFaults: faults });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{plan ? '编辑演练计划' : '新建演练计划'}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>演练名称</label>
              <input
                type="text"
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如：首页推荐超时演练"
                required
              />
            </div>

            <div className="form-group">
              <label>描述</label>
              <textarea
                rows={2}
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="演练目的..."
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>目标接口</label>
                <select
                  value={form.endpoint || ''}
                  onChange={(e) => {
                    const endpoint = e.target.value;
                    const method = endpoint === '/api/v1/order' ? 'POST' : 'GET';
                    setForm({ ...form, endpoint, method });
                  }}
                >
                  {ENDPOINTS.map((ep) => (
                    <option key={ep.value} value={ep.value}>
                      {ep.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>HTTP 方法</label>
                <input type="text" value={form.method} readOnly />
              </div>
            </div>

            <div className="form-group">
              <label>请求体 (JSON)</label>
              <textarea
                rows={3}
                value={
                  form.requestBody && Object.keys(form.requestBody).length
                    ? JSON.stringify(form.requestBody, null, 2)
                    : ''
                }
                onChange={(e) => {
                  try {
                    setForm({
                      ...form,
                      requestBody: e.target.value ? JSON.parse(e.target.value) : {},
                    });
                  } catch {}
                }}
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ margin: 0 }}>故障注入</label>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={addFault}
                >
                  <Plus size={14} /> 添加
                </button>
              </div>

              {(form.injectedFaults || []).length === 0 && (
                <div className="muted">未配置故障注入（基线测试）</div>
              )}

              {(form.injectedFaults || []).map((fault, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 12,
                    background: '#f8fafc',
                    borderRadius: 6,
                    marginBottom: 8,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <select
                      style={{ flex: 1, padding: 8, border: '1px solid #e2e8f0', borderRadius: 4 }}
                      value={fault.serviceId}
                      onChange={(e) => updateFault(idx, { serviceId: e.target.value })}
                    >
                      {services
                        .filter((s) => s.id !== 'gateway')
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>

                    <select
                      style={{ flex: 1, padding: 8, border: '1px solid #e2e8f0', borderRadius: 4 }}
                      value={fault.faultType}
                      onChange={(e) =>
                        updateFault(idx, { faultType: e.target.value as any })
                      }
                    >
                      <option value="timeout">超时</option>
                      <option value="failed">失败</option>
                    </select>

                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => removeFault(idx)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {fault.faultType === 'timeout' && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="muted">超时时间：</span>
                      <input
                        type="number"
                        value={fault.timeoutMs || 5000}
                        onChange={(e) =>
                          updateFault(idx, { timeoutMs: parseInt(e.target.value) })
                        }
                        style={{ width: 100, padding: 6, border: '1px solid #e2e8f0', borderRadius: 4 }}
                      />
                      <span className="muted">ms</span>
                      <span className="muted" style={{ marginLeft: 16 }}>错误率：</span>
                      <input
                        type="number"
                        value={fault.errorRate}
                        onChange={(e) =>
                          updateFault(idx, { errorRate: parseFloat(e.target.value) })
                        }
                        min="0"
                        max="1"
                        step="0.1"
                        style={{ width: 80, padding: 6, border: '1px solid #e2e8f0', borderRadius: 4 }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary">
              {plan ? '保存' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
