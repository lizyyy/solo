import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [params, setParams] = useState({});
  const [activeTab, setActiveTab] = useState('execute');
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    fetchDocument();
    fetchExecutions();
  }, [id]);

  const fetchDocument = async () => {
    const res = await axios.get(`/api/documents/${id}`);
    setDocument(res.data.data);
    try {
      const content = JSON.parse(res.data.data.raw_content);
      if (content.params) {
        const defaultParams = {};
        Object.keys(content.params).forEach(key => {
          defaultParams[key] = '';
        });
        setParams(defaultParams);
      }
    } catch (e) {
      console.log('Parse error');
    }
  };

  const fetchExecutions = async () => {
    const res = await axios.get(`/api/executions?document_id=${id}`);
    setExecutions(res.data.data);
  };

  const handleExecute = async () => {
    const res = await axios.post('/api/execute', {
      document_id: id,
      params: params
    });
    setLastResult(res.data.data);
    fetchExecutions();
  };

  const handleAddFavorite = async () => {
    await axios.post('/api/favorites', {
      document_id: id,
      example_params: params,
      note: document.name
    });
    navigate('/favorites');
  };

  if (!document) return <div>加载中...</div>;

  return (
    <div>
      <Link to="/" className="back-link">← 返回文档列表</Link>
      
      <div className="card">
        <div className="document-header">
          <h2>{document.name}</h2>
          <span className={`method-badge method-${document.method}`}>{document.method}</span>
        </div>
        <div className="document-url" style={{ marginBottom: '1rem' }}>{document.url}</div>
        {document.auth_type !== 'none' && (
          <div className="auth-info">
            🔐 认证方式: {document.auth_type.toUpperCase()}
          </div>
        )}
      </div>

      <div className="tabs">
        <div className={`tab ${activeTab === 'execute' ? 'active' : ''}`} onClick={() => setActiveTab('execute')}>
          执行测试
        </div>
        <div className={`tab ${activeTab === 'content' ? 'active' : ''}`} onClick={() => setActiveTab('content')}>
          原始内容
        </div>
        <div className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          执行历史
        </div>
      </div>

      {activeTab === 'execute' && (
        <div className="card">
          <h3>参数配置</h3>
          {Object.keys(params).map(key => (
            <div key={key} className="form-group">
            <label>{key}</label>
            <input
              type="text"
              value={params[key]}
              onChange={e => setParams({...params, [key]: e.target.value})}
            />
          </div>
          ))}
          {Object.keys(params).length === 0 && (
            <div className="form-group">
              <label>手动输入参数 (JSON)</label>
              <textarea
                value={JSON.stringify(params, null, 2)}
                onChange={e => {
                  try {
                    setParams(JSON.parse(e.target.value));
                  } catch (err) {
                    console.log('Invalid JSON');
                  }
                }}
                style={{ minHeight: '100px' }}
              />
            </div>
          )}
          <div className="btn-group">
            <button className="btn btn-primary" onClick={handleExecute}>执行请求</button>
            <button className="btn btn-success" onClick={handleAddFavorite}>收藏示例</button>
          </div>

          {lastResult && (
            <div style={{ marginTop: '1.5rem' }}>
              <h4>执行结果</h4>
              <div className={`execution-item ${lastResult.was_blocked ? 'blocked' : 'success'}`}>
                <div className="execution-header">
                  <span className={`status-badge status-${lastResult.was_blocked ? 'blocked' : 'success'}`}>
                    {lastResult.was_blocked ? '已拦截' : '成功'}
                  </span>
                </div>
                {lastResult.was_blocked && (
                  <>
                    <div className="params-compare">
                      <div className="params-box original-params">
                        <h4>原始参数 (脏数据)</h4>
                        <pre>{JSON.stringify(lastResult.record.raw_request, null, 2)}</pre>
                      </div>
                      <div className="params-box corrected-params">
                        <h4>修正后参数</h4>
                        <pre>{JSON.stringify(lastResult.record.corrected_params, null, 2)}</pre>
                      </div>
                    </div>
                    <div className="explanation-box">
                      <h4>错误解释 & 修正说明</h4>
                      <pre>{lastResult.explanation}</pre>
                    </div>
                    <div className="rollback-notice">
                      💡 提示：脏数据已被拦截，系统自动执行了安全修正。你可以使用修正后参数重新尝试，或回滚到原始配置。
                    </div>
                  </>
                )}
                {!lastResult.was_blocked && (
                  <div className="params-box">
                    <h4>响应数据</h4>
                    <pre>{JSON.stringify(lastResult.record.response_data, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'content' && (
        <div className="card">
          <div className="detail-section">
            <h3>原始输入内容</h3>
            <div className="raw-content-box">
              <pre>{document.raw_content}</pre>
            </div>
          </div>
          <div className="detail-section">
            <h3>处理后结果</h3>
            <div className="raw-content-box">
              <pre>{JSON.stringify(document.processed_content, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card">
          <h3>执行历史记录</h3>
          {executions.length === 0 ? (
            <div className="empty-state">暂无执行记录</div>
          ) : (
            executions.map(exec => (
              <div key={exec.id} className={`execution-item ${exec.is_blocked ? 'blocked' : 'success'}`}>
                <div className="execution-header">
                  <span className={`status-badge status-${exec.is_blocked ? 'blocked' : 'success'}`}>
                    {exec.is_blocked ? '已拦截' : '成功'}
                  </span>
                  <span className="execution-time">
                    {new Date(exec.executed_at).toLocaleString()}
                  </span>
                </div>
                {exec.is_blocked && (
                  <>
                    <div className="params-compare">
                      <div className="params-box original-params">
                        <h4>原始参数</h4>
                        <pre>{JSON.stringify(exec.raw_request, null, 2)}</pre>
                      </div>
                      <div className="params-box corrected-params">
                        <h4>修正参数</h4>
                        <pre>{JSON.stringify(exec.corrected_params, null, 2)}</pre>
                      </div>
                    </div>
                    <div className="explanation-box">
                      <h4>拦截原因 & 修正说明</h4>
                      <pre>{exec.correction_explanation}</pre>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default DocumentDetail;
