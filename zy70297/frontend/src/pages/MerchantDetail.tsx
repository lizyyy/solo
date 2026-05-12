import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Merchant, Inspection, RectificationTaskWithSuggestion } from '../types';
import {
  merchantStatusLabels,
  merchantStatusColors,
  problemTypeLabels,
  severityLabels,
  severityColors,
  statusLabels,
  statusColors,
  formatDate,
} from '../utils';

export default function MerchantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<{
    merchant: Merchant;
    inspections: Inspection[];
    tasks: RectificationTaskWithSuggestion[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inspections' | 'tasks'>('inspections');
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [inspectionForm, setInspectionForm] = useState({
    inspector: '',
    inspectionDate: new Date().toISOString().split('T')[0],
    problems: [{ problemType: 'hose', description: '', severity: 'critical' }],
    remarks: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      const result = await api.getMerchant(id!);
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function addProblem() {
    setInspectionForm((prev) => ({
      ...prev,
      problems: [...prev.problems, { problemType: 'hose', description: '', severity: 'critical' }],
    }));
  }

  function removeProblem(index: number) {
    setInspectionForm((prev) => ({
      ...prev,
      problems: prev.problems.filter((_, i) => i !== index),
    }));
  }

  function updateProblem(index: number, field: string, value: string) {
    setInspectionForm((prev) => ({
      ...prev,
      problems: prev.problems.map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      ),
    }));
  }

  async function handleSubmit() {
    if (!id) return;
    
    try {
      setSubmitting(true);
      setError(null);

      await api.createInspection({
        merchantId: id,
        inspector: inspectionForm.inspector,
        inspectionDate: inspectionForm.inspectionDate,
        problems: inspectionForm.problems.filter((p) => p.description.trim()),
        remarks: inspectionForm.remarks,
      });

      setShowInspectionModal(false);
      await loadData();
      
      setInspectionForm({
        inspector: '',
        inspectionDate: new Date().toISOString().split('T')[0],
        problems: [{ problemType: 'hose', description: '', severity: 'critical' }],
        remarks: '',
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="card">加载中...</div>;
  }

  if (error) {
    return (
      <div className="card">
        <div className="alert alert-error">{error}</div>
        <button className="btn btn-primary" onClick={loadData}>
          重试
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { merchant, inspections, tasks } = data;

  return (
    <div>
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="btn btn-outline" onClick={() => navigate('/merchants')}>
              ← 返回列表
            </button>
            <h2 style={{ margin: 0 }}>{merchant.name}</h2>
            <span
              className="badge"
              style={{ background: merchantStatusColors[merchant.currentStatus] }}
            >
              {merchantStatusLabels[merchant.currentStatus]}
            </span>
          </div>
          <button className="btn btn-primary" onClick={() => setShowInspectionModal(true)}>
            + 新增安检
          </button>
        </div>

        <div className="grid grid-2">
          <div>
            <div className="text-sm text-muted mb-2">基本信息</div>
            <div className="mb-2">
              <strong>经营类型：</strong>
              {merchant.businessType}
            </div>
            <div className="mb-2">
              <strong>地址：</strong>
              {merchant.address}
            </div>
            <div className="mb-2">
              <strong>联系人：</strong>
              {merchant.contactPerson} ({merchant.contactPhone})
            </div>
          </div>
          <div>
            <div className="text-sm text-muted mb-2">燃气信息</div>
            <div className="mb-2">
              <strong>燃气供应商：</strong>
              {merchant.gasSupplier}
            </div>
            <div className="mb-2">
              <strong>用气账号：</strong>
              {merchant.accountNo}
            </div>
            <div className="mb-2">
              <strong>档案创建时间：</strong>
              {formatDate(merchant.createdAt)}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="tabs">
          <button
            className={activeTab === 'inspections' ? 'active' : ''}
            onClick={() => setActiveTab('inspections')}
          >
            安检记录 ({inspections.length})
          </button>
          <button
            className={activeTab === 'tasks' ? 'active' : ''}
            onClick={() => setActiveTab('tasks')}
          >
            整改任务 ({tasks.length})
          </button>
        </div>

        {activeTab === 'inspections' && (
          <div>
            {inspections.length === 0 ? (
              <div className="text-muted" style={{ padding: '2rem', textAlign: 'center' }}>
                暂无安检记录
              </div>
            ) : (
              inspections.map((inspection) => (
                <div
                  key={inspection.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div style={{ fontWeight: 500 }}>
                      {formatDate(inspection.inspectionDate)} - {inspection.inspector}
                    </div>
                    <span
                      className="badge"
                      style={{
                        background:
                          inspection.status === 'has_problem' ? '#ef4444' : '#22c55e',
                      }}
                    >
                      {inspection.status === 'has_problem' ? '发现问题' : '安检合格'}
                    </span>
                  </div>
                  {inspection.remarks && (
                    <div className="text-sm text-muted mb-2">
                      <strong>备注：</strong>
                      {inspection.remarks}
                    </div>
                  )}
                  {inspection.problems.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-1">发现问题：</div>
                      {inspection.problems.map((problem) => (
                        <div
                          key={problem.id}
                          style={{
                            background: '#fef2f2',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '4px',
                            marginBottom: '0.5rem',
                          }}
                        >
                          <span
                            className="badge"
                            style={{
                              background: severityColors[problem.severity],
                              marginRight: '0.5rem',
                            }}
                          >
                            {severityLabels[problem.severity]}
                          </span>
                          <span
                            className="badge"
                            style={{
                              background: problem.problemType === 'hose' ? '#dc2626' : problem.problemType === 'alarm' ? '#d97706' : '#2563eb',
                              marginRight: '0.5rem',
                            }}
                          >
                            {problemTypeLabels[problem.problemType]}
                          </span>
                          <span className="text-sm">{problem.description}</span>
                          <span className="text-sm text-muted ml-2">
                            (整改期限：{problem.rectificationDays}天)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div>
            {tasks.length === 0 ? (
              <div className="text-muted" style={{ padding: '2rem', textAlign: 'center' }}>
                暂无整改任务
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>问题类型</th>
                    <th>问题描述</th>
                    <th>状态</th>
                    <th>截止日期</th>
                    <th>当前卡点</th>
                    <th>处理建议</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id}>
                      <td>{problemTypeLabels[task.problemType]}</td>
                      <td className="text-sm text-muted">{task.problemDescription}</td>
                      <td>
                        <span
                          className="badge"
                          style={{ background: statusColors[task.status] }}
                        >
                          {statusLabels[task.status]}
                        </span>
                      </td>
                      <td>{formatDate(task.deadline)}</td>
                      <td className="text-sm">{task.suggestion.currentBlock}</td>
                      <td className="text-sm text-muted">{task.suggestion.suggestion}</td>
                      <td>
                        <Link to={`/tasks/${task.id}`} className="link">
                          查看详情
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {showInspectionModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <h3>新增安检记录</h3>

            <div className="form-group">
              <label>安检员</label>
              <input
                type="text"
                value={inspectionForm.inspector}
                onChange={(e) =>
                  setInspectionForm((prev) => ({ ...prev, inspector: e.target.value }))
                }
                placeholder="请输入安检员姓名"
              />
            </div>

            <div className="form-group">
              <label>安检日期</label>
              <input
                type="date"
                value={inspectionForm.inspectionDate}
                onChange={(e) =>
                  setInspectionForm((prev) => ({ ...prev, inspectionDate: e.target.value }))
                }
              />
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label style={{ fontWeight: 500 }}>发现问题</label>
                <button type="button" className="btn btn-outline" onClick={addProblem}>
                  + 添加问题
                </button>
              </div>
              {inspectionForm.problems.map((problem, index) => (
                <div
                  key={index}
                  style={{
                    background: '#f9fafb',
                    padding: '1rem',
                    borderRadius: '8px',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted">问题 {index + 1}</span>
                    {inspectionForm.problems.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => removeProblem(index)}
                      >
                        删除
                      </button>
                    )}
                  </div>
                  <div className="grid grid-3" style={{ gap: '0.75rem' }}>
                    <div>
                      <select
                        value={problem.problemType}
                        onChange={(e) => updateProblem(index, 'problemType', e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                      >
                        <option value="hose">软管问题</option>
                        <option value="alarm">报警器问题</option>
                        <option value="valve">阀门问题</option>
                      </select>
                    </div>
                    <div>
                      <select
                        value={problem.severity}
                        onChange={(e) => updateProblem(index, 'severity', e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                      >
                        <option value="critical">危急</option>
                        <option value="major">重要</option>
                        <option value="minor">一般</option>
                      </select>
                    </div>
                    <div className="text-sm text-muted" style={{ display: 'flex', alignItems: 'center' }}>
                      整改期限：
                      <strong>
                        {problem.problemType === 'hose'
                          ? '3天'
                          : problem.problemType === 'alarm'
                          ? '5天'
                          : '7天'}
                      </strong>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={problem.description}
                    onChange={(e) => updateProblem(index, 'description', e.target.value)}
                    placeholder="请描述问题详情"
                    style={{
                      width: '100%',
                      marginTop: '0.5rem',
                      padding: '0.5rem',
                      borderRadius: '4px',
                      border: '1px solid #d1d5db',
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="form-group">
              <label>备注</label>
              <textarea
                value={inspectionForm.remarks}
                onChange={(e) =>
                  setInspectionForm((prev) => ({ ...prev, remarks: e.target.value }))
                }
                rows={2}
                placeholder="安检备注（可选）"
              />
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="modal-actions">
              <button
                className="btn btn-outline"
                onClick={() => {
                  setShowInspectionModal(false);
                  setError(null);
                }}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={submitting || !inspectionForm.inspector}
              >
                {submitting ? '提交中...' : '提交安检'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
