import { useState } from 'react';
import { Play, Plus, Edit2, Trash2 } from 'lucide-react';
import { useAppStore } from '../store';
import PlanModal from '../components/PlanModal';
import TopologyCanvas from '../components/TopologyCanvas';
import type { DrillPlan } from '../types';

export default function DrillsPage() {
  const plans = useAppStore((s) => s.drillPlans);
  const services = useAppStore((s) => s.services);
  const dependencies = useAppStore((s) => s.dependencies);
  const currentDrill = useAppStore((s) => s.currentDrill);
  const createPlan = useAppStore((s) => s.createPlan);
  const updatePlan = useAppStore((s) => s.updatePlan);
  const startDrill = useAppStore((s) => s.startDrill);
  const setSelectedResult = useAppStore((s) => s.setSelectedResult);

  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DrillPlan | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = plans.find((p) => p.id === selectedPlan);
  const isDrillRunning = currentDrill?.status === 'running' || running;

  const handleSave = async (p: Partial<DrillPlan>) => {
    try {
      setError(null);
      if (editing) {
        await updatePlan(editing.id, p);
      } else {
        await createPlan(p);
      }
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    }
  };

  const handleStart = async (planId: string) => {
    if (!confirm('确定开始演练？这将执行基线测试和故障注入测试。')) return;
    try {
      setError(null);
      setRunning(true);
      const result = await startDrill(planId);
      setSelectedResult(result.id);
      setRunning(false);
    } catch (e: any) {
      setRunning(false);
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
          <div className="loading" style={{ padding: 0, justifyContent: 'flex-start', gap: 12 }}>
            <div className="spinner" />
            <span>演练执行中，请稍候...</span>
          </div>
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h2>演练计划</h2>
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              disabled={isDrillRunning}
            >
              <Plus size={16} /> 新建计划
            </button>
          </div>

          {plans.length === 0 ? (
            <div className="empty">暂无演练计划</div>
          ) : (
            <div>
              {plans.map((p) => (
                <div
                  key={p.id}
                  className={`list-item ${selectedPlan === p.id ? 'active' : ''}`}
                  onClick={() => setSelectedPlan(p.id)}
                >
                  <div>
                    <div className="list-item-title">{p.name}</div>
                    <div className="list-item-desc">
                      {p.description || p.endpoint}
                      <span style={{ marginLeft: 8 }}>
                        故障数: {p.injectedFaults.length}
                      </span>
                    </div>
                  </div>
                  <div className="action-bar">
                    <button
                      className="btn btn-success btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStart(p.id);
                      }}
                      disabled={isDrillRunning}
                    >
                      <Play size={14} /> 执行
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(p);
                        setModalOpen(true);
                      }}
                      disabled={isDrillRunning}
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2>演练预览</h2>
          </div>

          {!plan ? (
            <div className="muted">选择左侧演练计划查看详情</div>
          ) : (
            <div>
              <div className="result-section">
                <h3>基本信息</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div className="muted">接口</div>
                    <div style={{ fontWeight: 500 }}>
                      {plan.method} {plan.endpoint}
                    </div>
                  </div>
                  <div>
                    <div className="muted">故障注入</div>
                    <div>
                      {plan.injectedFaults.length === 0
                        ? '无'
                        : plan.injectedFaults.map((f) => (
                            <span
                              key={f.serviceId}
                              className="badge badge-failed"
                              style={{ marginRight: 4 }}
                            >
                              {f.serviceId}: {f.faultType === 'timeout' ? '超时' : '失败'}
                            </span>
                          ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="result-section">
                <h3>拓扑预览（故障服务高亮）</h3>
                <TopologyCanvas
                  services={services}
                  dependencies={dependencies}
                  injectedFaults={plan.injectedFaults}
                />
              </div>

              {plan.requestBody && Object.keys(plan.requestBody).length > 0 && (
                <div className="result-section">
                  <h3>请求体</h3>
                  <pre className="json-pre">
                    {JSON.stringify(plan.requestBody, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <PlanModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        plan={editing}
        services={services}
      />
    </div>
  );
}
