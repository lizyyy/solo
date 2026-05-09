import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface ValidationResult {
  id: string;
  qa_record_id: string;
  question: string;
  answer: string;
  cited_text: string;
  document_id: string;
  kb_title: string;
  kb_content: string;
  status: string;
  score: number;
  reason: string;
  created_at: string;
}

interface ReviewHistory {
  id: string;
  validation_result_id: string;
  previous_status: string;
  new_status: string;
  reviewer_comment: string;
  reviewer: string;
  created_at: string;
}

interface VersionHistory {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  data: string;
  created_at: string;
}

const statusOptions = [
  { value: 'reviewed_valid', label: '复核通过 - 有效引用' },
  { value: 'reviewed_invalid', label: '复核不通过 - 无效引用' },
  { value: 'pending_review', label: '待进一步复核' }
];

const statusLabels: Record<string, string> = {
  valid: '有效引用',
  missing_reference: '缺失引用',
  wrong_document: '错误文档',
  content_mismatch: '内容不匹配',
  partial_match: '部分匹配',
  pending_review: '待复核',
  reviewed_valid: '复核通过',
  reviewed_invalid: '复核不通过'
};

const ValidationResults: React.FC = () => {
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedResult, setSelectedResult] = useState<ValidationResult | null>(null);
  const [reviewHistory, setReviewHistory] = useState<ReviewHistory[]>([]);
  const [versionHistory, setVersionHistory] = useState<VersionHistory[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [reviewForm, setReviewForm] = useState({
    newStatus: '',
    comment: '',
    reviewer: ''
  });

  const fetchResults = async () => {
    try {
      const params: any = { page, pageSize };
      if (statusFilter) params.status = statusFilter;
      
      const response = await axios.get('/api/validation-results', { params });
      setResults(response.data.results);
      setTotal(response.data.total);
    } catch (error) {
      console.error('获取校验结果失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (result: ValidationResult) => {
    setSelectedResult(result);
    setReviewForm({ newStatus: '', comment: '', reviewer: '' });
    
    try {
      const qaResponse = await axios.get(`/api/qa-records/${result.qa_record_id}`);
      setReviewHistory(qaResponse.data.reviewHistory || []);
      
      const versionResponse = await axios.get(`/api/version-history/validation_result/${result.id}`);
      setVersionHistory(versionResponse.data.history || []);
    } catch (error) {
      console.error('获取详情失败:', error);
    }
  };

  const handleReview = async () => {
    if (!selectedResult || !reviewForm.newStatus) return;

    try {
      await axios.post(`/api/review/${selectedResult.id}`, {
        newStatus: reviewForm.newStatus,
        comment: reviewForm.comment,
        reviewer: reviewForm.reviewer || '匿名'
      });
      
      setMessage({ type: 'success', text: '复核成功' });
      setSelectedResult(null);
      await fetchResults();
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || '复核失败' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleRollback = async (resultId: string) => {
    const reason = prompt('请输入回滚原因（可选）：');
    
    try {
      await axios.post(`/api/rollback/${resultId}`, { reason });
      setMessage({ type: 'success', text: '回滚成功' });
      setSelectedResult(null);
      await fetchResults();
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || '回滚失败' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [page, pageSize, statusFilter]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="card">
        <div className="flex-between mb-4">
          <h2>校验结果列表</h2>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e0e0e0' }}
            >
              <option value="">全部状态</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading">加载中...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>问题</th>
                  <th>引用文本</th>
                  <th>状态</th>
                  <th>匹配度</th>
                  <th>校验时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.id}>
                    <td style={{ maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {result.question}
                      </div>
                    </td>
                    <td style={{ maxWidth: 250 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {result.cited_text || '无引用文本'}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge status-${result.status}`}>
                        {statusLabels[result.status] || result.status}
                      </span>
                    </td>
                    <td>
                      {result.score !== null ? `${(result.score * 100).toFixed(0)}%` : '-'}
                    </td>
                    <td className="text-sm text-gray">
                      {new Date(result.created_at).toLocaleString('zh-CN')}
                    </td>
                    <td>
                      <button 
                        className="btn btn-outline" 
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => fetchDetail(result)}
                      >
                        查看/复核
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))} 
              disabled={page === 1}
            >
              上一页
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
              Math.max(0, page - 3),
              Math.min(totalPages, page + 2)
            ).map(p => (
              <button 
                key={p} 
                onClick={() => setPage(p)}
                className={p === page ? 'active' : ''}
              >
                {p}
              </button>
            ))}
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
              disabled={page === totalPages}
            >
              下一页
            </button>
            <span className="text-sm text-gray" style={{ marginLeft: 16 }}>
              共 {total} 条
            </span>
          </div>
        )}
      </div>

      {selectedResult && (
        <div className="modal-overlay" onClick={() => setSelectedResult(null)}>
          <div className="modal" style={{ maxWidth: 900 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>校验详情与复核</h3>
              <button className="close-btn" onClick={() => setSelectedResult(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="flex-between mb-4">
                <span className={`status-badge status-${selectedResult.status}`}>
                  {statusLabels[selectedResult.status] || selectedResult.status}
                </span>
                {selectedResult.score !== null && (
                  <span className="text-sm text-gray">匹配度: {(selectedResult.score * 100).toFixed(1)}%</span>
                )}
              </div>

              <div className="mb-4">
                <label className="text-sm text-gray" style={{ display: 'block', marginBottom: 4 }}>问题</label>
                <p style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                  {selectedResult.question}
                </p>
              </div>

              <div className="mb-4">
                <label className="text-sm text-gray" style={{ display: 'block', marginBottom: 4 }}>回答</label>
                <p style={{ padding: 12, background: '#f8fafc', borderRadius: 8, whiteSpace: 'pre-wrap' }}>
                  {selectedResult.answer}
                </p>
              </div>

              <div className="mb-4">
                <label className="text-sm text-gray" style={{ display: 'block', marginBottom: 4 }}>系统判定理由</label>
                <p style={{ padding: 12, background: '#eef2ff', borderRadius: 8, color: '#4f46e5' }}>
                  {selectedResult.reason}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="mb-4">
                <div>
                  <label className="text-sm text-gray" style={{ display: 'block', marginBottom: 4 }}>
                    <strong>引用的文本</strong>
                  </label>
                  <div style={{ padding: 12, background: '#fef3c7', borderRadius: 8, minHeight: 100 }}>
                    {selectedResult.cited_text || '无引用文本'}
                    {selectedResult.document_id && (
                      <p className="text-sm mt-2" style={{ color: '#d97706' }}>文档ID: {selectedResult.document_id}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray" style={{ display: 'block', marginBottom: 4 }}>
                    <strong>知识库原文</strong>
                  </label>
                  <div style={{ padding: 12, background: '#d1fae5', borderRadius: 8, minHeight: 100 }}>
                    {selectedResult.kb_title && (
                      <p className="text-sm" style={{ color: '#059669', marginBottom: 4 }}>
                        标题: {selectedResult.kb_title}
                      </p>
                    )}
                    {selectedResult.kb_content || '知识库中无对应条目'}
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h4 style={{ marginBottom: 12, color: '#333' }}>人工复核</h4>
                <div className="form-group">
                  <label>复核结论 *</label>
                  <select
                    value={reviewForm.newStatus}
                    onChange={(e) => setReviewForm({ ...reviewForm, newStatus: e.target.value })}
                  >
                    <option value="">请选择复核结论</option>
                    {statusOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>复核意见</label>
                  <textarea
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                    placeholder="请说明复核理由..."
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label>复核人</label>
                  <input
                    type="text"
                    value={reviewForm.reviewer}
                    onChange={(e) => setReviewForm({ ...reviewForm, reviewer: e.target.value })}
                    placeholder="您的姓名或工号"
                  />
                </div>
              </div>

              {(reviewHistory.length > 0 || versionHistory.length > 0) && (
                <div>
                  <div className="tabs">
                    <div className="tab active">复核历史 ({reviewHistory.length})</div>
                  </div>
                  
                  {reviewHistory.length > 0 && (
                    <div>
                      {reviewHistory.map((item) => (
                        <div key={item.id} className="history-item">
                          <div className="flex-between" style={{ marginBottom: 4 }}>
                            <span className="action">
                              <span className={`status-badge status-${item.previous_status}`} style={{ marginRight: 8 }}>
                                {statusLabels[item.previous_status]}
                              </span>
                              →
                              <span className={`status-badge status-${item.new_status}`} style={{ marginLeft: 8 }}>
                                {statusLabels[item.new_status]}
                              </span>
                            </span>
                            <span className="text-sm">{item.reviewer}</span>
                          </div>
                          {item.reviewer_comment && (
                            <p className="text-sm" style={{ marginTop: 4 }}>{item.reviewer_comment}</p>
                          )}
                          <div className="time">{new Date(item.created_at).toLocaleString('zh-CN')}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {versionHistory.length > 0 && (
                    <div className="mt-4">
                      <h5 className="text-sm text-gray" style={{ marginBottom: 8 }}>版本记录</h5>
                      {versionHistory.map((item) => (
                        <div key={item.id} className="history-item" style={{ borderLeftColor: '#10b981' }}>
                          <div className="flex-between">
                            <span className="action">{item.action === 'create' ? '创建' : item.action === 'update' ? '更新' : item.action}</span>
                            <span className="time">{new Date(item.created_at).toLocaleString('zh-CN')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => handleRollback(selectedResult.id)}
                title="撤销最近一次复核操作"
              >
                ↩️ 回滚
              </button>
              <button className="btn btn-secondary" onClick={() => setSelectedResult(null)}>
                关闭
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleReview}
                disabled={!reviewForm.newStatus}
              >
                提交复核
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidationResults;
