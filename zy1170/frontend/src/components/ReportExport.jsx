import React, { useState } from 'react';
import api from '../services/api';

const ReportExport = ({ currentExperiment, trainingResult }) => {
  const [loading, setLoading] = useState(false);
  const [markdownReport, setMarkdownReport] = useState(null);
  const [jsonReport, setJsonReport] = useState(null);
  const [activeTab, setActiveTab] = useState('export');

  const experimentId = currentExperiment?.id;

  const generateMarkdownReport = async () => {
    if (!experimentId) {
      alert('请先保存一个实验');
      return;
    }

    setLoading(true);
    try {
      const result = await api.getMarkdownReport(experimentId);
      setMarkdownReport(result.content);
      setActiveTab('preview');
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('生成报告失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateJsonReport = async () => {
    if (!experimentId) {
      alert('请先保存一个实验');
      return;
    }

    setLoading(true);
    try {
      const result = await api.getJsonReport(experimentId);
      setJsonReport(result.content);
      setActiveTab('json');
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('生成报告失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadMarkdown = () => {
    if (!markdownReport) return;
    
    const blob = new Blob([markdownReport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${experimentId}_report.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadJson = () => {
    if (!jsonReport) return;
    
    const blob = new Blob([JSON.stringify(jsonReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${experimentId}_report.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('已复制到剪贴板');
    }).catch(() => {
      alert('复制失败，请手动复制');
    });
  };

  return (
    <div className="card">
      <h2 className="card-title">📄 报告导出</h2>

      {!experimentId && !trainingResult && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          请先完成一次训练或加载一个已保存的实验
        </div>
      )}

      <div className="tabs">
        <div
          className={`tab ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          导出选项
        </div>
        <div
          className={`tab ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveTab('preview')}
          style={{ opacity: markdownReport ? 1 : 0.5 }}
        >
          Markdown 预览
        </div>
        <div
          className={`tab ${activeTab === 'json' ? 'active' : ''}`}
          onClick={() => setActiveTab('json')}
          style={{ opacity: jsonReport ? 1 : 0.5 }}
        >
          JSON 数据
        </div>
      </div>

      {activeTab === 'export' && (
        <div>
          <div className="alert alert-info" style={{ marginBottom: '20px' }}>
            <strong>📋 报告内容包括:</strong>
            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
              <li>实验基本信息（ID、创建时间、随机种子）</li>
              <li>完整的网络配置（层结构、激活函数、学习率等）</li>
              <li>训练结果摘要（最终Loss、Loss变化趋势）</li>
              <li>前向传播和反向传播的计算公式说明</li>
              <li>预测结果与真实值对比</li>
              <li>训练数据样本预览</li>
            </ul>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#2c3e50' }}>
              📝 Markdown 格式报告
            </h4>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
              适合阅读、分享和打印的格式，包含公式说明和结果分析
            </p>
            <div className="btn-group">
              <button
                className="btn btn-primary"
                onClick={generateMarkdownReport}
                disabled={loading || !experimentId}
              >
                {loading ? '生成中...' : '📄 生成 Markdown 报告'}
              </button>
              {markdownReport && (
                <>
                  <button
                    className="btn btn-secondary"
                    onClick={downloadMarkdown}
                  >
                    ⬇️ 下载 .md 文件
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => copyToClipboard(markdownReport)}
                  >
                    📋 复制到剪贴板
                  </button>
                </>
              )}
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#2c3e50' }}>
              📊 JSON 格式数据
            </h4>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
              完整的实验数据，适合进一步分析或导入其他工具
            </p>
            <div className="btn-group">
              <button
                className="btn btn-primary"
                onClick={generateJsonReport}
                disabled={loading || !experimentId}
              >
                {loading ? '生成中...' : '📊 生成 JSON 数据'}
              </button>
              {jsonReport && (
                <>
                  <button
                    className="btn btn-secondary"
                    onClick={downloadJson}
                  >
                    ⬇️ 下载 .json 文件
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => copyToClipboard(JSON.stringify(jsonReport, null, 2))}
                  >
                    📋 复制到剪贴板
                  </button>
                </>
              )}
            </div>
          </div>

          <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '4px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>💡 使用提示</h4>
            <ul style={{ fontSize: '13px', color: '#555', paddingLeft: '20px', lineHeight: '1.8' }}>
              <li><strong>教学用途:</strong> Markdown 报告包含详细的公式说明，非常适合用于教学演示</li>
              <li><strong>实验记录:</strong> 导出报告可以作为实验记录，方便后续回顾和对比</li>
              <li><strong>数据分析:</strong> JSON 格式包含完整的训练历史，可以用 Python 或其他工具进一步分析</li>
              <li><strong>报告撰写:</strong> Markdown 格式可以直接粘贴到文档编辑器中</li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'preview' && markdownReport && (
        <div className="scrollable">
          <div className="code-block" style={{ background: '#fff', color: '#333', border: '1px solid #ddd' }}>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {markdownReport}
            </pre>
          </div>
        </div>
      )}

      {activeTab === 'preview' && !markdownReport && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          请先在"导出选项"中生成 Markdown 报告
        </div>
      )}

      {activeTab === 'json' && jsonReport && (
        <div className="scrollable">
          <div className="code-block">
            <pre>{JSON.stringify(jsonReport, null, 2)}</pre>
          </div>
        </div>
      )}

      {activeTab === 'json' && !jsonReport && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          请先在"导出选项"中生成 JSON 数据
        </div>
      )}
    </div>
  );
};

export default ReportExport;
