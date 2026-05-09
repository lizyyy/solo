import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

interface KBEntry {
  id: string;
  document_id: string;
  title: string;
  content: string;
  created_at: string;
}

const KnowledgeBase: React.FC = () => {
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEntry, setNewEntry] = useState({ document_id: '', title: '', content: '' });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchEntries = async () => {
    try {
      const response = await axios.get('/api/knowledge-base', {
        params: { page, pageSize, search }
      });
      setEntries(response.data.records);
      setTotal(response.data.total);
    } catch (error) {
      console.error('获取知识库数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async () => {
    if (!newEntry.document_id || !newEntry.title || !newEntry.content) {
      setMessage({ type: 'error', text: '请填写所有必填字段' });
      return;
    }

    try {
      await axios.post('/api/knowledge-base', newEntry);
      setShowAddModal(false);
      setNewEntry({ document_id: '', title: '', content: '' });
      setMessage({ type: 'success', text: '添加成功' });
      await fetchEntries();
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
      const response = await axios.post('/api/knowledge-base/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessage({ type: 'success', text: `成功导入 ${response.data.imported} 条记录` });
      await fetchEntries();
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || '导入失败' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEntries();
  };

  useEffect(() => {
    fetchEntries();
  }, [page, pageSize]);

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
          <h2>知识库管理</h2>
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
              ➕ 添加条目
            </button>
          </div>
        </div>

        <form onSubmit={handleSearch} className="mb-4">
          <div className="form-group">
            <input
              type="text"
              placeholder="搜索标题、内容或文档ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </form>

        {loading ? (
          <div className="loading">加载中...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>文档ID</th>
                  <th>标题</th>
                  <th>内容预览</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <span className="badge">{entry.document_id}</span>
                    </td>
                    <td style={{ maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.title}
                      </div>
                    </td>
                    <td style={{ maxWidth: 400 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.content.substring(0, 100)}...
                      </div>
                    </td>
                    <td className="text-sm text-gray">
                      {new Date(entry.created_at).toLocaleString('zh-CN')}
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

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>添加知识条目</h3>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>文档ID *</label>
                <input
                  type="text"
                  value={newEntry.document_id}
                  onChange={(e) => setNewEntry({ ...newEntry, document_id: e.target.value })}
                  placeholder="例如: doc_001"
                />
              </div>
              <div className="form-group">
                <label>标题 *</label>
                <input
                  type="text"
                  value={newEntry.title}
                  onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                  placeholder="知识条目的标题"
                />
              </div>
              <div className="form-group">
                <label>内容 *</label>
                <textarea
                  value={newEntry.content}
                  onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
                  placeholder="知识条目的详细内容"
                  rows={6}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleAddEntry}>
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;
