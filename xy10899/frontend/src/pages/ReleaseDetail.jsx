import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { releaseApi } from '../api';

const ReleaseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [release, setRelease] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('checklist');
  const [currentUser, setCurrentUser] = useState('当前用户');

  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockData, setBlockData] = useState({ checkItemId: null, reason: '', reporter: currentUser });

  const [showExemptionModal, setShowExemptionModal] = useState(false);
  const [exemptionData, setExemptionData] = useState({ checkItemId: null, reason: '', applicant: currentUser });

  const [showResultModal, setShowResultModal] = useState(false);
  const [resultData, setResultData] = useState({ checkItemId: null, status: 'passed', result: '' });

  const [showAssigneeModal, setShowAssigneeModal] = useState(false);
  const [assigneeData, setAssigneeData] = useState({ checkItemId: null, assignee: '' });

  const [showCompensateModal, setShowCompensateModal] = useState(false);
  const [compensateData, setCompensateData] = useState({ checkItemId: null, reason: '', operator: '' });

  const fetchRelease = useCallback(async () => {
    try {
      setLoading(true);
      const response = await releaseApi.detail(id);
      setRelease(response.data.data);
    } catch (error) {
      console.error('Failed to fetch release:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRelease();
  }, [fetchRelease]);

  const getStatusColor = (status) => {
    const colors = {
      pending: '#8c8c8c',
      in_progress: '#1890ff',
      passed: '#52c41a',
      failed: '#ff4d4f',
      blocked: '#faad14',
      exempted: '#722ed1'
    };
    return colors[status] || '#8c8c8c';
  };

  const getStatusText = (status) => {
    const texts = {
      pending: '待处理',
      in_progress: '进行中',
      passed: '通过',
      failed: '失败',
      blocked: '阻塞',
      exempted: '豁免'
    };
    return texts[status] || status;
  };

  const getReleaseStatusColor = (status) => {
    const colors = {
      draft: '#faad14',
      in_progress: '#1890ff',
      ready: '#52c41a',
      published: '#13c2c2',
      cancelled: '#ff4d4f'
    };
    return colors[status] || '#8c8c8c';
  };

  const getReleaseStatusText = (status) => {
    const texts = {
      draft: '草稿',
      in_progress: '进行中',
      ready: '就绪',
      published: '已发布',
      cancelled: '已取消'
    };
    return texts[status] || status;
  };

  const updateCheckItemStatus = async (checkItemId, status) => {
    try {
      if (status === 'passed' || status === 'failed') {
        setResultData({ checkItemId, status, result: '' });
        setShowResultModal(true);
        return;
      }
      await releaseApi.updateCheckItemStatus(id, checkItemId, status, currentUser);
      fetchRelease();
    } catch (error) {
      alert('操作失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const confirmResult = async () => {
    try {
      await releaseApi.updateCheckItemStatus(id, resultData.checkItemId, resultData.status, currentUser, resultData.result);
      setShowResultModal(false);
      setResultData({ checkItemId: null, status: 'passed', result: '' });
      fetchRelease();
    } catch (error) {
      alert('操作失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const updateAssignee = async () => {
    try {
      await releaseApi.updateCheckItemAssignee(id, assigneeData.checkItemId, assigneeData.assignee, currentUser);
      setShowAssigneeModal(false);
      setAssigneeData({ checkItemId: null, assignee: '' });
      fetchRelease();
    } catch (error) {
      alert('操作失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const compensateCheckItem = async () => {
    try {
      await releaseApi.compensateCheckItem(id, compensateData.checkItemId, compensateData.reason, compensateData.operator || currentUser);
      setShowCompensateModal(false);
      setCompensateData({ checkItemId: null, reason: '', operator: '' });
      fetchRelease();
    } catch (error) {
      alert('操作失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const addBlock = async () => {
    try {
      await releaseApi.addBlock(id, blockData);
      setShowBlockModal(false);
      setBlockData({ checkItemId: null, reason: '', reporter: currentUser });
      fetchRelease();
    } catch (error) {
      alert('操作失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const resolveBlock = async (blockId) => {
    try {
      await releaseApi.resolveBlock(blockId, currentUser);
      fetchRelease();
    } catch (error) {
      alert('操作失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const applyExemption = async () => {
    try {
      await releaseApi.applyExemption(id, exemptionData);
      setShowExemptionModal(false);
      setExemptionData({ checkItemId: null, reason: '', applicant: currentUser });
      fetchRelease();
    } catch (error) {
      alert('操作失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const approveExemption = async (exemptionId) => {
    try {
      await releaseApi.approveExemption(exemptionId, currentUser);
      fetchRelease();
    } catch (error) {
      alert('操作失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const updateReleaseStatus = async (status) => {
    try {
      await releaseApi.updateStatus(id, status, currentUser);
      fetchRelease();
    } catch (error) {
      alert('操作失败: ' + (error.response?.data?.message || error.message));
    }
  };

  if (loading) {
    return <div style={styles.loading}>加载中...</div>;
  }

  if (!release) {
    return <div style={styles.error}>发布版本不存在</div>;
  }

  const groupedCheckItems = release.checkItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const passedCount = release.checkItems.filter(c => c.status === 'passed' || c.status === 'exempted').length;

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={() => navigate('/')}>
        ← 返回列表
      </button>

      <div style={styles.headerCard}>
        <div style={styles.headerLeft}>
          <div>
            <span style={styles.version}>{release.version}</span>
            <span style={{
              ...styles.statusTag,
              backgroundColor: getReleaseStatusColor(release.status) + '20',
              color: getReleaseStatusColor(release.status)
            }}>
              {getReleaseStatusText(release.status)}
            </span>
          </div>
          <h1 style={styles.title}>{release.title}</h1>
          <p style={styles.desc}>{release.description || '暂无描述'}</p>
          <div style={styles.metaRow}>
            <span>创建人: {release.created_by}</span>
            <span>创建时间: {new Date(release.created_at).toLocaleString('zh-CN')}</span>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.scoreCircle}>
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="#f0f0f0"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="#52c41a"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 40 * release.readiness_score / 100} ${2 * Math.PI * 40}`}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div style={styles.scoreContent}>
              <div style={styles.scoreValue}>{release.readiness_score}</div>
              <div style={styles.scoreLabel}>就绪度</div>
            </div>
          </div>
          <div style={styles.progressText}>
            {passedCount} / {release.checkItems.length} 检查项已通过
          </div>
        </div>
      </div>

      <div style={styles.actionBar}>
        <select
          style={styles.statusSelect}
          value={release.status}
          onChange={(e) => updateReleaseStatus(e.target.value)}
        >
          <option value="draft">草稿</option>
          <option value="in_progress">进行中</option>
          <option value="ready">就绪</option>
          <option value="published">已发布</option>
          <option value="cancelled">已取消</option>
        </select>
        <div style={styles.actionBtns}>
          <button style={styles.secondaryBtn} onClick={() => releaseApi.export(id)}>
            📥 导出概览
          </button>
          <button style={styles.secondaryBtn} onClick={() => releaseApi.exportDetail(id)}>
            📊 导出详情
          </button>
          <button style={styles.primaryBtn} onClick={() => setShowBlockModal(true)}>
            ⚠️ 标记阻塞
          </button>
        </div>
      </div>

      <div style={styles.tabs}>
        {['checklist', 'blocks', 'exemptions', 'logs'].map((tab) => (
          <button
            key={tab}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : {})
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'checklist' && '检查清单'}
            {tab === 'blocks' && `阻塞原因 (${release.blockReasons?.filter(b => !b.resolved).length || 0})`}
            {tab === 'exemptions' && `豁免申请 (${release.exemptions?.length || 0})`}
            {tab === 'logs' && '操作日志'}
          </button>
        ))}
      </div>

      {activeTab === 'checklist' && (
        <div style={styles.tabContent}>
          {Object.entries(groupedCheckItems).map(([category, items]) => (
            <div key={category} style={styles.categorySection}>
              <h3 style={styles.categoryTitle}>{category}</h3>
              <div style={styles.checkItemList}>
                {items.map((item) => (
                  <div key={item.id} style={styles.checkItem}>
                    <div style={styles.checkItemLeft}>
                      <div>
                        <span style={{
                          ...styles.checkItemStatus,
                          backgroundColor: getStatusColor(item.status) + '20',
                          color: getStatusColor(item.status)
                        }}>
                          {getStatusText(item.status)}
                        </span>
                        <span style={styles.checkItemName}>{item.name}</span>
                        {item.assignee && (
                          <span style={styles.assigneeTag}>
                            👤 {item.assignee}
                          </span>
                        )}
                      </div>
                      <p style={styles.checkItemDesc}>{item.description}</p>
                      {item.result && (
                        <div style={styles.checkResult}>
                          <strong>检查结果:</strong> {item.result}
                        </div>
                      )}
                    </div>
                    <div style={styles.checkItemActions}>
                      <button
                        style={styles.smallBtn}
                        onClick={() => {
                          setAssigneeData({ checkItemId: item.id, assignee: item.assignee || '' });
                          setShowAssigneeModal(true);
                        }}
                      >
                        责任人
                      </button>
                      {item.status === 'pending' && (
                        <>
                          <button
                            style={styles.smallBtn}
                            onClick={() => updateCheckItemStatus(item.id, 'in_progress')}
                          >
                            开始
                          </button>
                          <button
                            style={{ ...styles.smallBtn, ...styles.successBtn }}
                            onClick={() => updateCheckItemStatus(item.id, 'passed')}
                          >
                            通过
                          </button>
                          <button
                            style={{ ...styles.smallBtn, ...styles.dangerBtn }}
                            onClick={() => updateCheckItemStatus(item.id, 'failed')}
                          >
                            失败
                          </button>
                        </>
                      )}
                      {item.status === 'in_progress' && (
                        <>
                          <button
                            style={{ ...styles.smallBtn, ...styles.successBtn }}
                            onClick={() => updateCheckItemStatus(item.id, 'passed')}
                          >
                            通过
                          </button>
                          <button
                            style={{ ...styles.smallBtn, ...styles.dangerBtn }}
                            onClick={() => updateCheckItemStatus(item.id, 'failed')}
                          >
                            失败
                          </button>
                        </>
                      )}
                      {item.status === 'failed' && (
                        <>
                          <button
                            style={{ ...styles.smallBtn, ...styles.successBtn }}
                            onClick={() => updateCheckItemStatus(item.id, 'passed')}
                          >
                            重试通过
                          </button>
                          <button
                            style={{ ...styles.smallBtn, ...styles.compensateBtn }}
                            onClick={() => {
                              setCompensateData({ checkItemId: item.id, reason: '', operator: '' });
                              setShowCompensateModal(true);
                            }}
                          >
                            手动补偿
                          </button>
                        </>
                      )}
                      {(item.status === 'pending' || item.status === 'in_progress') && (
                        <button
                          style={{ ...styles.smallBtn, ...styles.purpleBtn }}
                          onClick={() => {
                            setExemptionData({ ...exemptionData, checkItemId: item.id });
                            setShowExemptionModal(true);
                          }}
                        >
                          申请豁免
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'blocks' && (
        <div style={styles.tabContent}>
          {release.blockReasons?.length === 0 ? (
            <div style={styles.empty}>暂无阻塞记录</div>
          ) : (
            <div style={styles.blockList}>
              {release.blockReasons.map((block) => (
                <div key={block.id} style={styles.blockItem}>
                  <div style={styles.blockHeader}>
                    <span style={{
                      ...styles.statusTag,
                      backgroundColor: block.resolved ? '#52c41a20' : '#faad1420',
                      color: block.resolved ? '#52c41a' : '#faad14'
                    }}>
                      {block.resolved ? '已解决' : '阻塞中'}
                    </span>
                    <span style={styles.blockReporter}>报告人: {block.reporter}</span>
                  </div>
                  <p style={styles.blockReason}>{block.reason}</p>
                  <div style={styles.blockFooter}>
                    <span>{new Date(block.created_at).toLocaleString('zh-CN')}</span>
                    {!block.resolved && (
                      <button
                        style={{ ...styles.smallBtn, ...styles.successBtn }}
                        onClick={() => resolveBlock(block.id)}
                      >
                        标记已解决
                      </button>
                    )}
                    {block.resolved && block.resolved_by && (
                      <span>解决人: {block.resolved_by}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'exemptions' && (
        <div style={styles.tabContent}>
          {release.exemptions?.length === 0 ? (
            <div style={styles.empty}>暂无豁免申请</div>
          ) : (
            <div style={styles.exemptionList}>
              {release.exemptions.map((exemption) => (
                <div key={exemption.id} style={styles.exemptionItem}>
                  <div style={styles.exemptionHeader}>
                    <span style={{
                      ...styles.statusTag,
                      backgroundColor: exemption.status === 'approved' ? '#52c41a20' : '#faad1420',
                      color: exemption.status === 'approved' ? '#52c41a' : '#faad14'
                    }}>
                      {exemption.status === 'approved' ? '已批准' : '待审批'}
                    </span>
                    <span style={styles.exemptionApplicant}>申请人: {exemption.applicant}</span>
                  </div>
                  <p style={styles.exemptionReason}>{exemption.reason}</p>
                  <div style={styles.exemptionFooter}>
                    <span>{new Date(exemption.created_at).toLocaleString('zh-CN')}</span>
                    {exemption.status !== 'approved' && (
                      <button
                        style={{ ...styles.smallBtn, ...styles.successBtn }}
                        onClick={() => approveExemption(exemption.id)}
                      >
                        批准豁免
                      </button>
                    )}
                    {exemption.approver && (
                      <span>审批人: {exemption.approver}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div style={styles.tabContent}>
          {release.operationLogs?.length === 0 ? (
            <div style={styles.empty}>暂无操作日志</div>
          ) : (
            <div style={styles.logList}>
              {release.operationLogs.map((log) => (
                <div key={log.id} style={styles.logItem}>
                  <span style={styles.logAction}>{log.action}</span>
                  <span style={styles.logOperator}>{log.operator}</span>
                  <span style={styles.logDetails}>{log.details}</span>
                  <span style={styles.logTime}>
                    {new Date(log.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showBlockModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3>标记阻塞</h3>
              <button style={styles.closeBtn} onClick={() => setShowBlockModal(false)}>×</button>
            </div>
            <div style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>关联检查项（可选）</label>
                <select
                  style={styles.input}
                  value={blockData.checkItemId || ''}
                  onChange={(e) => setBlockData({ ...blockData, checkItemId: e.target.value || null })}
                >
                  <option value="">不关联具体检查项</option>
                  {release.checkItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>阻塞原因 *</label>
                <textarea
                  style={styles.textarea}
                  value={blockData.reason}
                  onChange={(e) => setBlockData({ ...blockData, reason: e.target.value })}
                  placeholder="描述阻塞的具体原因"
                  required
                />
              </div>
              <div style={styles.modalFooter}>
                <button style={styles.cancelBtn} onClick={() => setShowBlockModal(false)}>取消</button>
                <button style={styles.submitBtn} onClick={addBlock}>提交</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showExemptionModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3>申请豁免</h3>
              <button style={styles.closeBtn} onClick={() => setShowExemptionModal(false)}>×</button>
            </div>
            <div style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>检查项</label>
                <select
                  style={styles.input}
                  value={exemptionData.checkItemId || ''}
                  onChange={(e) => setExemptionData({ ...exemptionData, checkItemId: e.target.value || null })}
                >
                  <option value="">不关联具体检查项</option>
                  {release.checkItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>豁免理由 *</label>
                <textarea
                  style={styles.textarea}
                  value={exemptionData.reason}
                  onChange={(e) => setExemptionData({ ...exemptionData, reason: e.target.value })}
                  placeholder="说明需要豁免的原因"
                  required
                />
              </div>
              <div style={styles.modalFooter}>
                <button style={styles.cancelBtn} onClick={() => setShowExemptionModal(false)}>取消</button>
                <button style={styles.submitBtn} onClick={applyExemption}>提交申请</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showResultModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3>{resultData.status === 'passed' ? '确认通过' : '记录失败'}</h3>
              <button style={styles.closeBtn} onClick={() => setShowResultModal(false)}>×</button>
            </div>
            <div style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>当前状态</label>
                <div style={{
                  ...styles.statusDisplay,
                  backgroundColor: getStatusColor(resultData.status) + '20',
                  color: getStatusColor(resultData.status)
                }}>
                  {resultData.status === 'passed' ? '✅ 通过' : '❌ 失败'}
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>{resultData.status === 'passed' ? '检查结果说明' : '失败原因'} *</label>
                <textarea
                  style={styles.textarea}
                  value={resultData.result}
                  onChange={(e) => setResultData({ ...resultData, result: e.target.value })}
                  placeholder={resultData.status === 'passed' ? '详细说明检查结果' : '详细描述失败原因，便于后续追踪解决'}
                  required
                />
              </div>
              <div style={styles.modalFooter}>
                <button style={styles.cancelBtn} onClick={() => setShowResultModal(false)}>取消</button>
                <button 
                  style={{
                    ...styles.submitBtn,
                    backgroundColor: resultData.status === 'passed' ? '#52c41a' : '#ff4d4f'
                  }} 
                  onClick={confirmResult}
                >
                  确认{resultData.status === 'passed' ? '通过' : '失败'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAssigneeModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3>设置责任人</h3>
              <button style={styles.closeBtn} onClick={() => setShowAssigneeModal(false)}>×</button>
            </div>
            <div style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>责任人姓名</label>
                <input
                  type="text"
                  style={styles.input}
                  value={assigneeData.assignee}
                  onChange={(e) => setAssigneeData({ ...assigneeData, assignee: e.target.value })}
                  placeholder="请输入责任人姓名"
                />
              </div>
              <div style={styles.modalFooter}>
                <button style={styles.cancelBtn} onClick={() => setShowAssigneeModal(false)}>取消</button>
                <button style={styles.submitBtn} onClick={updateAssignee}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCompensateModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3>手动补偿</h3>
              <button style={styles.closeBtn} onClick={() => setShowCompensateModal(false)}>×</button>
            </div>
            <div style={styles.form}>
              <div style={styles.formCompensateInfo}>
                <p style={styles.compensateWarning}>
                  ⚠️ 手动补偿将直接标记检查项为通过状态，这会影响就绪度评分。请谨慎操作！
                </p>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>补偿原因 *</label>
                <textarea
                  style={styles.textarea}
                  value={compensateData.reason}
                  onChange={(e) => setCompensateData({ ...compensateData, reason: e.target.value })}
                  placeholder="请详细说明补偿原因，便于审计追踪"
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>操作人</label>
                <input
                  type="text"
                  style={styles.input}
                  value={compensateData.operator}
                  onChange={(e) => setCompensateData({ ...compensateData, operator: e.target.value })}
                  placeholder="默认为当前用户"
                />
              </div>
              <div style={styles.modalFooter}>
                <button style={styles.cancelBtn} onClick={() => setShowCompensateModal(false)}>取消</button>
                <button style={{ ...styles.submitBtn, backgroundColor: '#faad14' }} onClick={compensateCheckItem}>
                  确认补偿
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    width: '100%'
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    fontSize: '16px',
    color: '#8c8c8c'
  },
  error: {
    textAlign: 'center',
    padding: '48px',
    fontSize: '16px',
    color: '#ff4d4f'
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#667eea',
    fontSize: '14px',
    cursor: 'pointer',
    marginBottom: '16px',
    padding: '8px 0'
  },
  headerCard: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    marginBottom: '16px',
    display: 'flex',
    justifyContent: 'space-between'
  },
  headerLeft: {
    flex: 1
  },
  version: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#667eea',
    backgroundColor: '#f0f2ff',
    padding: '4px 12px',
    borderRadius: '4px',
    marginRight: '8px'
  },
  statusTag: {
    fontSize: '12px',
    padding: '4px 12px',
    borderRadius: '4px'
  },
  title: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#262626',
    margin: '12px 0 8px'
  },
  desc: {
    fontSize: '14px',
    color: '#595959',
    marginBottom: '12px'
  },
  metaRow: {
    fontSize: '12px',
    color: '#8c8c8c',
    display: 'flex',
    gap: '24px'
  },
  headerRight: {
    textAlign: 'center',
    paddingLeft: '32px',
    borderLeft: '1px solid #f0f0f0'
  },
  scoreCircle: {
    position: 'relative',
    width: '100px',
    height: '100px',
    margin: '0 auto 8px'
  },
  scoreContent: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center'
  },
  scoreValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#52c41a'
  },
  scoreLabel: {
    fontSize: '12px',
    color: '#8c8c8c'
  },
  progressText: {
    fontSize: '12px',
    color: '#595959'
  },
  actionBar: {
    backgroundColor: 'white',
    padding: '16px 20px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    marginBottom: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  statusSelect: {
    padding: '8px 12px',
    border: '1px solid #d9d9d9',
    borderRadius: '6px',
    fontSize: '14px'
  },
  actionBtns: {
    display: 'flex',
    gap: '12px'
  },
  primaryBtn: {
    padding: '8px 16px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  secondaryBtn: {
    padding: '8px 16px',
    backgroundColor: 'white',
    color: '#262626',
    border: '1px solid #d9d9d9',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    backgroundColor: 'white',
    padding: '8px',
    borderRadius: '8px'
  },
  tab: {
    padding: '8px 20px',
    border: 'none',
    backgroundColor: 'transparent',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#595959'
  },
  tabActive: {
    backgroundColor: '#667eea',
    color: 'white'
  },
  tabContent: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
  },
  empty: {
    textAlign: 'center',
    padding: '48px',
    color: '#8c8c8c'
  },
  categorySection: {
    marginBottom: '24px'
  },
  categoryTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#262626',
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: '2px solid #f0f0f0'
  },
  checkItemList: {
    display: 'grid',
    gap: '12px'
  },
  checkItem: {
    padding: '16px',
    backgroundColor: '#fafafa',
    borderRadius: '6px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  checkItemLeft: {
    flex: 1
  },
  checkItemStatus: {
    fontSize: '12px',
    padding: '2px 8px',
    borderRadius: '4px',
    marginRight: '8px'
  },
  checkItemName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#262626'
  },
  checkItemDesc: {
    fontSize: '12px',
    color: '#8c8c8c',
    marginTop: '6px',
    marginLeft: '88px'
  },
  checkResult: {
    fontSize: '12px',
    color: '#595959',
    marginTop: '8px',
    marginLeft: '88px',
    padding: '8px',
    backgroundColor: '#fffbe6',
    borderRadius: '4px'
  },
  checkItemActions: {
    display: 'flex',
    gap: '8px',
    marginLeft: '16px'
  },
  smallBtn: {
    padding: '4px 12px',
    fontSize: '12px',
    border: '1px solid #d9d9d9',
    backgroundColor: 'white',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  successBtn: {
    backgroundColor: '#f6ffed',
    borderColor: '#b7eb8f',
    color: '#52c41a'
  },
  dangerBtn: {
    backgroundColor: '#fff2f0',
    borderColor: '#ffccc7',
    color: '#ff4d4f'
  },
  purpleBtn: {
    backgroundColor: '#f9f0ff',
    borderColor: '#d3adf7',
    color: '#722ed1'
  },
  blockList: {
    display: 'grid',
    gap: '12px'
  },
  blockItem: {
    padding: '16px',
    backgroundColor: '#fffbe6',
    borderRadius: '6px',
    border: '1px solid #ffe58f'
  },
  blockHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  blockReporter: {
    fontSize: '12px',
    color: '#8c8c8c'
  },
  blockReason: {
    fontSize: '14px',
    color: '#262626',
    marginBottom: '12px'
  },
  blockFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    color: '#8c8c8c'
  },
  exemptionList: {
    display: 'grid',
    gap: '12px'
  },
  exemptionItem: {
    padding: '16px',
    backgroundColor: '#f9f0ff',
    borderRadius: '6px',
    border: '1px solid #d3adf7'
  },
  exemptionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  exemptionApplicant: {
    fontSize: '12px',
    color: '#8c8c8c'
  },
  exemptionReason: {
    fontSize: '14px',
    color: '#262626',
    marginBottom: '12px'
  },
  exemptionFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    color: '#8c8c8c'
  },
  logList: {
    display: 'grid',
    gap: '8px'
  },
  logItem: {
    padding: '12px',
    backgroundColor: '#fafafa',
    borderRadius: '4px',
    display: 'flex',
    gap: '16px',
    fontSize: '14px'
  },
  logAction: {
    fontWeight: '500',
    color: '#667eea',
    minWidth: '80px'
  },
  logOperator: {
    color: '#595959',
    minWidth: '80px'
  },
  logDetails: {
    flex: 1,
    color: '#262626'
  },
  logTime: {
    color: '#8c8c8c',
    fontSize: '12px'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '8px',
    width: '500px',
    maxWidth: '90%'
  },
  modalHeader: {
    padding: '20px',
    borderBottom: '1px solid #f0f0f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#8c8c8c'
  },
  form: {
    padding: '20px'
  },
  formGroup: {
    marginBottom: '16px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#262626'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d9d9d9',
    borderRadius: '6px',
    fontSize: '14px'
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d9d9d9',
    borderRadius: '6px',
    fontSize: '14px',
    minHeight: '80px',
    resize: 'vertical'
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px'
  },
  cancelBtn: {
    padding: '10px 20px',
    border: '1px solid #d9d9d9',
    backgroundColor: 'white',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  submitBtn: {
    padding: '10px 20px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  },
  assigneeTag: {
    fontSize: '12px',
    color: '#667eea',
    backgroundColor: '#f0f2ff',
    padding: '2px 8px',
    borderRadius: '4px',
    marginLeft: '8px'
  },
  compensateBtn: {
    backgroundColor: '#fffbe6',
    borderColor: '#ffe58f',
    color: '#faad14'
  },
  statusDisplay: {
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    display: 'inline-block'
  },
  formCompensateInfo: {
    marginBottom: '16px'
  },
  compensateWarning: {
    backgroundColor: '#fffbe6',
    border: '1px solid #ffe58f',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#d48806',
    margin: 0
  }
};

export default ReleaseDetail;
