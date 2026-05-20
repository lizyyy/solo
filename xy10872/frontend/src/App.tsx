import { useState, useEffect } from 'react';
import { ResetRequest, ResetStatus, RecoveryLog, RetainedFile, ExportReport } from './types';
import { resetRequestsApi, setUserRole, getUserRole, UserRole } from './services/api';
import StatusBadge from './components/StatusBadge';
import RequestDetailModal from './components/RequestDetailModal';
import CreateRequestModal from './components/CreateRequestModal';

function App() {
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<ResetRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [logs, setLogs] = useState<RecoveryLog[]>([]);
  const [retainedFiles, setRetainedFiles] = useState<RetainedFile[]>([]);
  const [exportReport, setExportReport] = useState<ExportReport | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>(getUserRole());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const data = await resetRequestsApi.getAll();
      setRequests(data);
    } catch (error) {
      console.error('Failed to load requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const initSampleData = async () => {
    try {
      await resetRequestsApi.initSampleData();
      await loadRequests();
    } catch (error) {
      console.error('Failed to init sample data:', error);
    }
  };

  const handleViewDetail = async (request: ResetRequest) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
    
    try {
      const [logsData, filesData, reportData] = await Promise.all([
        resetRequestsApi.getLogs(request.id),
        resetRequestsApi.getRetainedFiles(request.id),
        resetRequestsApi.exportReport(request.id)
      ]);
      setLogs(logsData);
      setRetainedFiles(filesData);
      setExportReport(reportData);
    } catch (error) {
      console.error('Failed to load details:', error);
    }
  };

  const handleStatusUpdate = async (status: ResetStatus, reason: string) => {
    if (!selectedRequest) return;
    
    try {
      setErrorMessage(null);
      await resetRequestsApi.updateStatus(selectedRequest.id, {
        status,
        status_reason: reason,
        approved_by: 'System'
      });
      await loadRequests();
      await handleViewDetail({ ...selectedRequest, status });
    } catch (error: any) {
      const msg = error.response?.data?.detail || '状态更新失败';
      setErrorMessage(msg);
      console.error('Failed to update status:', error);
    }
  };

  const handleCreateRequest = async (data: any) => {
    try {
      setErrorMessage(null);
      await resetRequestsApi.create(data);
      await loadRequests();
      setShowCreateModal(false);
    } catch (error: any) {
      const msg = error.response?.data?.detail || '创建申请失败';
      setErrorMessage(msg);
      console.error('Failed to create request:', error);
    }
  };

  const handleRoleChange = (role: UserRole) => {
    setUserRole(role);
    setCurrentRole(role);
    setErrorMessage(null);
  };

  const filteredRequests = activeTab === 'all' 
    ? requests 
    : requests.filter(r => r.status === activeTab);

  const abnormalRequests = requests.filter(r => 
    [ResetStatus.FAILED, ResetStatus.BLOCKED, ResetStatus.PENDING].includes(r.status)
  );

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>🔄 实验环境重置系统</h1>
            <p>一键恢复学员实验环境，保护提交文件不丢失</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px' }}>当前角色:</span>
            <select
              value={currentRole}
              onChange={(e) => handleRoleChange(e.target.value as UserRole)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="student">学生</option>
              <option value="assistant">助教</option>
              <option value="teacher">教师</option>
              <option value="admin">管理员</option>
            </select>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="alert alert-error">
          <span>❌</span>
          <div>
            <strong>操作失败</strong>
            <p>{errorMessage}</p>
          </div>
          <button 
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '18px' }}
            onClick={() => setErrorMessage(null)}
          >
            ×
          </button>
        </div>
      )}

      {requests.length === 0 && (
        <div className="alert alert-info">
          <span>📝</span>
          <div>
            <strong>欢迎使用实验环境重置系统</strong>
            <p>当前暂无数据，请点击下方按钮初始化样例数据</p>
            <button 
              className="btn btn-primary" 
              style={{ marginTop: '12px' }}
              onClick={initSampleData}
            >
              初始化样例数据
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>
            ⚠️ 异常队列 
            {abnormalRequests.length > 0 && (
              <span className="badge badge-danger" style={{ marginLeft: '8px' }}>
                {abnormalRequests.length}
              </span>
            )}
          </h2>
        </div>
        
        {abnormalRequests.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>所有重置申请处理正常</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>实验空间</th>
                <th>申请人</th>
                <th>状态</th>
                <th>原因</th>
                <th>申请时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {abnormalRequests.map(request => (
                <tr key={request.id}>
                  <td>#{request.id}</td>
                  <td>Lab #{request.lab_space_id}</td>
                  <td>{request.requested_by_name}</td>
                  <td><StatusBadge status={request.status} /></td>
                  <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {request.reason || '-'}
                  </td>
                  <td>{new Date(request.created_at).toLocaleString('zh-CN')}</td>
                  <td>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => handleViewDetail(request)}
                    >
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>📋 重置申请列表</h2>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            + 新建申请
          </button>
        </div>

        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            全部 ({requests.length})
          </button>
          <button 
            className={`tab ${activeTab === ResetStatus.PENDING ? 'active' : ''}`}
            onClick={() => setActiveTab(ResetStatus.PENDING)}
          >
            待审批 ({requests.filter(r => r.status === ResetStatus.PENDING).length})
          </button>
          <button 
            className={`tab ${activeTab === ResetStatus.PROCESSING ? 'active' : ''}`}
            onClick={() => setActiveTab(ResetStatus.PROCESSING)}
          >
            处理中 ({requests.filter(r => r.status === ResetStatus.PROCESSING).length})
          </button>
          <button 
            className={`tab ${activeTab === ResetStatus.SUCCESS ? 'active' : ''}`}
            onClick={() => setActiveTab(ResetStatus.SUCCESS)}
          >
            已成功 ({requests.filter(r => r.status === ResetStatus.SUCCESS).length})
          </button>
          <button 
            className={`tab ${activeTab === ResetStatus.BLOCKED ? 'active' : ''}`}
            onClick={() => setActiveTab(ResetStatus.BLOCKED)}
          >
            已拦截 ({requests.filter(r => r.status === ResetStatus.BLOCKED).length})
          </button>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>实验空间</th>
              <th>申请人</th>
              <th>状态</th>
              <th>申请原因</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map(request => (
              <tr key={request.id}>
                <td>#{request.id}</td>
                <td>Lab #{request.lab_space_id}</td>
                <td>{request.requested_by_name}</td>
                <td><StatusBadge status={request.status} /></td>
                <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {request.reason || '-'}
                </td>
                <td>{new Date(request.created_at).toLocaleString('zh-CN')}</td>
                <td>
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => handleViewDetail(request)}
                  >
                    查看详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDetailModal && selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          logs={logs}
          retainedFiles={retainedFiles}
          exportReport={exportReport}
          onClose={() => setShowDetailModal(false)}
          onStatusUpdate={handleStatusUpdate}
        />
      )}

      {showCreateModal && (
        <CreateRequestModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateRequest}
        />
      )}
    </div>
  );
}

export default App;