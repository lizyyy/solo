import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api';

const STATUS_TEXT = {
  pending: '待复核',
  approved: '可发放',
  quarantine: '隔离',
  discarded: '报废'
};

const STATUS_CLASS = {
  pending: 'status-pending',
  approved: 'status-approved',
  quarantine: 'status-quarantine',
  discarded: 'status-discarded'
};

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [batches, setBatches] = useState([]);
  const [infantRequests, setInfantRequests] = useState([]);
  const [donorScreenings, setDonorScreenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [reviewForm, setReviewForm] = useState({
    reviewer: '',
    status: '',
    risk_assessment: '',
    notes: ''
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [batchesRes, requestsRes, screeningsRes] = await Promise.all([
        fetch(`${API_BASE}/batches`),
        fetch(`${API_BASE}/infant-requests`),
        fetch(`${API_BASE}/donor-screenings`)
      ]);

      const batchesData = await batchesRes.json();
      const requestsData = await requestsRes.json();
      const screeningsData = await screeningsRes.json();

      setBatches(batchesData);
      setInfantRequests(requestsData);
      setDonorScreenings(screeningsData);
    } catch (error) {
      console.error('获取数据失败:', error);
      setMessage({ type: 'error', text: '获取数据失败，请检查服务器连接' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const importSampleData = async () => {
    try {
      const response = await fetch(`${API_BASE}/import-sample-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (response.ok) {
        showMessage('success', `示例数据导入成功！导入了 ${data.count.batches} 个批次，${data.count.infantRequests} 个领用申请`);
        fetchData();
      } else {
        showMessage('error', data.error || '导入失败');
      }
    } catch (error) {
      showMessage('error', '导入失败：' + error.message);
    }
  };

  const exportMarkdown = () => {
    window.open(`${API_BASE}/export/markdown`, '_blank');
  };

  const exportJson = () => {
    window.open(`${API_BASE}/export/json`, '_blank');
  };

  const openBatchDetail = (batch) => {
    setSelectedBatch(batch);
    setReviewForm({
      reviewer: '',
      status: batch.status || 'pending',
      risk_assessment: '',
      notes: ''
    });
    setShowModal(true);
  };

  const submitReview = async () => {
    if (!reviewForm.reviewer.trim()) {
      showMessage('error', '请输入复核人姓名');
      return;
    }

    try {
      const reviewData = {
        batch_id: selectedBatch.id,
        review_date: new Date().toISOString().split('T')[0],
        reviewer: reviewForm.reviewer,
        status: reviewForm.status,
        risk_assessment: reviewForm.risk_assessment,
        notes: reviewForm.notes
      };

      await fetch(`${API_BASE}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewData)
      });

      await fetch(`${API_BASE}/batches/${selectedBatch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedBatch,
          status: reviewForm.status
        })
      });

      showMessage('success', '复核完成，状态已更新');
      setShowModal(false);
      fetchData();
    } catch (error) {
      showMessage('error', '提交失败：' + error.message);
    }
  };

  const filteredBatches = batches.filter(batch => {
    const matchesSearch = 
      batch.batch_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.donor_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || batch.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: batches.length,
    pending: batches.filter(b => b.status === 'pending').length,
    approved: batches.filter(b => b.status === 'approved').length,
    quarantine: batches.filter(b => b.status === 'quarantine').length,
    discarded: batches.filter(b => b.status === 'discarded').length
  };

  const parseRiskReasons = (riskReasons) => {
    try {
      return JSON.parse(riskReasons || '[]');
    } catch {
      return [];
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <h1>🍼 母乳库值班放行复核系统</h1>
        <p>整合捐乳者筛查、巴氏消毒、冰箱温度、细菌培养和早产儿领用申请，进行风险评估和放行决策</p>
      </header>

      {message && (
        <div className={`alert alert-${message.type === 'error' ? 'danger' : message.type}`}>
          {message.text}
        </div>
      )}

      <nav className="navbar">
        <button 
          className={activeTab === 'dashboard' ? 'active' : ''}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 概览
        </button>
        <button 
          className={activeTab === 'batches' ? 'active' : ''}
          onClick={() => setActiveTab('batches')}
        >
          📦 批次管理
        </button>
        <button 
          className={activeTab === 'requests' ? 'active' : ''}
          onClick={() => setActiveTab('requests')}
        >
          👶 领用申请
        </button>
        <button 
          className={activeTab === 'screenings' ? 'active' : ''}
          onClick={() => setActiveTab('screenings')}
        >
          📋 捐乳者筛查
        </button>
        <button 
          className={activeTab === 'export' ? 'active' : ''}
          onClick={() => setActiveTab('export')}
        >
          📄 导出
        </button>
      </nav>

      {activeTab === 'dashboard' && (
        <div>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>总批次数</h3>
              <div className="value">{stats.total}</div>
            </div>
            <div className="stat-card pending">
              <h3>待复核</h3>
              <div className="value">{stats.pending}</div>
            </div>
            <div className="stat-card approved">
              <h3>可发放</h3>
              <div className="value">{stats.approved}</div>
            </div>
            <div className="stat-card quarantine">
              <h3>隔离中</h3>
              <div className="value">{stats.quarantine}</div>
            </div>
            <div className="stat-card discarded">
              <h3>已报废</h3>
              <div className="value">{stats.discarded}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>最近批次</h2>
              <button className="btn btn-primary" onClick={() => setActiveTab('batches')}>
                查看全部
              </button>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>批次号</th>
                    <th>捐乳者</th>
                    <th>采集日期</th>
                    <th>消毒温度</th>
                    <th>状态</th>
                    <th>风险</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.slice(0, 5).map(batch => {
                    const risks = parseRiskReasons(batch.risk_reasons);
                    return (
                      <tr key={batch.id}>
                        <td><strong>{batch.batch_number}</strong></td>
                        <td>{batch.donor_name}</td>
                        <td>{batch.collection_date}</td>
                        <td>{batch.pasteurization_temp}°C</td>
                        <td>
                          <span className={`status-badge ${STATUS_CLASS[batch.status]}`}>
                            {STATUS_TEXT[batch.status]}
                          </span>
                        </td>
                        <td>
                          {risks.length > 0 ? (
                            <span className="status-badge status-quarantine">
                              {risks.length} 项风险
                            </span>
                          ) : (
                            <span className="status-badge status-approved">无风险</span>
                          )}
                        </td>
                        <td>
                          <button 
                            className="btn btn-secondary"
                            onClick={() => openBatchDetail(batch)}
                          >
                            详情
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>早产儿领用申请</h2>
              <button className="btn btn-primary" onClick={() => setActiveTab('requests')}>
                查看全部
              </button>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>申请号</th>
                    <th>婴儿姓名</th>
                    <th>孕周</th>
                    <th>体重</th>
                    <th>申请量</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {infantRequests.slice(0, 3).map(request => (
                    <tr key={request.id}>
                      <td><strong>{request.request_id}</strong></td>
                      <td>{request.infant_name}</td>
                      <td>{request.gestational_age}周</td>
                      <td>{request.weight}g</td>
                      <td>{request.requested_ml}ml</td>
                      <td>
                        <span className={`status-badge ${STATUS_CLASS[request.status]}`}>
                          {STATUS_TEXT[request.status] || request.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>快速操作</h2>
            </div>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={importSampleData}>
                📥 导入示例数据
              </button>
              <button className="btn btn-success" onClick={exportMarkdown}>
                📄 导出 Markdown 交接单
              </button>
              <button className="btn btn-secondary" onClick={exportJson}>
                📋 导出 JSON 审计包
              </button>
              <button className="btn btn-primary" onClick={() => setActiveTab('batches')}>
                🔍 开始复核批次
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'batches' && (
        <div>
          <div className="card">
            <div className="action-bar">
              <div>
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder="搜索批次号或捐乳者..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select 
                  className="filter-select" 
                  style={{ marginLeft: '10px' }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">全部状态</option>
                  <option value="pending">待复核</option>
                  <option value="approved">可发放</option>
                  <option value="quarantine">隔离</option>
                  <option value="discarded">报废</option>
                </select>
              </div>
              <div className="btn-group">
                <button className="btn btn-primary" onClick={importSampleData}>
                  📥 导入示例数据
                </button>
                <button className="btn btn-success" onClick={fetchData}>
                  🔄 刷新
                </button>
              </div>
            </div>
          </div>

          {filteredBatches.length === 0 ? (
            <div className="card">
              <div className="alert alert-info">
                {batches.length === 0 ? 
                  '暂无批次数据，请点击"导入示例数据"按钮开始测试' : 
                  '没有匹配的批次，请调整搜索条件'
                }
              </div>
            </div>
          ) : (
            filteredBatches.map(batch => {
              const risks = parseRiskReasons(batch.risk_reasons);
              const screening = donorScreenings.find(s => s.donor_id === batch.donor_id);
              
              return (
                <div className="card" key={batch.id}>
                  <div className="card-header">
                    <h2>批次: {batch.batch_number}</h2>
                    <span className={`status-badge ${STATUS_CLASS[batch.status]}`}>
                      {STATUS_TEXT[batch.status]}
                    </span>
                  </div>

                  <div className="detail-grid">
                    <div className="detail-section">
                      <h4>📋 基本信息</h4>
                      <div className="detail-item">
                        <span className="label">批次号</span>
                        <span className="value">{batch.batch_number}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">捐乳者</span>
                        <span className="value">{batch.donor_name} ({batch.donor_id})</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">采集日期</span>
                        <span className="value">{batch.collection_date}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">消毒日期</span>
                        <span className="value">{batch.pasteurization_date}</span>
                      </div>
                    </div>

                    <div className="detail-section">
                      <h4>🔬 消毒信息</h4>
                      <div className="detail-item">
                        <span className="label">消毒温度</span>
                        <span className="value">{batch.pasteurization_temp}°C</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">消毒时长</span>
                        <span className="value">{batch.pasteurization_duration}分钟</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">冰箱温度记录</span>
                        <span className="value">{batch.fridge_temp_log || '无'}</span>
                      </div>
                    </div>

                    <div className="detail-section">
                      <h4>👩⚕️ 捐乳者筛查</h4>
                      {screening ? (
                        <>
                          <div className="detail-item">
                            <span className="label">筛查日期</span>
                            <span className="value">{screening.screening_date}</span>
                          </div>
                          <div className="detail-item">
                            <span className="label">血液检测</span>
                            <span className="value">{screening.blood_test_result}</span>
                          </div>
                          <div className="detail-item">
                            <span className="label">总体结果</span>
                            <span className={`value ${screening.overall_result === '合格' ? 'text-success' : ''}`}>
                              {screening.overall_result}
                            </span>
                          </div>
                          <div className="detail-item">
                            <span className="label">备注</span>
                            <span className="value">{screening.notes || '无'}</span>
                          </div>
                        </>
                      ) : (
                        <p style={{ color: '#999', fontSize: '13px' }}>未找到该捐乳者的筛查记录</p>
                      )}
                    </div>
                  </div>

                  {risks.length > 0 && (
                    <div style={{ marginTop: '15px' }}>
                      <h4 style={{ marginBottom: '10px', color: '#dc3545' }}>⚠️ 风险因素</h4>
                      {risks.map((risk, idx) => (
                        <div key={idx} className={`risk-item ${risk.type?.includes('严重') ? 'danger' : ''}`}>
                          <strong>{risk.type || '风险'}</strong>: {risk.reason || risk}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                    <div className="btn-group">
                      <button 
                        className="btn btn-primary"
                        onClick={() => openBatchDetail(batch)}
                      >
                        🔍 查看详情并复核
                      </button>
                      <button 
                        className="btn btn-success"
                        onClick={async () => {
                          setSelectedBatch(batch);
                          setReviewForm({
                            reviewer: '系统自动',
                            status: 'approved',
                            risk_assessment: '无风险，可安全发放',
                            notes: ''
                          });
                          try {
                            await fetch(`${API_BASE}/batches/${batch.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                ...batch,
                                status: 'approved'
                              })
                            });
                            showMessage('success', '已标记为可发放');
                            fetchData();
                          } catch (error) {
                            showMessage('error', '操作失败');
                          }
                        }}
                        disabled={batch.status === 'approved'}
                      >
                        ✅ 快速放行
                      </button>
                      <button 
                        className="btn btn-warning"
                        onClick={async () => {
                          try {
                            await fetch(`${API_BASE}/batches/${batch.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                ...batch,
                                status: 'quarantine'
                              })
                            });
                            showMessage('success', '已标记为隔离');
                            fetchData();
                          } catch (error) {
                            showMessage('error', '操作失败');
                          }
                        }}
                        disabled={batch.status === 'quarantine'}
                      >
                        ⚠️ 隔离
                      </button>
                      <button 
                        className="btn btn-danger"
                        onClick={async () => {
                          if (window.confirm('确定要将此批次标记为报废吗？此操作需要谨慎！')) {
                            try {
                              await fetch(`${API_BASE}/batches/${batch.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  ...batch,
                                  status: 'discarded'
                                })
                              });
                              showMessage('success', '已标记为报废');
                              fetchData();
                            } catch (error) {
                              showMessage('error', '操作失败');
                            }
                          }
                        }}
                        disabled={batch.status === 'discarded'}
                      >
                        🗑️ 报废
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'requests' && (
        <div>
          <div className="card">
            <div className="card-header">
              <h2>👶 早产儿领用申请</h2>
              <button className="btn btn-success" onClick={fetchData}>
                🔄 刷新
              </button>
            </div>

            {infantRequests.length === 0 ? (
              <div className="alert alert-info">
                暂无领用申请数据，请先导入示例数据
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>申请号</th>
                      <th>婴儿姓名</th>
                      <th>出生日期</th>
                      <th>孕周</th>
                      <th>体重</th>
                      <th>医疗情况</th>
                      <th>申请量</th>
                      <th>申请日期</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {infantRequests.map(request => (
                      <tr key={request.id}>
                        <td><strong>{request.request_id}</strong></td>
                        <td>{request.infant_name}</td>
                        <td>{request.infant_dob}</td>
                        <td>{request.gestational_age}周</td>
                        <td>{request.weight}g</td>
                        <td>{request.medical_condition}</td>
                        <td>{request.requested_ml}ml</td>
                        <td>{request.request_date}</td>
                        <td>
                          <span className={`status-badge ${STATUS_CLASS[request.status]}`}>
                            {STATUS_TEXT[request.status] || request.status}
                          </span>
                        </td>
                        <td>
                          <div className="btn-group">
                            <button 
                              className="btn btn-success btn-sm"
                              onClick={async () => {
                                try {
                                  await fetch(`${API_BASE}/infant-requests/${request.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      ...request,
                                      status: 'approved'
                                    })
                                  });
                                  showMessage('success', '已批准申请');
                                  fetchData();
                                } catch (error) {
                                  showMessage('error', '操作失败');
                                }
                              }}
                            >
                              批准
                            </button>
                            <button 
                              className="btn btn-danger btn-sm"
                              onClick={async () => {
                                try {
                                  await fetch(`${API_BASE}/infant-requests/${request.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      ...request,
                                      status: 'rejected'
                                    })
                                  });
                                  showMessage('success', '已拒绝申请');
                                  fetchData();
                                } catch (error) {
                                  showMessage('error', '操作失败');
                                }
                              }}
                            >
                              拒绝
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'screenings' && (
        <div>
          <div className="card">
            <div className="card-header">
              <h2>📋 捐乳者筛查记录</h2>
              <button className="btn btn-success" onClick={fetchData}>
                🔄 刷新
              </button>
            </div>

            {donorScreenings.length === 0 ? (
              <div className="alert alert-info">
                暂无捐乳者筛查数据，请先导入示例数据
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>捐乳者ID</th>
                      <th>姓名</th>
                      <th>筛查日期</th>
                      <th>血液检测</th>
                      <th>传染病</th>
                      <th>用药情况</th>
                      <th>总体结果</th>
                      <th>备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donorScreenings.map(screening => (
                      <tr key={screening.id}>
                        <td><strong>{screening.donor_id}</strong></td>
                        <td>{screening.donor_name}</td>
                        <td>{screening.screening_date}</td>
                        <td>{screening.blood_test_result}</td>
                        <td>{screening.infectious_diseases}</td>
                        <td>{screening.medications}</td>
                        <td>
                          <span className={`status-badge ${screening.overall_result === '合格' ? 'status-approved' : 'status-quarantine'}`}>
                            {screening.overall_result}
                          </span>
                        </td>
                        <td>{screening.notes || '无'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'export' && (
        <div>
          <div className="card">
            <div className="card-header">
              <h2>📄 数据导出</h2>
            </div>
            
            <div className="detail-grid">
              <div className="card">
                <h3 style={{ marginBottom: '15px' }}>📝 Markdown 放行交接单</h3>
                <p style={{ color: '#666', marginBottom: '15px' }}>
                  导出包含所有批次状态、早产儿领用申请和复核记录的 Markdown 格式交接单，用于打印或存档。
                </p>
                <button className="btn btn-primary" onClick={exportMarkdown}>
                  导出 Markdown 交接单
                </button>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: '15px' }}>📋 JSON 审计包</h3>
                <p style={{ color: '#666', marginBottom: '15px' }}>
                  导出包含所有数据的 JSON 格式审计包，用于数据备份、审计或与其他系统集成。
                </p>
                <button className="btn btn-secondary" onClick={exportJson}>
                  导出 JSON 审计包
                </button>
              </div>
            </div>

            <div className="card" style={{ marginTop: '20px' }}>
              <h3 style={{ marginBottom: '15px' }}>📥 数据导入</h3>
              <p style={{ color: '#666', marginBottom: '15px' }}>
                导入示例数据用于测试和演示。此操作将清空现有数据并导入预设的示例数据。
              </p>
              <button className="btn btn-warning" onClick={importSampleData}>
                导入示例数据
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && selectedBatch && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>批次复核: {selectedBatch.batch_number}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>&times;</button>
            </div>

            <div className="detail-grid" style={{ marginBottom: '20px' }}>
              <div className="detail-section">
                <h4>📋 批次信息</h4>
                <div className="detail-item">
                  <span className="label">批次号</span>
                  <span className="value">{selectedBatch.batch_number}</span>
                </div>
                <div className="detail-item">
                  <span className="label">捐乳者</span>
                  <span className="value">{selectedBatch.donor_name}</span>
                </div>
                <div className="detail-item">
                  <span className="label">采集日期</span>
                  <span className="value">{selectedBatch.collection_date}</span>
                </div>
                <div className="detail-item">
                  <span className="label">当前状态</span>
                  <span className={`status-badge ${STATUS_CLASS[selectedBatch.status]}`}>
                    {STATUS_TEXT[selectedBatch.status]}
                  </span>
                </div>
              </div>

              <div className="detail-section">
                <h4>🔬 技术参数</h4>
                <div className="detail-item">
                  <span className="label">消毒温度</span>
                  <span className="value">{selectedBatch.pasteurization_temp}°C</span>
                </div>
                <div className="detail-item">
                  <span className="label">消毒时长</span>
                  <span className="value">{selectedBatch.pasteurization_duration}分钟</span>
                </div>
                <div className="detail-item">
                  <span className="label">冰箱温度</span>
                  <span className="value">{selectedBatch.fridge_temp_log || '无'}</span>
                </div>
              </div>
            </div>

            {parseRiskReasons(selectedBatch.risk_reasons).length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '10px', color: '#dc3545' }}>⚠️ 风险因素</h4>
                {parseRiskReasons(selectedBatch.risk_reasons).map((risk, idx) => (
                  <div key={idx} className={`risk-item ${risk.type?.includes('严重') ? 'danger' : ''}`}>
                    <strong>{risk.type || '风险'}</strong>: {risk.reason || risk}
                  </div>
                ))}
              </div>
            )}

            <div style={{ borderTop: '1px solid #eee', paddingTop: '20px' }}>
              <h4 style={{ marginBottom: '15px' }}>📝 复核表单</h4>
              
              <div className="form-group">
                <label>复核人姓名 *</label>
                <input 
                  type="text" 
                  value={reviewForm.reviewer}
                  onChange={(e) => setReviewForm({...reviewForm, reviewer: e.target.value})}
                  placeholder="请输入复核人姓名"
                />
              </div>

              <div className="form-group">
                <label>复核状态</label>
                <select 
                  value={reviewForm.status}
                  onChange={(e) => setReviewForm({...reviewForm, status: e.target.value})}
                >
                  <option value="pending">待复核</option>
                  <option value="approved">可发放</option>
                  <option value="quarantine">隔离</option>
                  <option value="discarded">报废</option>
                </select>
              </div>

              <div className="form-group">
                <label>风险评估</label>
                <textarea 
                  value={reviewForm.risk_assessment}
                  onChange={(e) => setReviewForm({...reviewForm, risk_assessment: e.target.value})}
                  placeholder="请详细描述风险评估结果..."
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>复核备注</label>
                <textarea 
                  value={reviewForm.notes}
                  onChange={(e) => setReviewForm({...reviewForm, notes: e.target.value})}
                  placeholder="其他备注信息..."
                  rows="2"
                />
              </div>

              <div className="btn-group" style={{ marginTop: '20px' }}>
                <button 
                  className="btn btn-success"
                  onClick={submitReview}
                >
                  ✅ 提交复核
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
