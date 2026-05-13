import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { templateApi, STATUS_MAP, RELEASE_TYPE_MAP, RELEASE_STATUS_MAP } from '../utils/api';

function TemplateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [activeTab, setActiveTab] = useState('edit');
  const [activeChannel, setActiveChannel] = useState('sms');
  const [releases, setReleases] = useState([]);
  const [audit, setAudit] = useState([]);
  const [versionDiff, setVersionDiff] = useState(null);
  
  const [formData, setFormData] = useState({
    smsContent: '',
    emailSubject: '',
    emailContent: '',
    inAppTitle: '',
    inAppContent: ''
  });
  
  const [validationResult, setValidationResult] = useState(null);
  const [simulationResult, setSimulationResult] = useState(null);
  const [testData, setTestData] = useState({});
  const [message, setMessage] = useState(null);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [releaseConfig, setReleaseConfig] = useState({
    type: 'gradual',
    percentage: 10,
    targetUsers: '',
    failureReason: ''
  });
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [diffVersion1, setDiffVersion1] = useState('');
  const [diffVersion2, setDiffVersion2] = useState('');

  useEffect(() => {
    loadTemplate();
  }, [id]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const [templateRes, releasesRes, auditRes] = await Promise.all([
        templateApi.get(id),
        templateApi.getReleases(id),
        templateApi.getAudit(id)
      ]);

      if (templateRes.data.success) {
        const data = templateRes.data.data;
        setTemplate(data);
        
        if (data.versions && data.versions.length > 0) {
          const latest = data.versions[0];
          setSelectedVersion(latest);
          setFormData({
            smsContent: latest.smsContent || '',
            emailSubject: latest.emailSubject || '',
            emailContent: latest.emailContent || '',
            inAppTitle: latest.inAppTitle || '',
            inAppContent: latest.inAppContent || ''
          });

          const testDataObj = {};
          data.variables.forEach(v => {
            testDataObj[v.variableName] = v.defaultValue || '';
          });
          setTestData(testDataObj);
        }
      }

      if (releasesRes.data.success) {
        setReleases(releasesRes.data.data);
      }

      if (auditRes.data.success) {
        setAudit(auditRes.data.data);
      }
    } catch (error) {
      console.error('加载模板详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTestDataChange = (varName, value) => {
    setTestData(prev => ({ ...prev, [varName]: value }));
  };

  const insertVariable = (varName) => {
    const fields = ['smsContent', 'emailSubject', 'emailContent', 'inAppTitle', 'inAppContent'];
    const fieldMap = {
      sms: 'smsContent',
      email: 'emailSubject',
      inapp: 'inAppTitle'
    };
    const currentField = fieldMap[activeChannel];
    if (currentField) {
      setFormData(prev => ({
        ...prev,
        [currentField]: prev[currentField] + `{{${varName}}}`
      }));
    }
  };

  const validateTemplate = async () => {
    try {
      const res = await templateApi.validate(id, {
        versionData: formData
      });
      if (res.data.success) {
        setValidationResult(res.data.data);
        if (res.data.data.valid) {
          showMessage('success', '校验通过！');
        } else {
          showMessage('danger', '校验失败，请检查错误信息');
        }
      }
    } catch (error) {
      showMessage('danger', '校验失败');
    }
  };

  const simulateSending = async () => {
    try {
      const res = await templateApi.simulate(id, {
        ...formData,
        testData
      });
      if (res.data.success) {
        setSimulationResult(res.data.data);
        showMessage('success', '模拟发送完成！');
      }
    } catch (error) {
      showMessage('danger', '模拟发送失败');
    }
  };

  const createNewVersion = async () => {
    try {
      const res = await templateApi.createVersion(id, formData);
      if (res.data.success) {
        showMessage('success', '版本创建成功！');
        loadTemplate();
      }
    } catch (error) {
      showMessage('danger', '创建版本失败');
    }
  };

  const openReleaseModal = (type) => {
    setReleaseConfig(prev => ({ ...prev, type }));
    setShowReleaseModal(true);
  };

  const executeRelease = async () => {
    try {
      let res;
      
      if (releaseConfig.type === 'gradual') {
        const strategy = {
          type: 'percentage',
          value: parseInt(releaseConfig.percentage) || 10
        };
        
        let targetUsers = [];
        if (releaseConfig.targetUsers) {
          targetUsers = releaseConfig.targetUsers.split(',').map(u => u.trim()).filter(Boolean);
        }

        res = await templateApi.gradualRelease(id, {
          versionId: selectedVersion.id,
          strategy,
          targetUsers
        });
      } else if (releaseConfig.type === 'full') {
        res = await templateApi.fullRelease(id, {
          versionId: selectedVersion.id
        });
      } else if (releaseConfig.type === 'rollback') {
        res = await templateApi.rollback(id, {
          versionId: selectedVersion.id
        });
      } else if (releaseConfig.type === 'gradual_fail') {
        res = await templateApi.gradualFail(id, {
          versionId: selectedVersion.id,
          failureReason: releaseConfig.failureReason || '灰度发布验证失败'
        });
      }

      if (res.data.success) {
        showMessage('success', '操作成功！');
        setShowReleaseModal(false);
        loadTemplate();
      } else {
        showMessage('danger', res.data.errors?.join('; ') || '操作失败');
      }
    } catch (error) {
      showMessage('danger', '操作失败');
    }
  };

  const loadVersionDiff = async () => {
    if (!diffVersion1 || !diffVersion2) {
      showMessage('warning', '请选择两个版本进行对比');
      return;
    }

    try {
      const res = await templateApi.getVersionDiff(id, diffVersion1, diffVersion2);
      if (res.data.success) {
        setVersionDiff(res.data.data);
      }
    } catch (error) {
      showMessage('danger', '获取版本差异失败');
    }
  };

  const selectVersion = (version) => {
    setSelectedVersion(version);
    setFormData({
      smsContent: version.smsContent || '',
      emailSubject: version.emailSubject || '',
      emailContent: version.emailContent || '',
      inAppTitle: version.inAppTitle || '',
      inAppContent: version.inAppContent || ''
    });
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner"></div>
          <span style={{ marginLeft: '12px' }}>加载中...</span>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="icon">❌</div>
          <p>模板不存在</p>
          <button className="btn btn-primary mt-4" onClick={() => navigate('/')}>
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = selectedVersion ? STATUS_MAP[selectedVersion.status] : null;
  const canGradualRelease = selectedVersion && selectedVersion.status === 'draft';
  const canFullRelease = selectedVersion && selectedVersion.status === 'gradual';
  const canRollback = selectedVersion && ['gradual', 'full'].includes(selectedVersion.status);
  const canGradualFail = selectedVersion && selectedVersion.status === 'gradual';

  return (
    <div className="container">
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>
          ← 返回列表
        </button>
        <h2 style={{ margin: 0 }}>{template.name}</h2>
        {statusInfo && (
          <span className={`badge ${statusInfo.className}`}>{statusInfo.label}</span>
        )}
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}

      <div className="grid grid-2">
        <div className="card" style={{ height: 'fit-content' }}>
          <div className="card-header">
            <h3>📚 版本历史</h3>
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => setShowDiffModal(true)}
            >
              版本对比
            </button>
          </div>
          <div className="version-list">
            {template.versions.map((version, index) => {
              const status = STATUS_MAP[version.status];
              const isCurrent = version.id === template.currentVersionId;
              return (
                <div 
                  key={version.id}
                  className={`version-item ${selectedVersion?.id === version.id ? 'selected' : ''}`}
                  onClick={() => selectVersion(version)}
                >
                  <div className="version-name">
                    {version.version}
                    {isCurrent && <span className="badge badge-success" style={{ marginLeft: '8px' }}>当前</span>}
                    <span className={`badge ${status.className}`} style={{ marginLeft: '8px' }}>
                      {status.label}
                    </span>
                  </div>
                  <div className="version-meta">
                    创建人: {version.createdBy} | {dayjs(version.createdAt).format('YYYY-MM-DD HH:mm')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ height: 'fit-content' }}>
          <div className="card-header">
            <h3>🎯 操作区</h3>
          </div>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={validateTemplate}>
              📋 校验模板
            </button>
            <button className="btn btn-secondary" onClick={simulateSending}>
              👁️ 预览效果
            </button>
            <button className="btn btn-success" onClick={createNewVersion}>
              ➕ 保存为新版本
            </button>
            <button 
              className="btn btn-warning"
              disabled={!canGradualRelease}
              onClick={() => openReleaseModal('gradual')}
            >
              🚀 灰度发布
            </button>
            <button 
              className="btn btn-primary"
              disabled={!canFullRelease}
              onClick={() => openReleaseModal('full')}
            >
              🎯 全量发布
            </button>
            <button 
              className="btn btn-danger"
              disabled={!canRollback}
              onClick={() => openReleaseModal('rollback')}
            >
              ↩️ 回滚
            </button>
            <button 
              className="btn btn-danger"
              disabled={!canGradualFail}
              onClick={() => openReleaseModal('gradual_fail')}
            >
              ❌ 灰度失败回滚
            </button>
          </div>

          {validationResult && (
            <div style={{ marginTop: '20px' }}>
              <h4 style={{ marginBottom: '12px' }}>校验结果</h4>
              {validationResult.valid ? (
                <div className="alert alert-success">✅ 所有校验通过</div>
              ) : (
                <div className="alert alert-danger">
                  ❌ 发现 {validationResult.errors.length} 个错误
                  <ul style={{ marginTop: '12px', marginLeft: '20px' }}>
                    {validationResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
              {validationResult.warnings && validationResult.warnings.length > 0 && (
                <div className="alert alert-warning" style={{ marginTop: '12px' }}>
                  ⚠️ 警告
                  <ul style={{ marginTop: '12px', marginLeft: '20px' }}>
                    {validationResult.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="tabs">
          <div 
            className={`tab ${activeTab === 'edit' ? 'active' : ''}`}
            onClick={() => setActiveTab('edit')}
          >
            ✏️ 编辑模板
          </div>
          <div 
            className={`tab ${activeTab === 'variables' ? 'active' : ''}`}
            onClick={() => setActiveTab('variables')}
          >
            🔧 变量字典
          </div>
          <div 
            className={`tab ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            👁️ 预览效果
          </div>
          <div 
            className={`tab ${activeTab === 'releases' ? 'active' : ''}`}
            onClick={() => setActiveTab('releases')}
          >
            📜 发布历史
          </div>
          <div 
            className={`tab ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            📝 审计日志
          </div>
        </div>

        {activeTab === 'edit' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '12px' }}>可用变量（点击插入）</h4>
              <div>
                {template.variables.map(v => (
                  <span 
                    key={v.id}
                    className={`variable-tag ${v.isRequired ? 'required' : ''}`}
                    onClick={() => insertVariable(v.variableName)}
                    title={v.description}
                  >
                    {v.isRequired && <span>*</span>}{v.variableName}
                    <span style={{ fontSize: '11px', opacity: 0.7 }}>({v.displayName})</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="tabs" style={{ marginTop: '0' }}>
              <div 
                className={`tab ${activeChannel === 'sms' ? 'active' : ''}`}
                onClick={() => setActiveChannel('sms')}
              >
                📱 短信
              </div>
              <div 
                className={`tab ${activeChannel === 'email' ? 'active' : ''}`}
                onClick={() => setActiveChannel('email')}
              >
                📧 邮件
              </div>
              <div 
                className={`tab ${activeChannel === 'inapp' ? 'active' : ''}`}
                onClick={() => setActiveChannel('inapp')}
              >
                💬 站内信
              </div>
            </div>

            {activeChannel === 'sms' && (
              <div className="form-group">
                <label>短信内容（最多67字符，使用 {{变量名}} 插入变量）</label>
                <textarea
                  value={formData.smsContent}
                  onChange={(e) => handleFormChange('smsContent', e.target.value)}
                  placeholder="【产品名】您的验证码是{{code}}，{{expireMinutes}}分钟内有效。"
                />
                <p className="text-muted" style={{ marginTop: '8px' }}>
                  当前长度: {formData.smsContent.length} 字符
                </p>
              </div>
            )}

            {activeChannel === 'email' && (
              <div>
                <div className="form-group">
                  <label>邮件主题</label>
                  <input
                    value={formData.emailSubject}
                    onChange={(e) => handleFormChange('emailSubject', e.target.value)}
                    placeholder="您的{{billMonth}}账单已生成"
                  />
                </div>
                <div className="form-group">
                  <label>邮件内容（支持HTML）</label>
                  <textarea
                    value={formData.emailContent}
                    onChange={(e) => handleFormChange('emailContent', e.target.value)}
                    placeholder='<div>尊敬的 {{userName}}，您的账单已生成...</div>'
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
              </div>
            )}

            {activeChannel === 'inapp' && (
              <div>
                <div className="form-group">
                  <label>站内信标题</label>
                  <input
                    value={formData.inAppTitle}
                    onChange={(e) => handleFormChange('inAppTitle', e.target.value)}
                    placeholder="{{billMonth}}账单提醒"
                  />
                </div>
                <div className="form-group">
                  <label>站内信内容</label>
                  <textarea
                    value={formData.inAppContent}
                    onChange={(e) => handleFormChange('inAppContent', e.target.value)}
                    placeholder="您好{{userName}}，您{{billMonth}}的账单已生成..."
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'variables' && (
          <div>
            <table className="variable-dict-table">
              <thead>
                <tr>
                  <th>变量名</th>
                  <th>显示名称</th>
                  <th>类型</th>
                  <th>必填</th>
                  <th>默认值/样例</th>
                  <th>描述</th>
                </tr>
              </thead>
              <tbody>
                {template.variables.map(v => (
                  <tr key={v.id}>
                    <td><code>{`{{${v.variableName}}}`}</code></td>
                    <td>{v.displayName}</td>
                    <td>{v.dataType}</td>
                    <td>
                      <span className={`badge ${v.isRequired ? 'badge-danger' : 'badge-default'}`}>
                        {v.isRequired ? '是' : '否'}
                      </span>
                    </td>
                    <td><code>{v.defaultValue || '-'}</code></td>
                    <td className="text-muted">{v.description || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {selectedVersion && (
              <div style={{ marginTop: '24px' }}>
                <h4 style={{ marginBottom: '12px' }}>📸 当前版本变量快照</h4>
                <div className="card" style={{ marginBottom: '0', background: '#fafafa' }}>
                  <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(selectedVersion.variableDictionary, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'preview' && (
          <div>
            <div className="card" style={{ marginBottom: '20px', background: '#fafafa' }}>
              <h4 style={{ marginBottom: '12px' }}>🔧 测试数据</h4>
              <div className="form-row">
                {template.variables.map(v => (
                  <div key={v.id} className="form-group" style={{ marginBottom: '0' }}>
                    <label>{v.displayName} {v.isRequired && <span className="text-danger">*</span>}</label>
                    <input
                      value={testData[v.variableName] || ''}
                      onChange={(e) => handleTestDataChange(v.variableName, e.target.value)}
                      placeholder={v.defaultValue}
                    />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '16px' }}>
                <button className="btn btn-primary" onClick={simulateSending}>
                  🔄 刷新预览
                </button>
              </div>
            </div>

            {simulationResult ? (
              <div className="grid grid-3">
                {simulationResult.channels.sms && (
                  <div>
                    <h4 style={{ marginBottom: '12px' }}>📱 短信预览</h4>
                    <div className="preview-container">
                      <div className="sms-preview">
                        <div className="sender">106xxxx</div>
                        <div className="content">{simulationResult.channels.sms.renderedContent}</div>
                        <div className={`length-info ${simulationResult.channels.sms.isOverLimit ? 'over-limit' : ''}`}>
                          {simulationResult.channels.sms.length}/{simulationResult.channels.sms.maxLength} 字符
                          {simulationResult.channels.sms.isOverLimit && ' ⚠️ 超限'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {simulationResult.channels.email && (
                  <div>
                    <h4 style={{ marginBottom: '12px' }}>📧 邮件预览</h4>
                    <div className="preview-container">
                      <div className="email-preview">
                        <div className="email-header">
                          <div className="email-subject">{simulationResult.channels.email.renderedSubject}</div>
                        </div>
                        <div 
                          className="email-body"
                          dangerouslySetInnerHTML={{ __html: simulationResult.channels.email.renderedContent }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {simulationResult.channels.inApp && (
                  <div>
                    <h4 style={{ marginBottom: '12px' }}>💬 站内信预览</h4>
                    <div className="preview-container">
                      <div className="inapp-preview">
                        <div className="inapp-header">
                          <div className="inapp-icon">📬</div>
                          <div>
                            <div className="inapp-title">{simulationResult.channels.inApp.renderedTitle}</div>
                            <div className="inapp-time">{dayjs().format('MM-DD HH:mm')}</div>
                          </div>
                        </div>
                        <div className="inapp-content">{simulationResult.channels.inApp.renderedContent}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">
                <div className="icon">👁️</div>
                <p>点击"刷新预览"查看不同渠道的渲染效果</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'releases' && (
          <div>
            {releases.length === 0 ? (
              <div className="empty-state">
                <div className="icon">📜</div>
                <p>暂无发布记录</p>
              </div>
            ) : (
              <div className="timeline">
                {releases.map((release, index) => {
                  const status = RELEASE_STATUS_MAP[release.status];
                  const timelineClass = release.status === 'success' ? 'success' : 
                                        release.status === 'failed' ? 'failed' : '';
                  return (
                    <div key={release.id} className={`timeline-item ${timelineClass}`}>
                      <div className="timeline-content">
                        <div className="timeline-title">
                          {RELEASE_TYPE_MAP[release.type]}
                          <span className={`badge ${status.className}`} style={{ marginLeft: '12px' }}>
                            {status.label}
                          </span>
                        </div>
                        <div className="timeline-meta">
                          版本: {release.version} | 操作人: {release.operator} | 
                          {dayjs(release.createdAt).format('YYYY-MM-DD HH:mm')}
                        </div>
                        
                        {release.type === 'gradual' && release.strategy && (
                          <div style={{ marginBottom: '8px' }}>
                            <strong>灰度策略:</strong> {release.strategy.type === 'percentage' 
                              ? `${release.strategy.value}% 用户`
                              : release.strategy.type === 'user_list'
                              ? '指定用户列表'
                              : '条件筛选'}
                          </div>
                        )}

                        {release.hitUsers && release.hitUsers.length > 0 && (
                          <div style={{ marginBottom: '8px' }}>
                            <strong>命中用户 ({release.hitUsers.length}个):</strong>
                            <div style={{ marginTop: '8px' }}>
                              {release.hitUsers.map((user, i) => (
                                <span key={i} className="user-chip">{user}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {release.failureReason && (
                          <div className="alert alert-danger" style={{ marginTop: '12px' }}>
                            <strong>失败原因:</strong> {release.failureReason}
                          </div>
                        )}

                        {release.validationResult && (
                          <div style={{ marginTop: '12px', padding: '12px', background: '#fafafa', borderRadius: '4px' }}>
                            <details>
                              <summary style={{ cursor: 'pointer' }}>
                                📋 校验结果详情
                              </summary>
                              <pre style={{ marginTop: '12px', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                                {JSON.stringify(release.validationResult, null, 2)}
                              </pre>
                            </details>
                          </div>
                        )}

                        {release.simulationResult && (
                          <div style={{ marginTop: '12px', padding: '12px', background: '#fafafa', borderRadius: '4px' }}>
                            <details>
                              <summary style={{ cursor: 'pointer' }}>
                                📧 模拟发送记录
                              </summary>
                              <pre style={{ marginTop: '12px', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                                {JSON.stringify(release.simulationResult, null, 2)}
                              </pre>
                            </details>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'audit' && (
          <div>
            {audit.length === 0 ? (
              <div className="empty-state">
                <div className="icon">📝</div>
                <p>暂无审计日志</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>操作时间</th>
                    <th>操作类型</th>
                    <th>操作人</th>
                    <th>详情</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map(log => (
                    <tr key={log.id}>
                      <td>{dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss')}</td>
                      <td>
                        <span className="badge badge-primary">{log.action}</span>
                      </td>
                      <td>{log.operator}</td>
                      <td>
                        <pre style={{ margin: '0', fontSize: '12px', whiteSpace: 'pre-wrap', maxWidth: '400px' }}>
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {showReleaseModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>
                {releaseConfig.type === 'gradual' && '🚀 灰度发布'}
                {releaseConfig.type === 'full' && '🎯 全量发布'}
                {releaseConfig.type === 'rollback' && '↩️ 回滚版本'}
                {releaseConfig.type === 'gradual_fail' && '❌ 灰度失败回滚'}
              </h3>
              <button className="close-btn" onClick={() => setShowReleaseModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info">
                当前版本: <strong>{selectedVersion?.version}</strong> ({selectedVersion ? STATUS_MAP[selectedVersion.status].label : ''})
              </div>

              {releaseConfig.type === 'gradual' && (
                <div>
                  <div className="form-group">
                    <label>灰度比例 (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={releaseConfig.percentage}
                      onChange={(e) => setReleaseConfig(prev => ({ ...prev, percentage: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>指定测试用户（可选，用逗号分隔）</label>
                    <input
                      placeholder="user001, user002, user003"
                      value={releaseConfig.targetUsers}
                      onChange={(e) => setReleaseConfig(prev => ({ ...prev, targetUsers: e.target.value }))}
                    />
                    <p className="text-muted" style={{ marginTop: '8px', fontSize: '13px' }}>
                      留空则按比例随机选择用户
                    </p>
                  </div>
                </div>
              )}

              {releaseConfig.type === 'gradual_fail' && (
                <div className="form-group">
                  <label>失败原因</label>
                  <textarea
                    placeholder="请描述灰度验证失败的原因..."
                    value={releaseConfig.failureReason}
                    onChange={(e) => setReleaseConfig(prev => ({ ...prev, failureReason: e.target.value }))}
                  />
                </div>
              )}

              {releaseConfig.type === 'full' && (
                <div className="alert alert-warning">
                  ⚠️ 全量发布将对所有用户生效，请确保灰度验证已通过！
                </div>
              )}

              {releaseConfig.type === 'rollback' && (
                <div className="alert alert-warning">
                  ⚠️ 回滚后该版本将标记为"已回滚"，且不能再次发布。
                  系统将自动恢复到上一个可用版本。
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowReleaseModal(false)}>
                取消
              </button>
              <button 
                className={`btn ${releaseConfig.type === 'rollback' || releaseConfig.type === 'gradual_fail' ? 'btn-danger' : 'btn-primary'}`}
                onClick={executeRelease}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {showDiffModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h3>📊 版本对比</h3>
              <button className="close-btn" onClick={() => setShowDiffModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>版本 1</label>
                  <select 
                    value={diffVersion1}
                    onChange={(e) => setDiffVersion1(e.target.value)}
                  >
                    <option value="">请选择</option>
                    {template.versions.map(v => (
                      <option key={v.id} value={v.id}>{v.version}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>版本 2</label>
                  <select 
                    value={diffVersion2}
                    onChange={(e) => setDiffVersion2(e.target.value)}
                  >
                    <option value="">请选择</option>
                    {template.versions.map(v => (
                      <option key={v.id} value={v.id}>{v.version}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" onClick={loadVersionDiff}>
                对比
              </button>

              {versionDiff && (
                <div style={{ marginTop: '24px' }}>
                  <h4 style={{ marginBottom: '12px' }}>
                    {versionDiff.version1.version} → {versionDiff.version2.version}
                  </h4>
                  
                  {versionDiff.changes.length === 0 ? (
                    <div className="alert alert-success">两个版本内容完全一致</div>
                  ) : (
                    <div className="diff-container">
                      <div className="diff-header">
                        <div>{versionDiff.version1.version} (旧)</div>
                        <div>{versionDiff.version2.version} (新)</div>
                      </div>
                      {versionDiff.changes.map((change, i) => (
                        <div key={i}>
                          <div style={{ padding: '8px 16px', background: '#f0f2f5', fontWeight: 'bold' }}>
                            字段: {change.field}
                          </div>
                          <div className="diff-row">
                            <div className="diff-cell old">
                              {typeof change.version1Value === 'string' 
                                ? change.version1Value || '(空)'
                                : JSON.stringify(change.version1Value)}
                            </div>
                            <div className="diff-cell new">
                              {typeof change.version2Value === 'string'
                                ? change.version2Value || '(空)'
                                : JSON.stringify(change.version2Value)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDiffModal(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TemplateDetail;