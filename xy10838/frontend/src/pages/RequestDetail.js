import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [failedItems, setFailedItems] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('basic');

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [reqRes, logsRes, failedRes, receiptRes] = await Promise.all([
        fetch(`/api/requests/${id}`),
        fetch(`/api/requests/${id}/audit-logs`),
        fetch(`/api/failed-items`),
        fetch(`/api/requests/${id}/receipts`).catch(() => ({ json: () => null }))
      ]);

      const reqData = await reqRes.json();
      const logsData = await logsRes.json();
      const failedData = await failedRes.json();
      const receiptData = await receiptRes.json();

      setRequest(reqData);
      setAuditLogs(logsData);
      setFailedItems(failedData.filter(f => f.task_id && reqData.tasks?.some(t => t.id === f.task_id)));
      setReceipt(receiptData);
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus) => {
    try {
      await fetch(`/api/requests/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, actor: '当前用户' })
      });
      fetchData();
    } catch (error) {
      alert('操作失败: ' + error.message);
    }
  };

  const executeTask = async (taskId) => {
    try {
      await fetch(`/api/tasks/${taskId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: '当前用户' })
      });
      fetchData();
    } catch (error) {
      alert('执行失败: ' + error.message);
    }
  };

  const retryTask = async (taskId) => {
    try {
      await fetch(`/api/tasks/${taskId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: '当前用户' })
      });
      fetchData();
    } catch (error) {
      alert('重试失败: ' + error.message);
    }
  };

  const generateReceipt = async () => {
    try {
      await fetch(`/api/requests/${id}/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: '当前用户' })
      });
      fetchData();
    } catch (error) {
      alert('生成回执失败: ' + error.message);
    }
  };

  const getStatusClass = (status) => {
    const map = {
      'DRAFT': 'status-draft',
      'PENDING_APPROVAL': 'status-pending',
      'APPROVED': 'status-approved',
      'EXECUTING': 'status-executing',
      'COMPLETED': 'status-completed',
      'PARTIAL_COMPLETED': 'status-partial',
      'FAILED': 'status-failed'
    };
    return map[status] || 'status-draft';
  };

  const getStatusText = (status) => {
    const map = {
      'DRAFT': '草稿',
      'PENDING_APPROVAL': '待审批',
      'APPROVED': '已批准',
      'EXECUTING': '执行中',
      'COMPLETED': '已完成',
      'PARTIAL_COMPLETED': '部分完成',
      'FAILED': '失败'
    };
    return map[status] || status;
  };

  const getNextActions = () => {
    const actions = [];
    const status = request?.status;
    
    if (status === 'DRAFT') {
      actions.push({ label: '提交审批', action: () => updateStatus('PENDING_APPROVAL'), type: 'primary' });
    }
    if (status === 'PENDING_APPROVAL') {
      actions.push({ label: '批准', action: () => updateStatus('APPROVED'), type: 'success' });
      actions.push({ label: '驳回', action: () => updateStatus('DRAFT'), type: 'warning' });
    }
    if (status === 'COMPLETED' && !receipt) {
      actions.push({ label: '生成回执', action: generateReceipt, type: 'primary' });
    }
    
    return actions;
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (!request) {
    return <div className="card">申请不存在</div>;
  }

  return (
    <div>
      <button className="btn btn-link" onClick={() => navigate('/requests')}>
        ← 返回列表
      </button>

      <div className="card">
        <div className="flex flex-between">
          <div>
            <h2>{request.request_no}</h2>
            <span className={`status-badge ${getStatusClass(request.status)}`}>
              {getStatusText(request.status)}
            </span>
          </div>
          <div className="flex">
            {getNextActions().map((act, idx) => (
              <button key={idx} className={`btn btn-${act.type}`} onClick={act.action}>
                {act.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex" style={{ gap: '24px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
          {['basic', 'tasks', 'audit', 'receipt'].map(tab => (
            <button 
              key={tab}
              className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-link'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'basic' && '基本信息'}
              {tab === 'tasks' && '执行任务'}
              {tab === 'audit' && '审计轨迹'}
              {tab === 'receipt' && '客户回执'}
            </button>
          ))}
        </div>

        {activeTab === 'basic' && (
          <div className="detail-section">
            <div className="form-row">
              <div className="detail-row">
                <span className="detail-label">客户ID</span>
                <span className="detail-value">{request.customer_id}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">客户名称</span>
                <span className="detail-value">{request.customer_name}</span>
              </div>
            </div>
            <div className="detail-row">
              <span className="detail-label">删除原因</span>
              <span className="detail-value">{request.reason}</span>
            </div>
            <div className="form-row">
              <div className="detail-row">
                <span className="detail-label">申请人</span>
                <span className="detail-value">{request.requested_by}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">申请时间</span>
                <span className="detail-value">{new Date(request.requested_at).toLocaleString()}</span>
              </div>
            </div>
            <div className="form-row">
              <div className="detail-row">
                <span className="detail-label">审批人</span>
                <span className="detail-value">{request.approved_by || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">审批时间</span>
                <span className="detail-value">{request.approved_at ? new Date(request.approved_at).toLocaleString() : '-'}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div>
            <table className="table">
              <thead>
                <tr>
                  <th>数据域</th>
                  <th>状态</th>
                  <th>总记录数</th>
                  <th>已处理</th>
                  <th>失败</th>
                  <th>重试次数</th>
                  <th>开始时间</th>
                  <th>完成时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {request.tasks?.map(task => (
                  <tr key={task.id}>
                    <td>{task.domain_name}</td>
                    <td><span className={`status-badge ${getStatusClass(task.status)}`}>{getStatusText(task.status)}</span></td>
                    <td>{task.total_records}</td>
                    <td>{task.processed_records || 0}</td>
                    <td>{task.failed_records || 0}</td>
                    <td>{task.retry_count || 0}</td>
                    <td>{task.started_at ? new Date(task.started_at).toLocaleString() : '-'}</td>
                    <td>{task.completed_at ? new Date(task.completed_at).toLocaleString() : '-'}</td>
                    <td>
                      {['PENDING', 'APPROVED'].includes(task.status) && (
                        <button className="btn btn-sm btn-primary" onClick={() => executeTask(task.id)}>执行</button>
                      )}
                      {['PARTIAL_COMPLETED', 'FAILED'].includes(task.status) && (task.retry_count || 0) < 3 && (
                        <button className="btn btn-sm btn-warning" onClick={() => retryTask(task.id)}>重试</button>
                      )}
                    </td>
                  </tr>
                ))}
                {(!request.tasks || request.tasks.length === 0) && (
                  <tr>
                    <td colSpan={9} className="empty">暂无任务</td>
                  </tr>
                )}
              </tbody>
            </table>

            {failedItems.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <h3>失败记录 ({failedItems.length})</h3>
                <table className="table">
                  <thead>
                    <tr>
                      <th>数据域</th>
                      <th>记录ID</th>
                      <th>错误代码</th>
                      <th>错误信息</th>
                      <th>失败时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedItems.map(item => (
                      <tr key={item.id}>
                        <td>{item.domain_name}</td>
                        <td>{item.record_id}</td>
                        <td>{item.error_code}</td>
                        <td>{item.error_message}</td>
                        <td>{new Date(item.failed_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'audit' && (
          <div>
            <div className="timeline">
              {auditLogs.map(log => (
                <div key={log.id} className="timeline-item">
                  <div className="timeline-time">{new Date(log.created_at).toLocaleString()}</div>
                  <div className="timeline-action">{log.actor} - {log.action}</div>
                  <div className="timeline-details">{log.details}</div>
                  {log.before_state && log.after_state && (
                    <div className="before-after" style={{ marginTop: '12px' }}>
                      <div>
                        <h4>变更前</h4>
                        <div className="before-box code-block">
                          {JSON.stringify(JSON.parse(log.before_state), null, 2)}
                        </div>
                      </div>
                      <div>
                        <h4>变更后</h4>
                        <div className="after-box code-block">
                          {JSON.stringify(JSON.parse(log.after_state), null, 2)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {auditLogs.length === 0 && <div className="empty">暂无审计记录</div>}
            </div>
          </div>
        )}

        {activeTab === 'receipt' && (
          <div>
            {receipt ? (
              <div>
                <div className="detail-row">
                  <span className="detail-label">回执编号</span>
                  <span className="detail-value">{receipt.receipt_no}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">生成时间</span>
                  <span className="detail-value">{new Date(receipt.generated_at).toLocaleString()}</span>
                </div>
                <div style={{ marginTop: '24px' }}>
                  <h3>回执内容</h3>
                  <div className="code-block" style={{ marginTop: '12px' }}>
                    {JSON.stringify(JSON.parse(receipt.content), null, 2)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty" style={{ textAlign: 'center', padding: '40px' }}>
                暂无回执
                {request.status === 'COMPLETED' && (
                  <div style={{ marginTop: '16px' }}>
                    <button className="btn btn-primary" onClick={generateReceipt}>生成回执</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default RequestDetail;
