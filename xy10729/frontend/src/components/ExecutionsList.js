import React, { useState, useEffect } from 'react';
import axios from 'axios';

function ExecutionsList() {
  const [executions, setExecutions] = useState([]);
  const [documents, setDocuments] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [execRes, docRes] = await Promise.all([
      axios.get('/api/executions'),
      axios.get('/api/documents')
    ]);
    setExecutions(execRes.data.data);
    
    const docMap = {};
    docRes.data.data.forEach(doc => {
      docMap[doc.id] = doc;
    });
    setDocuments(docMap);
  };

  const handleRetry = async (executionId) => {
    await axios.post(`/api/executions/${executionId}/retry`);
    fetchData();
  };

  return (
    <div>
      <div className="card">
        <h2>执行记录列表</h2>
        <div className="alert alert-info">
          展示所有接口执行记录，包含脏数据拦截、错误解释和修正前后的差异对比。
        </div>
      </div>

      <div className="card">
        {executions.length === 0 ? (
          <div className="empty-state">暂无执行记录</div>
        ) : (
          executions.map(exec => (
            <div key={exec.id} className={`execution-item ${exec.is_blocked ? 'blocked' : 'success'}`}>
              <div className="execution-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span className={`status-badge status-${exec.is_blocked ? 'blocked' : 'success'}`}>
                    {exec.is_blocked ? '已拦截' : '成功'}
                  </span>
                  <strong>{documents[exec.document_id]?.name || '未知文档'}</strong>
                </div>
                <span className="execution-time">
                  {new Date(exec.executed_at).toLocaleString()}
                </span>
              </div>

              {exec.is_blocked && (
                <>
                  <div className="params-compare">
                    <div className="params-box original-params">
                      <h4>⚠️ 原始参数 (脏数据检测)</h4>
                      <pre>{JSON.stringify(exec.raw_request, null, 2)}</pre>
                    </div>
                    <div className="params-box corrected-params">
                      <h4>✓ 修正后参数</h4>
                      <pre>{JSON.stringify(exec.corrected_params, null, 2)}</pre>
                    </div>
                  </div>
                  <div className="explanation-box">
                    <h4>错误解释 & 自动修正说明</h4>
                    <pre>{exec.correction_explanation}</pre>
                  </div>
                  <div className="btn-group" style={{ marginTop: '1rem' }}>
                    <button 
                      className="btn btn-success btn-sm"
                      onClick={() => handleRetry(exec.id)}
                    >
                      🔄 重试（使用修正后参数）
                    </button>
                    <button className="btn btn-secondary btn-sm">
                      ↩️ 回滚到原始配置
                    </button>
                  </div>
                </>
              )}

              {!exec.is_blocked && (
                <div className="params-box">
                  <h4>请求参数</h4>
                  <pre>{JSON.stringify(exec.raw_request, null, 2)}</pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ExecutionsList;
