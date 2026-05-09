import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Exports: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  const downloadFile = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportReport = async (format: 'json' | 'csv' | 'xlsx') => {
    try {
      if (format === 'json') {
        const response = await axios.get('/api/export/report?format=json');
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        downloadFile(url, `validation-report-${Date.now()}.json`);
        URL.revokeObjectURL(url);
      } else {
        window.open(`/api/export/report?format=${format}`);
      }
    } catch (error) {
      console.error('导出失败:', error);
    }
  };

  const handleExportErrorSamples = async (format: 'json' | 'csv') => {
    try {
      if (format === 'json') {
        const response = await axios.get('/api/export/error-samples?format=json');
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        downloadFile(url, `error-samples-${Date.now()}.json`);
        URL.revokeObjectURL(url);
      } else {
        window.open(`/api/export/error-samples?format=csv`);
      }
    } catch (error) {
      console.error('导出失败:', error);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

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

  return (
    <div>
      <div className="card">
        <h2>数据导出</h2>
        <p className="text-gray mb-4">导出校验报告和错误样本，用于分析和优化引用质量。</p>

        {!loading && stats && (
          <div className="stats-grid" style={{ marginBottom: 32 }}>
            <div className="stat-card">
              <div className="number">{stats.validationCount || 0}</div>
              <div className="label">总校验次数</div>
            </div>
            <div className="stat-card">
              <div className="number">{(stats.byStatus?.valid || 0) + (stats.byStatus?.reviewed_valid || 0)}</div>
              <div className="label">有效引用</div>
            </div>
            <div className="stat-card">
              <div className="number">
                {(stats.byStatus?.missing_reference || 0) + 
                 (stats.byStatus?.wrong_document || 0) + 
                 (stats.byStatus?.content_mismatch || 0) +
                 (stats.byStatus?.reviewed_invalid || 0)}
              </div>
              <div className="label">问题引用</div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div className="card" style={{ marginBottom: 0, border: '1px solid #e0e0e0' }}>
            <h3>📊 完整校验报告</h3>
            <p className="text-gray mb-4" style={{ fontSize: 14 }}>
              包含所有校验结果、复核历史、详细统计信息。
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button 
                className="btn btn-primary"
                onClick={() => handleExportReport('json')}
              >
                导出 JSON
              </button>
              <button 
                className="btn btn-success"
                onClick={() => handleExportReport('csv')}
              >
                导出 CSV
              </button>
              <button 
                className="btn btn-outline"
                onClick={() => handleExportReport('xlsx')}
              >
                导出 Excel
              </button>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 0, border: '1px solid #e0e0e0' }}>
            <h3>⚠️ 错误样本集合</h3>
            <p className="text-gray mb-4" style={{ fontSize: 14 }}>
              只导出被标记为问题的引用样本，用于模型优化。
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button 
                className="btn btn-danger"
                onClick={() => handleExportErrorSamples('json')}
              >
                导出 JSON
              </button>
              <button 
                className="btn btn-outline"
                onClick={() => handleExportErrorSamples('csv')}
              >
                导出 CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {!loading && stats && stats.byStatus && Object.keys(stats.byStatus).length > 0 && (
        <div className="card">
          <h3>问题类型分布</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>状态</th>
                  <th>数量</th>
                  <th>占比</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.byStatus).map(([status, count]) => {
                  const percentage = stats.validationCount 
                    ? ((count as number / stats.validationCount) * 100).toFixed(1) 
                    : '0';
                  
                  const descriptions: Record<string, string> = {
                    valid: '引用文本与知识库内容高度匹配',
                    missing_reference: '回答中缺少必要的引用或引用信息不完整',
                    wrong_document: '引用的文档在知识库中不存在',
                    content_mismatch: '引用文本与知识库内容差异较大',
                    partial_match: '部分匹配，建议人工复核',
                    pending_review: '等待人工复核确认',
                    reviewed_valid: '人工复核确认有效',
                    reviewed_invalid: '人工复核确认无效'
                  };
                  
                  return (
                    <tr key={status}>
                      <td>
                        <span className={`status-badge status-${status}`}>
                          {statusLabels[status] || status}
                        </span>
                      </td>
                      <td>{count as number}</td>
                      <td>{percentage}%</td>
                      <td className="text-sm text-gray">
                        {descriptions[status] || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h3>📋 数据格式说明</h3>

        <div className="mb-4">
          <h4 style={{ marginBottom: 8 }}>知识库导入格式</h4>
          <p className="text-sm text-gray mb-2">支持 CSV、JSON、Excel 格式，字段说明：</p>
          <ul className="text-sm" style={{ paddingLeft: 20, lineHeight: 1.8 }}>
            <li><code>document_id</code> - 文档标识符（必填）</li>
            <li><code>title</code> - 知识条目标题（必填）</li>
            <li><code>content</code> - 知识条目内容（必填）</li>
          </ul>
        </div>

        <div className="mb-4">
          <h4 style={{ marginBottom: 8 }}>问答记录导入格式</h4>
          <p className="text-sm text-gray mb-2">支持 CSV、JSON、Excel 格式，字段说明：</p>
          <ul className="text-sm" style={{ paddingLeft: 20, lineHeight: 1.8 }}>
            <li><code>question</code> - 用户问题（必填）</li>
            <li><code>answer</code> - 系统回答（必填）</li>
            <li><code>citations</code> - 引用列表（JSON 数组，可选），每个引用包含：
              <code>knowledge_base_id</code>、<code>document_id</code>、<code>cited_text</code>
            </li>
          </ul>
        </div>

        <div className="mb-4">
          <h4 style={{ marginBottom: 8 }}>示例数据示例</h4>
          <pre style={{ 
            background: '#f8fafc', 
            padding: 16, 
            borderRadius: 8, 
            fontSize: 12,
            overflowX: 'auto'
          }}>{`// 知识库 JSON 示例：
[
  {
    "document_id": "doc_001",
    "title": "产品定价规则",
    "content": "标准套餐价格为99元/月，企业版价格为299元/月。"
  }
]

// 问答记录 JSON 示例：
[
  {
    "question": "标准套餐多少钱？",
    "answer": "标准套餐价格为99元/月。",
    "citations": [
      {
        "document_id": "doc_001",
        "cited_text": "标准套餐价格为99元/月"
      }
    ]
  }
]`}</pre>
        </div>
      </div>
    </div>
  );
};

export default Exports;
