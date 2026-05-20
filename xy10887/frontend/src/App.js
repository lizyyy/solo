import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

const api = axios.create({ baseURL: API_BASE });

function App() {
  const [activeTab, setActiveTab] = useState('patient-status');
  const [templates, setTemplates] = useState([]);
  const [patientId, setPatientId] = useState('P001');
  const [patientStatus, setPatientStatus] = useState(null);
  const [resignTasks, setResignTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadTemplates();
    loadResignTasks();
  }, []);

  const loadTemplates = async () => {
    try {
      const res = await api.get('/templates');
      setTemplates(res.data);
    } catch (err) {
      console.error('加载模板失败:', err);
    }
  };

  const loadPatientStatus = async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const res = await api.get(`/patient-status/${patientId}`);
      setPatientStatus(res.data);
      setMessage('');
    } catch (err) {
      setMessage('查询失败: ' + (err.response?.data?.error || err.message));
      setPatientStatus(null);
    }
    setLoading(false);
  };

  const loadResignTasks = async () => {
    try {
      const res = await api.get('/resign-tasks');
      setResignTasks(res.data);
    } catch (err) {
      console.error('加载补签任务失败:', err);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'up-to-date': '#52c41a',
      'needs-resign': '#faad14',
      'outdated-but-no-task': '#faad14',
      'not-signed': '#ff4d4f',
      'unknown': '#8c8c8c'
    };
    return colors[status] || '#8c8c8c';
  };

  const getStatusText = (status) => {
    const texts = {
      'up-to-date': '已签署最新版本',
      'needs-resign': '需要补签',
      'outdated-but-no-task': '版本非最新',
      'not-signed': '未签署',
      'unknown': '未知'
    };
    return texts[status] || status;
  };

  return (
    <div style={{ minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ color: '#1890ff', marginBottom: '30px', textAlign: 'center' }}>
          知情同意版本管理系统
        </h1>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {['patient-status', 'templates', 'resign-tasks'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: activeTab === tab ? '#1890ff' : '#fff',
                color: activeTab === tab ? '#fff' : '#333',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              {tab === 'patient-status' ? '患者状态查询' : tab === 'templates' ? '模板管理' : '补签任务'}
            </button>
          ))}
        </div>

        {message && (
          <div style={{
            padding: '12px',
            backgroundColor: '#fff1f0',
            border: '1px solid #ffa39e',
            borderRadius: '4px',
            marginBottom: '20px',
            color: '#cf1322'
          }}>
            {message}
          </div>
        )}

        {activeTab === 'patient-status' && (
          <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginBottom: '20px' }}>患者签署状态查询</h2>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="输入患者ID，如 P001"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                style={{
                  padding: '10px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  flex: 1,
                  minWidth: '200px'
                }}
              />
              <button
                onClick={loadPatientStatus}
                disabled={loading}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#1890ff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {loading ? '查询中...' : '查询'}
              </button>
            </div>

            {patientStatus && (
              <div>
                <div style={{
                  padding: '16px',
                  backgroundColor: patientStatus.status === 'needs-resign' ? '#fffbe6' : '#f6ffed',
                  border: `2px solid ${getStatusColor(patientStatus.status)}`,
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
                  <h3 style={{ margin: '0 0 10px 0', color: getStatusColor(patientStatus.status) }}>
                    {getStatusText(patientStatus.status)}
                  </h3>
                  {patientStatus.resign_reason && (
                    <p style={{ margin: '0', color: '#fa8c16' }}>
                      <strong>补签原因：</strong>{patientStatus.resign_reason}
                    </p>
                  )}
                  {patientStatus.no_resign_reason && (
                    <p style={{ margin: '0', color: '#52c41a' }}>
                      <strong>无需补签原因：</strong>{patientStatus.no_resign_reason}
                    </p>
                  )}
                </div>

                {patientStatus.active_signature && (
                  <div style={{ marginBottom: '20px' }}>
                    <h3>当前有效签署</h3>
                    <div style={{ padding: '16px', backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '4px' }}>
                      <p><strong>版本：</strong>{patientStatus.active_signature.template_version}</p>
                      <p><strong>模板：</strong>{patientStatus.active_signature.template_title}</p>
                      <p><strong>签署时间：</strong>{patientStatus.active_signature.signed_at}</p>
                      <p><strong>状态：</strong>{patientStatus.active_signature.status === 'active' ? '有效' : '已撤回'}</p>
                      <button
                        onClick={() => window.open(`${API_BASE}/export/proof/${patientStatus.active_signature.id}`, '_blank')}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#52c41a',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          marginTop: '10px'
                        }}
                      >
                        导出签署证明(PDF)
                      </button>
                    </div>
                  </div>
                )}

                {patientStatus.all_signatures.length > 1 && (
                  <div>
                    <h3>历史签署记录</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#fafafa' }}>
                            <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>版本</th>
                            <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>模板</th>
                            <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>签署时间</th>
                            <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>状态</th>
                            <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {patientStatus.all_signatures.map(sig => (
                            <tr key={sig.id}>
                              <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>{sig.template_version}</td>
                              <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>{sig.template_title}</td>
                              <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>{sig.signed_at}</td>
                              <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>
                                <span style={{
                                  color: sig.status === 'active' ? '#52c41a' : '#ff4d4f',
                                  fontWeight: 'bold'
                                }}>
                                  {sig.status === 'active' ? '有效' : '已撤回'}
                                </span>
                              </td>
                              <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>
                                <button
                                  onClick={() => window.open(`${API_BASE}/export/proof/${sig.id}`, '_blank')}
                                  style={{
                                    padding: '4px 12px',
                                    backgroundColor: '#1890ff',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  导出
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'templates' && (
          <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginBottom: '20px' }}>模板列表</h2>
            {templates.length === 0 ? (
              <p>暂无模板，请通过API发布新模板</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fafafa' }}>
                      <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>版本号</th>
                      <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>标题</th>
                      <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>适用范围</th>
                      <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>发布时间</th>
                      <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map(tpl => (
                      <tr key={tpl.id}>
                        <td style={{ padding: '12px', border: '1px solid #f0f0f0', fontWeight: 'bold' }}>{tpl.version}</td>
                        <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>{tpl.title}</td>
                        <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>{tpl.applicable_scope || '-'}</td>
                        <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>{tpl.created_at}</td>
                        <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>
                          <span style={{ color: tpl.is_active ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
                            {tpl.is_active ? '启用' : '停用'}
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

        {activeTab === 'resign-tasks' && (
          <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginBottom: '20px' }}>补签任务列表</h2>
            {resignTasks.length === 0 ? (
              <p>暂无补签任务</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fafafa' }}>
                      <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>患者ID</th>
                      <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>患者姓名</th>
                      <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>旧版本</th>
                      <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>新版本</th>
                      <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>补签原因</th>
                      <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>状态</th>
                      <th style={{ padding: '12px', border: '1px solid #f0f0f0', textAlign: 'left' }}>创建时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resignTasks.map(task => (
                      <tr key={task.id}>
                        <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>{task.patient_id}</td>
                        <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>{task.patient_name}</td>
                        <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>{task.old_template_version}</td>
                        <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>{task.new_template_version}</td>
                        <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>{task.reason}</td>
                        <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>
                          <span style={{
                            color: task.status === 'pending' ? '#faad14' : '#52c41a',
                            fontWeight: 'bold'
                          }}>
                            {task.status === 'pending' ? '待处理' : '已完成'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', border: '1px solid #f0f0f0' }}>{task.created_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;