import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState(null);
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [apiResources, setApiResources] = useState([]);
  const [selectedApi, setSelectedApi] = useState(null);
  const [rejections, setRejections] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [requestLogs, setRequestLogs] = useState([]);
  const [permissionMatrix, setPermissionMatrix] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [requester, setRequester] = useState('demo-user');

  useEffect(() => {
    loadTenants();
    loadApiResources();
  }, []);

  useEffect(() => {
    if (selectedTenant) {
      loadDepartments(selectedTenant.id);
      loadRejections(selectedTenant.id);
      loadApprovals(selectedTenant.id);
      loadRequestLogs(selectedTenant.id);
      loadPermissionMatrix(selectedTenant.id);
    }
  }, [selectedTenant]);

  useEffect(() => {
    if (selectedDept) {
      loadRoles(selectedDept.id);
    }
  }, [selectedDept]);

  useEffect(() => {
    if (selectedRole && selectedDept && selectedTenant) {
      loadPermissions(selectedRole.id, selectedDept.id, selectedTenant.id);
    }
  }, [selectedRole, selectedDept, selectedTenant]);

  const loadTenants = async () => {
    const res = await axios.get(`${API_BASE}/tenants`);
    setTenants(res.data);
    if (res.data.length > 0) setSelectedTenant(res.data[0]);
  };

  const loadDepartments = async (tenantId) => {
    const res = await axios.get(`${API_BASE}/tenants/${tenantId}/departments`);
    setDepartments(res.data);
    if (res.data.length > 0) setSelectedDept(res.data[0]);
  };

  const loadRoles = async (deptId) => {
    const res = await axios.get(`${API_BASE}/departments/${deptId}/roles`);
    setRoles(res.data);
    if (res.data.length > 0) setSelectedRole(res.data[0]);
  };

  const loadApiResources = async () => {
    const res = await axios.get(`${API_BASE}/api-resources`);
    setApiResources(res.data);
    if (res.data.length > 0) setSelectedApi(res.data[0]);
  };

  const loadRejections = async (tenantId) => {
    const res = await axios.get(`${API_BASE}/rejections?tenant_id=${tenantId}&resolved=false`);
    setRejections(res.data);
  };

  const loadApprovals = async (tenantId) => {
    const res = await axios.get(`${API_BASE}/approvals?tenant_id=${tenantId}`);
    setApprovals(res.data);
  };

  const loadRequestLogs = async (tenantId) => {
    const res = await axios.get(`${API_BASE}/request-logs?tenant_id=${tenantId}&limit=50`);
    setRequestLogs(res.data);
  };

  const loadPermissionMatrix = async (tenantId) => {
    const res = await axios.get(`${API_BASE}/tenants/${tenantId}/permission-matrix`);
    setPermissionMatrix(res.data);
  };

  const loadPermissions = async (roleId, deptId, tenantId) => {
    const res = await axios.get(`${API_BASE}/roles/${roleId}/permissions?department_id=${deptId}&tenant_id=${tenantId}`);
    setPermissions(res.data);
  };

  const callApi = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await axios.post(`${API_BASE}/call-api`, {
        tenant_id: selectedTenant.id,
        department_id: selectedDept.id,
        role_id: selectedRole.id,
        api_resource_id: selectedApi.id,
        requester: requester,
        input: { timestamp: new Date().toISOString() }
      });
      setResult(res.data);
      loadRejections(selectedTenant.id);
      loadRequestLogs(selectedTenant.id);
    } catch (err) {
      setResult({ success: false, error: err.message });
    }
    setLoading(false);
  };

  const resolveRejection = async (rejectionId) => {
    await axios.post(`${API_BASE}/rejections/${rejectionId}/resolve`, { resolved_by: requester });
    loadRejections(selectedTenant.id);
  };

  const handleApproval = async (approvalId, action) => {
    await axios.post(`${API_BASE}/approvals/${approvalId}/${action}`, { approver: requester, comment: '系统自动处理' });
    loadApprovals(selectedTenant.id);
  };

  const createApproval = async (type) => {
    await axios.post(`${API_BASE}/approvals`, {
      tenant_id: selectedTenant.id,
      department_id: selectedDept.id,
      role_id: selectedRole.id,
      requester: requester,
      request_type: type,
      request_data: { reason: '测试审批流程' }
    });
    loadApprovals(selectedTenant.id);
  };

  const exportMatrix = () => {
    window.open(`${API_BASE}/tenants/${selectedTenant.id}/permission-matrix/export`, '_blank');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'SUCCESS': return '#52c41a';
      case 'REJECTED': return '#ff4d4f';
      case 'ERROR': return '#fa8c16';
      case 'pending': return '#faad14';
      case 'approved': return '#52c41a';
      case 'rejected': return '#ff4d4f';
      default: return '#8c8c8c';
    }
  };

  const tabs = [
    { key: 'dashboard', label: '控制台' },
    { key: 'rejections', label: `异常队列 (${rejections.length})` },
    { key: 'approvals', label: '审批流程' },
    { key: 'logs', label: '历史轨迹' },
    { key: 'matrix', label: '权限矩阵' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <header style={{ background: '#001529', color: '#fff', padding: '0 24px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px', fontWeight: 'bold' }}>🔐 多租户 API 权限矩阵</span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={exportMatrix} style={{ padding: '8px 16px', background: '#1890ff', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}>
            📥 导出矩阵
          </button>
        </div>
      </header>

      <nav style={{ background: '#fff', borderBottom: '1px solid #e8e8e8', padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 20px',
                border: 'none',
                background: activeTab === tab.key ? '#e6f7ff' : 'transparent',
                color: activeTab === tab.key ? '#1890ff' : '#666',
                cursor: 'pointer',
                borderBottom: activeTab === tab.key ? '2px solid #1890ff' : '2px solid transparent'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main style={{ padding: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontSize: '14px' }}>租户</label>
            <select
              value={selectedTenant?.id || ''}
              onChange={(e) => setSelectedTenant(tenants.find(t => t.id === e.target.value))}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: '4px' }}
            >
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div style={{ minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontSize: '14px' }}>部门</label>
            <select
              value={selectedDept?.id || ''}
              onChange={(e) => setSelectedDept(departments.find(d => d.id === e.target.value))}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: '4px' }}
            >
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div style={{ minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontSize: '14px' }}>角色</label>
            <select
              value={selectedRole?.id || ''}
              onChange={(e) => setSelectedRole(roles.find(r => r.id === e.target.value))}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: '4px' }}
            >
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div style={{ minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontSize: '14px' }}>API 接口</label>
            <select
              value={selectedApi?.id || ''}
              onChange={(e) => setSelectedApi(apiResources.find(a => a.id === e.target.value))}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: '4px' }}
            >
              {apiResources.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div style={{ minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontSize: '14px' }}>请求用户</label>
            <input
              value={requester}
              onChange={(e) => setRequester(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: '4px' }}
            />
          </div>
        </div>

        {activeTab === 'dashboard' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginBottom: '20px', color: '#262626' }}>API 调用测试</h3>
              
              <div style={{ marginBottom: '20px', padding: '16px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '4px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>当前角色权限:</div>
                {permissions.length === 0 ? (
                  <span style={{ color: '#666' }}>暂无权限数据</span>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {permissions.map(p => (
                      <span key={p.id} style={{
                        padding: '4px 12px',
                        background: p.inherited ? '#fffbe6' : '#e6f7ff',
                        border: `1px solid ${p.inherited ? '#ffe58f' : '#91d5ff'}`,
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        {p.name} ({p.access_level}) {p.inherited && '👴 继承'}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <button
                  onClick={callApi}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    background: '#1890ff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '16px'
                  }}
                >
                  {loading ? '执行中...' : '🚀 执行 API 调用'}
                </button>
              </div>

              {result && (
                <div style={{
                  padding: '16px',
                  background: result.success ? '#f6ffed' : '#fff2f0',
                  border: `1px solid ${result.success ? '#b7eb8f' : '#ffccc7'}`,
                  borderRadius: '4px'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '8px', color: result.success ? '#52c41a' : '#ff4d4f' }}>
                    {result.success ? '✅ 调用成功' : '❌ 调用失败'}
                  </div>
                  <pre style={{ fontSize: '12px', overflow: 'auto', maxHeight: '200px', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}

              <div style={{ marginTop: '20px', padding: '16px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: '4px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>🧪 测试场景</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <button onClick={() => { setSelectedRole(roles.find(r => r.name === '后端开发工程师')); setSelectedApi(apiResources.find(a => a.name === '用户列表查询')); }} style={{ padding: '8px 16px', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer', background: '#fff' }}>场景1: 成功调用</button>
                  <button onClick={() => { setSelectedRole(roles.find(r => r.name === '后端开发工程师')); setSelectedApi(apiResources.find(a => a.name === '财务报表')); }} style={{ padding: '8px 16px', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer', background: '#fff' }}>场景2: 无权限(拒绝)</button>
                  <button onClick={() => createApproval('PERMISSION_REQUEST')} style={{ padding: '8px 16px', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer', background: '#fff' }}>场景3: 提交审批</button>
                </div>
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginBottom: '20px', color: '#262626' }}>系统概览</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '20px', background: '#e6f7ff', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1890ff' }}>{rejections.filter(r => !r.resolved).length}</div>
                  <div style={{ color: '#666', fontSize: '14px' }}>待处理异常</div>
                </div>
                <div style={{ padding: '20px', background: '#fff7e6', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#fa8c16' }}>{approvals.filter(a => a.status === 'pending').length}</div>
                  <div style={{ color: '#666', fontSize: '14px' }}>待审批</div>
                </div>
                <div style={{ padding: '20px', background: '#f6ffed', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#52c41a' }}>{requestLogs.filter(l => l.status === 'SUCCESS').length}</div>
                  <div style={{ color: '#666', fontSize: '14px' }}>成功调用</div>
                </div>
                <div style={{ padding: '20px', background: '#fff1f0', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ff4d4f' }}>{apiResources.length}</div>
                  <div style={{ color: '#666', fontSize: '14px' }}>API 资源</div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ marginBottom: '12px', color: '#262626' }}>最近调用记录</h4>
                <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                  {requestLogs.slice(0, 5).map(log => (
                    <div key={log.id} style={{
                      padding: '12px',
                      borderBottom: '1px solid #f0f0f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{log.requester}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>{new Date(log.created_at).toLocaleString()}</div>
                      </div>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#fff',
                        background: getStatusColor(log.status)
                      }}>
                        {log.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rejections' && (
          <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: '#262626' }}>⚠️ 调用异常队列</h3>
              <span style={{ padding: '4px 12px', background: '#fff2f0', color: '#ff4d4f', borderRadius: '4px' }}>
                {rejections.filter(r => !r.resolved).length} 条待处理
              </span>
            </div>

            {rejections.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无异常记录</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>时间</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>请求者</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>拒绝类型</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>原因</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>状态</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rejections.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '12px' }}>{new Date(r.created_at).toLocaleString()}</td>
                        <td style={{ padding: '12px' }}>{r.requester}</td>
                        <td style={{ padding: '12px' }}>{r.rejection_type}</td>
                        <td style={{ padding: '12px' }}>{r.reason}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#fff',
                            background: r.resolved ? '#52c41a' : '#ff4d4f'
                          }}>
                            {r.resolved ? '已处理' : '待处理'}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          {!r.resolved && (
                            <button
                              onClick={() => resolveRejection(r.id)}
                              style={{ padding: '6px 12px', background: '#52c41a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              ✅ 人工修正
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'approvals' && (
          <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: '#262626' }}>📋 审批流程</h3>
              <button onClick={() => createApproval('PERMISSION_REQUEST')} style={{ padding: '8px 16px', background: '#1890ff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                + 新建审批
              </button>
            </div>

            {approvals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无审批记录</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>提交时间</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>请求者</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>请求类型</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>审批人</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>状态</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvals.map(a => (
                      <tr key={a.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '12px' }}>{new Date(a.created_at).toLocaleString()}</td>
                        <td style={{ padding: '12px' }}>{a.requester}</td>
                        <td style={{ padding: '12px' }}>{a.request_type}</td>
                        <td style={{ padding: '12px' }}>{a.approver || '-'}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#fff',
                            background: getStatusColor(a.status)
                          }}>
                            {a.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          {a.status === 'pending' && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => handleApproval(a.id, 'approve')} style={{ padding: '6px 12px', background: '#52c41a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>✅ 通过</button>
                              <button onClick={() => handleApproval(a.id, 'reject')} style={{ padding: '6px 12px', background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>❌ 拒绝</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: '#262626' }}>📜 历史调用轨迹</h3>
              <button onClick={() => loadRequestLogs(selectedTenant.id)} style={{ padding: '8px 16px', border: '1px solid #d9d9d9', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>
                🔄 刷新
              </button>
            </div>

            {requestLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无调用记录</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>时间</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>请求者</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>责任节点</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>状态</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>错误信息</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requestLogs.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '12px' }}>{new Date(log.created_at).toLocaleString()}</td>
                        <td style={{ padding: '12px' }}>{log.requester}</td>
                        <td style={{ padding: '12px' }}><code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: '2px' }}>{log.responsible_node}</code></td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#fff',
                            background: getStatusColor(log.status)
                          }}>
                            {log.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: '#ff4d4f' }}>{log.error_message || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'matrix' && (
          <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: '#262626' }}>🔧 权限矩阵</h3>
              <button onClick={exportMatrix} style={{ padding: '8px 16px', background: '#52c41a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                📥 导出 CSV
              </button>
            </div>

            <div style={{ marginBottom: '20px', padding: '16px', background: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: '4px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>📋 权限继承规则说明:</div>
              <ul style={{ marginLeft: '20px', color: '#666' }}>
                <li>子部门自动继承上级部门角色的可继承权限</li>
                <li>标记为 "不可继承" 的权限包仅对当前部门生效</li>
                <li>权限级别: read (只读) → write (读写) → admin (管理)</li>
                <li>高级别权限包含低级别权限能力</li>
              </ul>
            </div>

            {permissionMatrix.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无权限数据</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>部门</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>角色</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>权限包</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>可继承</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>API 接口</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>方法</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>权限级别</th>
                    </tr>
                  </thead>
                  <tbody>
                    {permissionMatrix.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '12px' }}>{row.department_name}</td>
                        <td style={{ padding: '12px' }}>{row.role_name}</td>
                        <td style={{ padding: '12px' }}>{row.package_name}</td>
                        <td style={{ padding: '12px' }}>
                          {row.is_inheritable ? (
                            <span style={{ color: '#52c41a' }}>✅ 是</span>
                          ) : (
                            <span style={{ color: '#faad14' }}>❌ 否</span>
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>{row.api_name}</td>
                        <td style={{ padding: '12px' }}><code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: '2px' }}>{row.api_method}</code></td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#fff',
                            background: row.access_level === 'admin' ? '#722ed1' : row.access_level === 'write' ? '#1890ff' : '#52c41a'
                          }}>
                            {row.access_level}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
