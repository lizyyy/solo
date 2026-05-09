import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Stats {
  knowledgeBaseCount: number;
  qaRecordCount: number;
  citationCount: number;
  validationCount: number;
  byStatus: Record<string, number>;
}

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

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/stats');
      setStats(response.data);
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateAll = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/validate-all');
      setMessage({ type: 'success', text: `成功校验 ${response.data.count} 条记录` });
      await fetchStats();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: '校验失败' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !stats) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="number">{stats?.knowledgeBaseCount || 0}</div>
          <div className="label">知识库条目</div>
        </div>
        <div className="stat-card">
          <div className="number">{stats?.qaRecordCount || 0}</div>
          <div className="label">问答记录</div>
        </div>
        <div className="stat-card">
          <div className="number">{stats?.citationCount || 0}</div>
          <div className="label">引用数量</div>
        </div>
        <div className="stat-card">
          <div className="number">{stats?.validationCount || 0}</div>
          <div className="label">校验结果</div>
        </div>
      </div>

      <div className="card">
        <div className="flex-between mb-4">
          <h2>校验状态分布</h2>
          <button className="btn btn-primary" onClick={handleValidateAll} disabled={loading}>
            🔍 校验所有记录
          </button>
        </div>

        {stats?.byStatus && Object.keys(stats.byStatus).length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>状态</th>
                  <th>数量</th>
                  <th>占比</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.byStatus).map(([status, count]) => {
                  const percentage = stats.validationCount 
                    ? ((count / stats.validationCount) * 100).toFixed(1) 
                    : '0';
                  return (
                    <tr key={status}>
                      <td>
                        <span className={`status-badge status-${status}`}>
                          {statusLabels[status] || status}
                        </span>
                      </td>
                      <td>{count}</td>
                      <td>{percentage}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray">暂无校验数据，请先导入数据并执行校验</p>
        )}
      </div>

      <div className="card">
        <h2>使用说明</h2>
        <div style={{ lineHeight: 1.8 }}>
          <p><strong>1. 导入知识库数据</strong>：在「知识库」页面上传 CSV/JSON/Excel 文件，或手动添加知识条目。</p>
          <p><strong>2. 导入问答记录</strong>：在「问答记录」页面导入问题-回答对，每条记录可包含多个引用。</p>
          <p><strong>3. 执行校验</strong>：点击上方「校验所有记录」或在问答记录页面逐条校验。</p>
          <p><strong>4. 人工复核</strong>：在「校验结果」页面查看校验详情，对疑似误判的结果进行人工复核。</p>
          <p><strong>5. 导出报告</strong>：在「数据导出」页面导出完整校验报告或错误样本集合。</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
