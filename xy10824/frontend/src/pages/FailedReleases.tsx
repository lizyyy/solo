import React, { useState, useEffect } from 'react';
import { adminApi, reservationApi } from '../api/client';
import type { CompensationAction } from '../api/client';

const FailedReleases: React.FC = () => {
  const [failedReleases, setFailedReleases] = useState<any[]>([]);
  const [compensationActions, setCompensationActions] = useState<CompensationAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchFailedReleases = async () => {
    try {
      const res = await adminApi.getFailedReleases();
      setFailedReleases(res.data);
    } catch (error) {
      console.error('Failed to fetch failed releases:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompensationActions = async () => {
    try {
      const res = await adminApi.getCompensationActions();
      setCompensationActions(res.data);
    } catch (error) {
      console.error('Failed to fetch compensation actions:', error);
    }
  };

  useEffect(() => {
    fetchFailedReleases();
    fetchCompensationActions();
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCompensate = async (id: string) => {
    try {
      await reservationApi.compensate(id, { operator: 'admin' });
      showMessage('success', '补偿成功');
      fetchFailedReleases();
      fetchCompensationActions();
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || '补偿失败');
    }
  };

  const handleProcessTimeouts = async () => {
    try {
      const res = await adminApi.processTimeouts();
      showMessage('success', `成功处理 ${res.data.processed} 个超时任务`);
      fetchFailedReleases();
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || '处理失败');
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem' }}>异常释放管理</h2>

      {message && (
        <div className={message.type === 'success' ? 'success-message' : 'error-message'}>
          {message.text}
        </div>
      )}

      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>释放失败的预占单</h3>
          <button className="btn btn-warning" onClick={handleProcessTimeouts}>
            处理超时任务
          </button>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>订单号</th>
                <th>库存池</th>
                <th>数量</th>
                <th>状态</th>
                <th>失败原因</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {failedReleases.map((reservation) => (
                <tr key={reservation.reservation_id} className="failed-release">
                  <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {reservation.order_id}
                  </td>
                  <td>{reservation.pool_id}</td>
                  <td>{reservation.quantity}</td>
                  <td>
                    <span className={`status-badge status-${reservation.status}`}>
                      {reservation.status}
                    </span>
                  </td>
                  <td style={{ maxWidth: '300px', color: '#c62828' }}>
                    {reservation.task_error || reservation.compensation_error || '未知错误'}
                  </td>
                  <td>{new Date(reservation.updated_at).toLocaleString('zh-CN')}</td>
                  <td>
                    <button
                      className="btn btn-small btn-danger"
                      onClick={() => handleCompensate(reservation.reservation_id)}
                    >
                      手动补偿
                    </button>
                  </td>
                </tr>
              ))}
              {failedReleases.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#2e7d32' }}>
                    ✅ 暂无释放失败的预占单
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <h3>补偿操作记录</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>操作ID</th>
                <th>预占单ID</th>
                <th>操作类型</th>
                <th>状态</th>
                <th>操作人</th>
                <th>错误信息</th>
                <th>创建时间</th>
                <th>执行时间</th>
              </tr>
            </thead>
            <tbody>
              {compensationActions.map((action) => (
                <tr key={action.action_id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {action.action_id.slice(0, 12)}...
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {action.reservation_id.slice(0, 12)}...
                  </td>
                  <td>{action.action_type}</td>
                  <td>
                    <span className={`status-badge status-${action.action_status === 'SUCCESS' ? 'CONFIRMED' : 'RELEASE_FAILED'}`}>
                      {action.action_status}
                    </span>
                  </td>
                  <td>{action.executed_by}</td>
                  <td style={{ maxWidth: '200px', color: '#c62828' }}>
                    {action.error_message || '-'}
                  </td>
                  <td>{new Date(action.created_at).toLocaleString('zh-CN')}</td>
                  <td>{action.executed_at ? new Date(action.executed_at).toLocaleString('zh-CN') : '-'}</td>
                </tr>
              ))}
              {compensationActions.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                    暂无补偿操作记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <div className="card" style={{ maxWidth: '600px' }}>
          <h3>异常处理说明</h3>
          <ul style={{ marginTop: '1rem', color: '#555', lineHeight: '1.8' }}>
            <li>
              <strong>释放失败状态</strong>：预占单在释放过程中遇到异常（如数据库错误、网络问题等）
            </li>
            <li>
              <strong>自动重试</strong>：系统会自动重试最多 3 次，重试失败后进入释放失败状态
            </li>
            <li>
              <strong>手动补偿</strong>：运营人员可点击"手动补偿"按钮强制释放库存
            </li>
            <li>
              <strong>处理超时</strong>：批量扫描并处理所有已过期但未释放的预占单
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FailedReleases;