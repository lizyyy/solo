import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css';

const REVIEWER_ID = 1;
const REVIEWER_NAME = '审核员A';

const STATUS_MAP = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  supplement: '待补充'
};

function App() {
  const [merchants, setMerchants] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [reviewForm, setReviewForm] = useState({ comment: '', reviewResult: 'approved' });
  const [supplementForm, setSupplementForm] = useState({ reason: '', items: '' });

  const fetchData = async () => {
    try {
      const [merchantsRes, statsRes] = await Promise.all([
        axios.get('/api/merchants', { params: { keyword, status: statusFilter } }),
        axios.get('/api/statistics')
      ]);
      setMerchants(merchantsRes.data);
      setStatistics(statsRes.data);
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [keyword, statusFilter]);

  const handleMerchantClick = async (merchant) => {
    try {
      const res = await axios.get(`/api/merchants/${merchant.id}`);
      setSelectedMerchant(res.data);
      setShowModal(true);
      setActiveTab('info');
    } catch (error) {
      console.error('获取商户详情失败:', error);
    }
  };

  const handleValidateQualification = async (qualificationId, status) => {
    if (!selectedMerchant) return;
    try {
      const res = await axios.post(`/api/merchants/${selectedMerchant.id}/validate-qualification`, {
        qualificationId,
        status,
        reviewerId: REVIEWER_ID,
        reviewerName: REVIEWER_NAME,
        reviewComment: status === 'approved' ? '资质审核通过' : '资质不符合要求'
      });
      setSelectedMerchant(res.data.merchant);
      fetchData();
    } catch (error) {
      console.error('审核失败:', error);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewForm.comment.trim()) {
      alert('请填写审核意见');
      return;
    }
    try {
      const res = await axios.post(`/api/merchants/${selectedMerchant.id}/review-comment`, {
        reviewerId: REVIEWER_ID,
        reviewerName: REVIEWER_NAME,
        comment: reviewForm.comment,
        reviewResult: reviewForm.reviewResult
      });
      setSelectedMerchant(res.data.merchant);
      setReviewForm({ comment: '', reviewResult: 'approved' });
      fetchData();
    } catch (error) {
      console.error('提交审核失败:', error);
    }
  };

  const handleRejectSupplement = async () => {
    if (!supplementForm.reason.trim() || !supplementForm.items.trim()) {
      alert('请填写驳回原因和补充材料');
      return;
    }
    try {
      const res = await axios.post(`/api/merchants/${selectedMerchant.id}/reject-supplement`, {
        reviewerId: REVIEWER_ID,
        reviewerName: REVIEWER_NAME,
        rejectionReason: supplementForm.reason,
        supplementItems: supplementForm.items
      });
      setSelectedMerchant(res.data.merchant);
      setSupplementForm({ reason: '', items: '' });
      fetchData();
    } catch (error) {
      console.error('驳回失败:', error);
    }
  };

  const handleExportReport = () => {
    window.open('/api/export-report', '_blank');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  return (
    <div className="app">
      <div className="header">
        <h1>商户入驻资质保证金复核系统</h1>
        <p>统一管理营业执照、类目资质、保证金订单，确保数据一致性</p>
      </div>

      <div className="statistics-cards">
        <div className="stat-card total">
          <div className="label">商户总数</div>
          <div className="value">{statistics.total || 0}</div>
        </div>
        <div className="stat-card pending">
          <div className="label">待审核</div>
          <div className="value">{statistics.pending || 0}</div>
        </div>
        <div className="stat-card approved">
          <div className="label">已通过</div>
          <div className="value">{statistics.approved || 0}</div>
        </div>
        <div className="stat-card rejected">
          <div className="label">已拒绝</div>
          <div className="value">{statistics.rejected || 0}</div>
        </div>
        <div className="stat-card deposit">
          <div className="label">已缴保证金(元)</div>
          <div className="value">{(statistics.totalDeposit || 0).toLocaleString()}</div>
        </div>
      </div>

      <div className="search-filter">
        <input
          type="text"
          placeholder="搜索商户名称或编号..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">全部状态</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已拒绝</option>
          <option value="supplement">待补充</option>
        </select>
        <button className="export-btn" onClick={handleExportReport}>
          📊 导出报告
        </button>
      </div>

      <div className="merchant-list">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : merchants.length === 0 ? (
          <div className="empty">暂无商户数据</div>
        ) : (
          merchants.map((merchant) => (
            <div
              key={merchant.id}
              className="merchant-item"
              onClick={() => handleMerchantClick(merchant)}
            >
              <div className="merchant-header">
                <div>
                  <span className="merchant-name">{merchant.merchant_name}</span>
                  <span className="merchant-code">{merchant.merchant_code}</span>
                </div>
                <span className={`status-badge ${merchant.status}`}>
                  {STATUS_MAP[merchant.status] || merchant.status}
                </span>
              </div>
              <div className="merchant-info">
                <span>📋 营业执照: {merchant.license_number || '-'}</span>
                <span>🏷️ 资质状态: {STATUS_MAP[merchant.qualification_status] || '-'}</span>
                <span>💰 保证金: {merchant.deposit_status === 'paid' ? '已缴纳' : '未缴纳'}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && selectedMerchant && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>商户复核 - {selectedMerchant.merchant_name}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="tabs">
                <button
                  className={`tab ${activeTab === 'info' ? 'active' : ''}`}
                  onClick={() => setActiveTab('info')}
                >
                  基本信息
                </button>
                <button
                  className={`tab ${activeTab === 'qualification' ? 'active' : ''}`}
                  onClick={() => setActiveTab('qualification')}
                >
                  类目资质
                </button>
                <button
                  className={`tab ${activeTab === 'deposit' ? 'active' : ''}`}
                  onClick={() => setActiveTab('deposit')}
                >
                  保证金订单
                </button>
                <button
                  className={`tab ${activeTab === 'review' ? 'active' : ''}`}
                  onClick={() => setActiveTab('review')}
                >
                  审核记录
                </button>
                <button
                  className={`tab ${activeTab === 'history' ? 'active' : ''}`}
                  onClick={() => setActiveTab('history')}
                >
                  修改历史
                </button>
              </div>

              {activeTab === 'info' && selectedMerchant.businessLicense && (
                <div>
                  <div className="section">
                    <div className="section-title">商户信息</div>
                    <div className="info-grid">
                      <div className="info-item">
                        <div className="info-label">商户名称</div>
                        <div className="info-value">{selectedMerchant.merchant_name}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">商户编号</div>
                        <div className="info-value">{selectedMerchant.merchant_code}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">入驻状态</div>
                        <div className="info-value">
                          <span className={`status-badge ${selectedMerchant.status}`}>
                            {STATUS_MAP[selectedMerchant.status]}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="section">
                    <div className="section-title">营业执照信息</div>
                    <div className="info-grid">
                      <div className="info-item">
                        <div className="info-label">执照编号</div>
                        <div className="info-value">{selectedMerchant.businessLicense.license_number}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">法人代表</div>
                        <div className="info-value">{selectedMerchant.businessLicense.legal_representative}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">经营范围</div>
                        <div className="info-value">{selectedMerchant.businessLicense.business_scope}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">有效期</div>
                        <div className="info-value">
                          {selectedMerchant.businessLicense.valid_from} 至 {selectedMerchant.businessLicense.valid_to}
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedMerchant.rejectionSupplements && selectedMerchant.rejectionSupplements.length > 0 && (
                    <div className="section">
                      <div className="section-title">驳回补充记录</div>
                      {selectedMerchant.rejectionSupplements.map((item, idx) => (
                        <div key={idx} className="supplement-item">
                          <div className="reviewer-info">
                            <span className="reviewer-name">{item.reviewer_name}</span>
                            <span>{formatDate(item.created_at)}</span>
                          </div>
                          <p><strong>驳回原因：</strong>{item.rejection_reason}</p>
                          <p><strong>需补充材料：</strong>{item.supplement_items}</p>
                          <p><strong>状态：</strong>{item.status === 'pending' ? '待补充' : '已完成'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'qualification' && (
                <div>
                  <div className="section">
                    <div className="section-title">类目资质列表</div>
                    {selectedMerchant.categoryQualifications && selectedMerchant.categoryQualifications.length > 0 ? (
                      selectedMerchant.categoryQualifications.map((qual) => (
                        <div key={qual.id} className="qualification-item">
                          <div className="qualification-header">
                            <div>
                              <strong>{qual.category_name}</strong>
                              <span style={{ marginLeft: 12, color: '#666' }}>{qual.category_code}</span>
                            </div>
                            <span className={`status-badge ${qual.status}`}>
                              {STATUS_MAP[qual.status] || qual.status}
                            </span>
                          </div>
                          <div className="info-grid">
                            <div className="info-item">
                              <div className="info-label">资质类型</div>
                              <div className="info-value">{qual.qualification_type}</div>
                            </div>
                            <div className="info-item">
                              <div className="info-label">资质编号</div>
                              <div className="info-value">{qual.qualification_number || '-'}</div>
                            </div>
                            {qual.review_comment && (
                              <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                                <div className="info-label">审核备注</div>
                                <div className="info-value">{qual.review_comment}</div>
                              </div>
                            )}
                          </div>
                          {qual.status === 'pending' && (
                            <div className="action-buttons">
                              <button
                                className="btn btn-approve"
                                onClick={() => handleValidateQualification(qual.id, 'approved')}
                              >
                                ✓ 通过
                              </button>
                              <button
                                className="btn btn-reject"
                                onClick={() => handleValidateQualification(qual.id, 'rejected')}
                              >
                                ✗ 拒绝
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="empty">暂无类目资质数据</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'deposit' && (
                <div>
                  <div className="section">
                    <div className="section-title">保证金订单</div>
                    {selectedMerchant.depositOrders && selectedMerchant.depositOrders.length > 0 ? (
                      selectedMerchant.depositOrders.map((deposit) => (
                        <div key={deposit.id} className="deposit-item">
                          <div className="deposit-header">
                            <div>
                              <strong>订单号：</strong>{deposit.order_number}
                            </div>
                            <span className={`status-badge ${deposit.payment_status === 'paid' ? 'approved' : 'pending'}`}>
                              {deposit.payment_status === 'paid' ? '已缴纳' : '未缴纳'}
                            </span>
                          </div>
                          <div className="info-grid">
                            <div className="info-item">
                              <div className="info-label">保证金金额</div>
                              <div className="info-value">¥{Number(deposit.amount).toLocaleString()}</div>
                            </div>
                            <div className="info-item">
                              <div className="info-label">所属类目</div>
                              <div className="info-value">{deposit.category}</div>
                            </div>
                            <div className="info-item">
                              <div className="info-label">缴纳时间</div>
                              <div className="info-value">{formatDate(deposit.payment_time)}</div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty">暂无保证金订单</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'review' && (
                <div>
                  <div className="section">
                    <div className="section-title">提交审核意见</div>
                    <div className="review-form">
                      <div className="form-group">
                        <label>审核结果</label>
                        <select
                          value={reviewForm.reviewResult}
                          onChange={(e) => setReviewForm({ ...reviewForm, reviewResult: e.target.value })}
                        >
                          <option value="approved">审核通过</option>
                          <option value="rejected">审核拒绝</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>审核意见</label>
                        <textarea
                          placeholder="请输入审核意见..."
                          value={reviewForm.comment}
                          onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                        />
                      </div>
                      <div className="form-actions">
                        <button className="btn btn-primary" onClick={handleSubmitReview}>
                          提交审核
                        </button>
                      </div>
                    </div>

                    <div className="review-form" style={{ marginTop: 24 }}>
                      <div className="section-title" style={{ borderBottomColor: '#f59e0b' }}>驳回并要求补充材料</div>
                      <div className="form-group">
                        <label>驳回原因</label>
                        <textarea
                          placeholder="请输入驳回原因..."
                          value={supplementForm.reason}
                          onChange={(e) => setSupplementForm({ ...supplementForm, reason: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>需补充材料</label>
                        <textarea
                          placeholder="请列出需要补充的材料..."
                          value={supplementForm.items}
                          onChange={(e) => setSupplementForm({ ...supplementForm, items: e.target.value })}
                        />
                      </div>
                      <div className="form-actions">
                        <button className="btn btn-secondary" onClick={handleRejectSupplement}>
                          驳回并要求补充
                        </button>
                      </div>
                    </div>
                  </div>

                  {selectedMerchant.reviewComments && selectedMerchant.reviewComments.length > 0 && (
                    <div className="section">
                      <div className="section-title">历史审核记录</div>
                      {selectedMerchant.reviewComments.map((comment, idx) => (
                        <div key={idx} className="comment-item">
                          <div className="reviewer-info">
                            <span className="reviewer-name">{comment.reviewer_name}</span>
                            <span>{formatDate(comment.created_at)}</span>
                          </div>
                          <p><strong>审核结果：</strong>
                            <span className={`status-badge ${comment.review_result}`}>
                              {comment.review_result === 'approved' ? '通过' : '拒绝'}
                            </span>
                          </p>
                          <p><strong>审核意见：</strong>{comment.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div>
                  <div className="section">
                    <div className="section-title">修改历史记录</div>
                    {selectedMerchant.modificationHistory && selectedMerchant.modificationHistory.length > 0 ? (
                      selectedMerchant.modificationHistory.map((history, idx) => (
                        <div key={idx} className="history-item">
                          <div className="change-info">
                            <span className="reviewer-name">{history.modifier_name}</span>
                            <span>{formatDate(history.modified_at)}</span>
                          </div>
                          <p>
                            <strong>修改类型：</strong>{history.field_type} - {history.field_name}
                          </p>
                          <div className="change-values">
                            <span className="old-value">{history.old_value}</span>
                            <span className="arrow">→</span>
                            <span className="new-value">{history.new_value}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty">暂无修改记录</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
