import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { RectificationTaskWithSuggestion, StatusChange } from '../types';
import {
  problemTypeLabels,
  severityLabels,
  severityColors,
  statusLabels,
  statusColors,
  priorityLabels,
  priorityColors,
  formatDate,
  formatDateTime,
} from '../utils';

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<{
    task: RectificationTaskWithSuggestion;
    history: StatusChange[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showCutOffModal, setShowCutOffModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  const [scheduleDate, setScheduleDate] = useState('');
  const [handler, setHandler] = useState('');
  const [reviewResult, setReviewResult] = useState<'passed' | 'failed'>('passed');
  const [cutOffReason, setCutOffReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getTask(id!);
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSchedule() {
    if (!id || !scheduleDate || !handler) return;

    try {
      setProcessing(true);
      await api.scheduleReview(id, { reviewDate: scheduleDate, handler });
      setShowScheduleModal(false);
      setSuccess('复查预约成功');
      setTimeout(() => setSuccess(null), 3000);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleReview() {
    if (!id || !handler) return;

    try {
      setProcessing(true);
      const result = await api.completeReview(id, { result: reviewResult, handler });
      setShowReviewModal(false);
      
      if (result.gasCutOffTriggered) {
        setSuccess('复查完成 - 由于连续2次不通过，已自动执行停气');
      } else {
        setSuccess(`复查完成 - ${reviewResult === 'passed' ? '整改通过' : '整改不通过，需重新整改'}`);
      }
      setTimeout(() => setSuccess(null), 5000);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleCutOff() {
    if (!id || !handler || !cutOffReason) return;

    try {
      setProcessing(true);
      await api.cutOffGas(id, { handler, reason: cutOffReason });
      setShowCutOffModal(false);
      setSuccess('已执行停气操作');
      setTimeout(() => setSuccess(null), 3000);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleRestore() {
    if (!id || !handler) return;

    try {
      setProcessing(true);
      await api.restoreGas(id, { handler });
      setShowRestoreModal(false);
      setSuccess('已恢复供气，复查已预约');
      setTimeout(() => setSuccess(null), 3000);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return <div className="card">加载中...</div>;
  }

  if (error && !data) {
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

  const { task, history } = data;

  const canScheduleReview = ['created', 'review_failed'].includes(task.status);
  const canCompleteReview = task.status === 'scheduled_review';
  const canCutOff = task.status !== 'gas_cut_off' && task.status !== 'completed';
  const canRestore = task.status === 'gas_cut_off';

  return (
    <div>
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="btn btn-outline" onClick={() => navigate('/tasks')}>
              ← 返回任务列表
            </button>
            <h2 style={{ margin: 0 }}>整改任务详情</h2>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="grid grid-2 mb-4">
          <div>
            <div className="text-sm text-muted mb-2">基本信息</div>
            <div className="mb-2">
              <strong>商户：</strong>
              <Link to={`/merchants/${task.merchantId}`} className="link">
                {task.merchantName}
              </Link>
            </div>
            <div className="mb-2">
              <strong>问题类型：</strong>
              <span
                className="badge"
                style={{
                  marginLeft: '0.5rem',
                  background:
                    task.problemType === 'hose'
                      ? '#dc2626'
                      : task.problemType === 'alarm'
                      ? '#d97706'
                      : '#2563eb',
                }}
              >
                {problemTypeLabels[task.problemType]}
              </span>
            </div>
            <div className="mb-2">
              <strong>严重程度：</strong>
              <span
                className="badge"
                style={{ marginLeft: '0.5rem', background: severityColors[task.severity] }}
              >
                {severityLabels[task.severity]}
              </span>
            </div>
          </div>
          <div>
            <div className="text-sm text-muted mb-2">状态信息</div>
            <div className="mb-2">
              <strong>当前状态：</strong>
              <span
                className="badge"
                style={{ marginLeft: '0.5rem', background: statusColors[task.status] }}
              >
                {statusLabels[task.status]}
              </span>
            </div>
            <div className="mb-2">
              <strong>整改截止日期：</strong>
              {formatDate(task.deadline)}
            </div>
            {task.reviewScheduledDate && (
              <div className="mb-2">
                <strong>复查预约日期：</strong>
                {formatDate(task.reviewScheduledDate)}
              </div>
            )}
            {task.gasCutOffDate && (
              <div className="mb-2" style={{ color: '#dc2626', fontWeight: 500 }}>
                ⚠️ 停气日期：{formatDate(task.gasCutOffDate)}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            background: '#f9fafb',
            padding: '1rem',
            borderRadius: '8px',
            borderLeft: '3px solid #3b82f6',
          }}
        >
          <strong>问题描述：</strong>
          {task.problemDescription}
        </div>
      </div>

      <div className={`suggestion-box ${task.suggestion.priority}`}>
        <div className="block">
          <span
            className="badge"
            style={{ background: priorityColors[task.suggestion.priority], marginRight: '0.5rem' }}
          >
            {priorityLabels[task.suggestion.priority]}
          </span>
          当前卡点：{task.suggestion.currentBlock}
        </div>
        <div className="text">💡 处理建议：{task.suggestion.suggestion}</div>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 style={{ margin: 0 }}>操作</h2>
        </div>

        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          {canScheduleReview && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setHandler('');
                setScheduleDate('');
                setShowScheduleModal(true);
              }}
            >
              📅 预约复查
            </button>
          )}

          {canCompleteReview && (
            <button
              className="btn btn-success"
              onClick={() => {
                setHandler('');
                setReviewResult('passed');
                setShowReviewModal(true);
              }}
            >
              ✅ 完成复查
            </button>
          )}

          {canCutOff && (
            <button
              className="btn btn-danger"
              onClick={() => {
                setHandler('');
                setCutOffReason('');
                setShowCutOffModal(true);
              }}
            >
              ⛔ 执行停气
            </button>
          )}

          {canRestore && (
            <button
              className="btn btn-success"
              onClick={() => {
                setHandler('');
                setShowRestoreModal(true);
              }}
            >
              🔄 恢复供气
            </button>
          )}
        </div>

        {task.status === 'review_failed' && (
          <div className="alert alert-info mt-4">
            ⚠️ 注意：当前已出现1次复查不通过，再次不通过将自动触发停气
          </div>
        )}

        {task.status === 'gas_cut_off' && (
          <div className="alert alert-error mt-4">
            ⚠️ 该商户已被停气，需确认整改完成后恢复供气
          </div>
        )}
      </div>

      <div className="card">
        <h2>状态变更历史</h2>
        {history.length === 0 ? (
          <div className="text-muted" style={{ padding: '2rem', textAlign: 'center' }}>
            暂无状态变更记录
          </div>
        ) : (
          <div className="timeline">
            {history.map((change) => (
              <div key={change.id} className="timeline-item">
                <div className="date">{formatDateTime(change.timestamp)}</div>
                <div className="operator">
                  {change.operator}
                  {change.fromStatus && (
                    <span style={{ color: '#9ca3af', margin: '0 0.25rem' }}>
                      ({statusLabels[change.fromStatus as keyof typeof statusLabels] || change.fromStatus} →{' '}
                      {statusLabels[change.toStatus as keyof typeof statusLabels] || change.toStatus})
                    </span>
                  )}
                </div>
                <div className="reason">{change.reason}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>📋 业务规则参考</h2>
        <div className="rule-box">
          <h4>整改复查周期</h4>
          <ul>
            <li>
              <span>🔴 软管问题（危急）：</span>
              <strong>3天内整改</strong>
            </li>
            <li>
              <span>🟠 报警器问题（重要）：</span>
              <strong>5天内整改</strong>
            </li>
            <li>
              <span>🔵 阀门问题（一般）：</span>
              <strong>7天内整改</strong>
            </li>
          </ul>
        </div>
        <div className="rule-box">
          <h4>停气触发条件</h4>
          <ul>
            <li>
              <span>自动停气：</span>
              <strong>连续2次复查不通过</strong>
            </li>
            <li>
              <span>手动停气：</span>
              <strong>可根据实际情况随时执行</strong>
            </li>
          </ul>
        </div>
      </div>

      {showScheduleModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>预约复查</h3>
            <div className="form-group">
              <label>复查日期</label>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>复查员</label>
              <input
                type="text"
                value={handler}
                onChange={(e) => setHandler(e.target.value)}
                placeholder="请输入复查员姓名"
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowScheduleModal(false)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSchedule}
                disabled={processing || !scheduleDate || !handler}
              >
                {processing ? '处理中...' : '确认预约'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReviewModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>完成复查</h3>
            <div className="form-group">
              <label>复查结果</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="reviewResult"
                    value="passed"
                    checked={reviewResult === 'passed'}
                    onChange={() => setReviewResult('passed')}
                  />
                  <span style={{ color: '#16a34a', fontWeight: 500 }}>✅ 通过</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="reviewResult"
                    value="failed"
                    checked={reviewResult === 'failed'}
                    onChange={() => setReviewResult('failed')}
                  />
                  <span style={{ color: '#dc2626', fontWeight: 500 }}>❌ 不通过</span>
                </label>
              </div>
            </div>
            {reviewResult === 'failed' && (
              <div className="alert alert-info">
                ⚠️ 提示：第2次复查不通过将自动触发停气
              </div>
            )}
            <div className="form-group">
              <label>复查员</label>
              <input
                type="text"
                value={handler}
                onChange={(e) => setHandler(e.target.value)}
                placeholder="请输入复查员姓名"
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowReviewModal(false)}>
                取消
              </button>
              <button
                className={reviewResult === 'passed' ? 'btn btn-success' : 'btn btn-danger'}
                onClick={handleReview}
                disabled={processing || !handler}
              >
                {processing ? '处理中...' : '确认复查结果'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCutOffModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>执行停气</h3>
            <div className="alert alert-error">
              ⚠️ 停气操作将影响商户正常经营，请确认原因后执行
            </div>
            <div className="form-group">
              <label>操作员</label>
              <input
                type="text"
                value={handler}
                onChange={(e) => setHandler(e.target.value)}
                placeholder="请输入操作员姓名"
              />
            </div>
            <div className="form-group">
              <label>停气原因</label>
              <textarea
                value={cutOffReason}
                onChange={(e) => setCutOffReason(e.target.value)}
                rows={3}
                placeholder="请输入停气原因"
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowCutOffModal(false)}>
                取消
              </button>
              <button
                className="btn btn-danger"
                onClick={handleCutOff}
                disabled={processing || !handler || !cutOffReason}
              >
                {processing ? '处理中...' : '确认停气'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRestoreModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>恢复供气</h3>
            <div className="alert alert-info">
              ℹ️ 恢复供气后将自动预约复查，请确保整改已完成
            </div>
            <div className="form-group">
              <label>操作员</label>
              <input
                type="text"
                value={handler}
                onChange={(e) => setHandler(e.target.value)}
                placeholder="请输入操作员姓名"
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowRestoreModal(false)}>
                取消
              </button>
              <button
                className="btn btn-success"
                onClick={handleRestore}
                disabled={processing || !handler}
              >
                {processing ? '处理中...' : '确认恢复供气'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
