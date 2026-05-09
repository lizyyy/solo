import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

interface Citation {
  id: string;
  knowledge_base_id: string | null;
  document_id: string | null;
  cited_text: string | null;
}

interface QARecord {
  id: string;
  question: string;
  answer: string;
  citations: Citation[];
  validations: any[];
  created_at: string;
}

const QARecords: React.FC = () => {
  const [records, setRecords] = useState<QARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<QARecord | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newRecord, setNewRecord] = useState({
    question: '',
    answer: '',
    citations: [{ knowledge_base_id: '', document_id: '', cited_text: '' }]
  });

  const fetchRecords = async () => {
    try {
      const response = await axios.get('/api/qa-records', {
        params: { page, pageSize, search }
      });
      setRecords(response.data.records);
      setTotal(response.data.total);
    } catch (error) {
      console.error('获取问答记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecordDetail = async (id: string) => {
    try {
      const response = await axios.get(`/api/qa-records/${id}`);
      setSelectedRecord(response.data);
    } catch (error) {
      console.error('获取记录详情失败:', error);
    }
  };

  const handleAddRecord = async () => {
    if (!newRecord.question || !newRecord.answer) {
      setMessage({ type: 'error', text: '请填写问题和回答' });
      return;
    }

    const validCitations = newRecord.citations.filter(c => c.cited_text || c.knowledge_base_id || c.document_id);

    try {
      await axios.post('/api/qa-records', {
        question: newRecord.question,
        answer: newRecord.answer,
        citations: validCitations.length > 0 ? validCitations : undefined
      });
      setShowAddModal(false);
      setNewRecord({
        question: '',
        answer: '',
        citations: [{ knowledge_base_id: '', document_id: '', cited_text: '' }]
      });
      setMessage({ type: 'success', text: '添加成功' });
      await fetchRecords();
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || '添加失败' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const response = await axios.post('/api/qa-records/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessage({ type: 'success', text: `成功导入 ${response.data.imported} 条记录` });
      await fetchRecords();
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || '导入失败' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleValidate = async (recordId: string) => {
    try {
      setLoading(true);
      const response = await axios.post(`/api/validate/${recordId}`);
      setMessage({ type: 'success', text: `校验完成，共 ${response.data.results.length} 条结果` });
      await fetchRecords();
      if (selectedRecord?.id === recordId) {
        await fetchRecordDetail(recordId);
      }
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || '校验失败' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const addCitation = () => {
    setNewRecord({
      ...newRecord,
      citations: [...newRecord.citations, { knowledge_base_id: '', document_id: '', cited_text: '' }]
    });
  };

  const updateCitation = (index: number, field: string, value: string) => {
    const updated = [...newRecord.citations];
    (updated[index] as any)[field] = value;
    setNewRecord({ ...newRecord, citations: updated });
  };

  const removeCitation = (index: number) => {
    if (newRecord.citations.length > 1) {
      setNewRecord({
        ...newRecord,
        citations: newRecord.citations.filter((_, i) => i !== index)
      });
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [page, pageSize]);

  const totalPages = Math.ceil(total / pageSize);

  const getStatusLabel = (validations: any[]) => {
    if (!validations || validations.length === 0) return { label: '未校验', class: 'status-pending_review' };
    const hasError = validations.some(v => 
      ['missing_reference', 'wrong_document', 'content_mismatch', 'reviewed_invalid'].includes(v.status)
    );
    const hasPartial = validations.some(v => ['partial_match', 'pending_review'].includes(v.status));
    
    if (hasError) return { label: '存在问题', class: 'status-missing_reference' };
    if (hasPartial) return { label: '部分匹配', class: 'status-partial_match' };
    return { label: '已校验', class: 'status-valid' };
  };

  return (
    <div>
      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="card">
        <div className="flex-between mb-4">
          <h2>问答记录管理</h2>
          <div className="flex gap-2">
            <button 
              className="btn btn-outline" 
              onClick={() => fileInputRef.current?.click()}
            >
              📥 导入文件
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload}
              accept=".csv,.json,.xlsx,.xls"
              style={{ display: 'none' }}
            />
            <button 
              className="btn btn-primary" 
              onClick={() => setShowAddModal(true)}
            >
              ➕ 添加记录
            </button>
          </div>
        </div>

        <div className="form-group mb-4">
          <input
            type="text"
            placeholder="搜索问题或回答..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchRecords()}
          />
        </div>

        {loading ? (
          <div className="loading">加载中...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>问题</th>
                  <th>引用数量</th>
                  <th>校验状态</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const status = getStatusLabel(record.validations);
                  return (
                    <tr key={record.id}>
                      <td style={{ maxWidth: 300 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {record.question}
                        </div>
                      </td>
                      <td>{record.citations?.length || 0}</td>
                      <td>
                        <span className={`status-badge ${status.class}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="text-sm text-gray">
                        {new Date(record.created_at).toLocaleString('zh-CN')}
                      </td>
                      <td>
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => fetchRecordDetail(record.id)}
                        >
                          详情
                        </button>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '6px 12px', fontSize: '12px', marginLeft: '8px' }}
                          onClick={() => handleValidate(record.id)}
                        >
                          校验
                        </button>
                      </td>
                    </tr>
                  );
                })}
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

      {selectedRecord && (
        <div className="modal-overlay" onClick={() => setSelectedRecord(null)}>
          <div className="modal" style={{ maxWidth: 800 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>问答记录详情</h3>
              <button className="close-btn" onClick={() => setSelectedRecord(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="mb-4">
                <label className="text-sm text-gray" style={{ display: 'block', marginBottom: 4 }}>问题</label>
                <p style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                  {selectedRecord.question}
                </p>
              </div>
              <div className="mb-4">
                <label className="text-sm text-gray" style={{ display: 'block', marginBottom: 4 }}>回答</label>
                <p style={{ padding: 12, background: '#f8fafc', borderRadius: 8, whiteSpace: 'pre-wrap' }}>
                  {selectedRecord.answer}
                </p>
              </div>
              
              {selectedRecord.citations && selectedRecord.citations.length > 0 && (
                <div className="mb-4">
                  <label className="text-sm text-gray" style={{ display: 'block', marginBottom: 8 }}>引用列表</label>
                  {selectedRecord.citations.map((citation, index) => (
                    <div key={citation.id} style={{ padding: 12, background: '#f8fafc', borderRadius: 8, marginBottom: 8 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        {citation.knowledge_base_id && (
                          <span className="badge">KB ID: {citation.knowledge_base_id}</span>
                        )}
                        {citation.document_id && (
                          <span className="badge">文档: {citation.document_id}</span>
                        )}
                      </div>
                      {citation.cited_text && (
                        <p className="text-sm">引用文本: {citation.cited_text}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {selectedRecord.validations && selectedRecord.validations.length > 0 && (
                <div className="mb-4">
                  <label className="text-sm text-gray" style={{ display: 'block', marginBottom: 8 }}>校验结果</label>
                  {selectedRecord.validations.map((validation: any) => (
                    <div key={validation.id} style={{ padding: 12, background: '#f8fafc', borderRadius: 8, marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span className={`status-badge status-${validation.status}`}>
                          {validation.status.replace('_', ' ')}
                        </span>
                        {validation.score !== null && (
                          <span className="text-sm text-gray">
                            匹配度: {((validation.score || 0) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <p className="text-sm">{validation.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  handleValidate(selectedRecord.id);
                }}
              >
                重新校验
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => setSelectedRecord(null)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>添加问答记录</h3>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>问题 *</label>
                <textarea
                  value={newRecord.question}
                  onChange={(e) => setNewRecord({ ...newRecord, question: e.target.value })}
                  placeholder="用户的问题"
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>回答 *</label>
                <textarea
                  value={newRecord.answer}
                  onChange={(e) => setNewRecord({ ...newRecord, answer: e.target.value })}
                  placeholder="系统生成的回答"
                  rows={5}
                />
              </div>
              <div>
                <div className="flex-between mb-2">
                  <label className="text-sm text-gray">引用（可选）</label>
                  <button 
                    className="btn btn-outline" 
                    style={{ padding: '4px 12px', fontSize: '12px' }}
                    onClick={addCitation}
                  >
                    + 添加引用
                  </button>
                </div>
                {newRecord.citations.map((citation, index) => (
                  <div key={index} style={{ padding: 12, background: '#f8fafc', borderRadius: 8, marginBottom: 8 }}>
                    <div className="flex-between mb-2">
                      <span className="text-sm">引用 #{index + 1}</span>
                      {newRecord.citations.length > 1 && (
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '2px 8px', fontSize: '11px' }}
                          onClick={() => removeCitation(index)}
                        >
                          删除
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="知识库ID（可选）"
                      value={citation.knowledge_base_id}
                      onChange={(e) => updateCitation(index, 'knowledge_base_id', e.target.value)}
                      style={{ marginBottom: 8 }}
                    />
                    <input
                      type="text"
                      placeholder="文档ID（可选）"
                      value={citation.document_id}
                      onChange={(e) => updateCitation(index, 'document_id', e.target.value)}
                      style={{ marginBottom: 8 }}
                    />
                    <textarea
                      placeholder="引用的文本内容"
                      value={citation.cited_text}
                      onChange={(e) => updateCitation(index, 'cited_text', e.target.value)}
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleAddRecord}>
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QARecords;
