import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

function DocumentsList() {
  const [documents, setDocuments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newDoc, setNewDoc] = useState({
    name: '',
    method: 'GET',
    url: '',
    raw_content: '',
    auth_type: 'none'
  });

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    axios.get('/api/documents').then(res => {
      setDocuments(res.data.data);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await axios.post('/api/documents', newDoc);
    setShowForm(false);
    setNewDoc({ name: '', method: 'GET', url: '', raw_content: '', auth_type: 'none' });
    fetchDocuments();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      await axios.post('/api/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchDocuments();
    }
  };

  return (
    <div>
      <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', alignItems: 'center' }}>
        <h2>API文档列表</h2>
        <div className="btn-group">
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? '取消' : '录入文档'}
          </button>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            上传文件
            <input
              type="file"
              accept=".json,.txt"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem' }}>
          <div className="form-group">
            <label>文档名称</label>
            <input
              type="text"
              value={newDoc.name}
              onChange={e => setNewDoc({...newDoc, name: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label>请求方法</label>
            <select
              value={newDoc.method}
              onChange={e => setNewDoc({...newDoc, method: e.target.value})}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <div className="form-group">
            <label>URL</label>
            <input
              type="text"
              value={newDoc.url}
              onChange={e => setNewDoc({...newDoc, url: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label>认证方式</label>
            <select
              value={newDoc.auth_type}
              onChange={e => setNewDoc({...newDoc, auth_type: e.target.value})}
            >
              <option value="none">无认证</option>
              <option value="bearer">Bearer Token</option>
              <option value="basic">Basic Auth</option>
              <option value="api_key">API Key</option>
            </select>
          </div>
          <div className="form-group">
            <label>原始内容 (JSON格式)</label>
            <textarea
              value={newDoc.raw_content}
              onChange={e => setNewDoc({...newDoc, raw_content: e.target.value})}
              placeholder='{"name": "接口名称", "method": "POST", "params": {"key": "value"}}'
            />
          </div>
          <button type="submit" className="btn btn-primary">保存文档</button>
        </form>
      )}
    </div>

    <div className="card">
      {documents.length === 0 ? (
        <div className="empty-state">暂无文档，请先录入或上传</div>
      ) : (
        documents.map(doc => (
          <div key={doc.id} className="document-item">
            <div className="document-header">
              <Link to={`/documents/${doc.id}`} className="document-title">
                {doc.name}
              </Link>
              <span className={`method-badge method-${doc.method}`}>{doc.method}</span>
            </div>
            <div className="document-url">{doc.url}</div>
            {doc.auth_type !== 'none' && (
              <div className="auth-info" style={{ marginTop: '0.5rem', display: 'inline-flex' }}>
                🔐 {doc.auth_type.toUpperCase()} 认证
              </div>
            )}
            <div className="btn-group" style={{ marginTop: '0.75rem' }}>
              <Link to={`/documents/${doc.id}`} className="btn btn-sm btn-primary">
                查看详情
              </Link>
            </div>
          </div>
        ))
      )}
    </div>
    </div>
  );
}

export default DocumentsList;
