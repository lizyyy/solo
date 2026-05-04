import { useState, useEffect } from 'react';
import { api } from '../services/api';
import ReactMarkdown from 'react-markdown';

export default function ExportPage() {
  const [selectedActivity, setSelectedActivity] = useState<string>('');
  const [activities, setActivities] = useState<any[]>([]);
  const [previewMode, setPreviewMode] = useState<'none' | 'markdown' | 'json'>('none');
  const [markdownPreview, setMarkdownPreview] = useState<string>('');
  const [jsonPreview, setJsonPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const data = await api.getActivities();
        setActivities(data);
      } catch (error) {
        console.error('Failed to fetch activities');
      }
    };
    fetchActivities();
  }, []);

  const handlePreviewMarkdown = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await api.previewObservingList(
        selectedActivity || undefined
      );
      setMarkdownPreview(response.markdown);
      setPreviewMode('markdown');
    } catch (error) {
      setMessage({ type: 'error', text: '预览失败' });
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewJson = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await api.previewAuditPackage(
        selectedActivity || undefined
      );
      setJsonPreview(data);
      setPreviewMode('json');
    } catch (error) {
      setMessage({ type: 'error', text: '预览失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportMarkdown = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const markdown = await api.exportObservingListMarkdown(
        selectedActivity || undefined
      );
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `observing-list-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Markdown 清单已导出' });
    } catch (error) {
      setMessage({ type: 'error', text: '导出失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportJson = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const blob = await api.exportAuditPackage(
        selectedActivity || undefined
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-package-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'JSON 审计包已导出' });
    } catch (error) {
      setMessage({ type: 'error', text: '导出失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="export-page">
      <h2>📤 数据导出</h2>

      {message && (
        <div className={`message ${message.type}`}>
          {message.type === 'success' ? '✅' : '❌'} {message.text}
        </div>
      )}

      <div className="export-section">
        <h3>导出选项</h3>

        {activities.length > 0 && (
          <div className="form-group">
            <label>关联观测活动 (可选)</label>
            <select
              value={selectedActivity}
              onChange={(e) => setSelectedActivity(e.target.value)}
              className="activity-selector"
            >
              <option value="">不关联活动</option>
              {activities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.name} ({activity.date})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="export-options">
          <div className="export-card">
            <div className="export-card-header">
              <span className="export-icon">📄</span>
              <span className="export-title">Markdown 观测清单</span>
            </div>
            <p className="export-description">
              导出包含所有观测目标、设备配置、风险检测结果的完整观测清单，
              格式为 Markdown，便于阅读和打印。
            </p>
            <div className="export-actions">
              <button
                className="secondary-button"
                onClick={handlePreviewMarkdown}
                disabled={loading}
              >
                {loading && previewMode === 'markdown' ? '加载中...' : '预览'}
              </button>
              <button
                className="primary-button"
                onClick={handleExportMarkdown}
                disabled={loading}
              >
                {loading && previewMode !== 'markdown' ? '导出中...' : '导出'}
              </button>
            </div>
          </div>

          <div className="export-card">
            <div className="export-card-header">
              <span className="export-icon">📦</span>
              <span className="export-title">JSON 审计包</span>
            </div>
            <p className="export-description">
              导出完整的审计数据包，包含所有原始数据、风险评估记录、
              复核记录等，适合存档和后续分析。
            </p>
            <div className="export-actions">
              <button
                className="secondary-button"
                onClick={handlePreviewJson}
                disabled={loading}
              >
                {loading && previewMode === 'json' ? '加载中...' : '预览'}
              </button>
              <button
                className="primary-button"
                onClick={handleExportJson}
                disabled={loading}
              >
                {loading && previewMode !== 'json' ? '导出中...' : '导出'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {previewMode === 'markdown' && markdownPreview && (
        <div className="preview-section">
          <div className="preview-header">
            <h3>📄 Markdown 预览</h3>
            <button
              className="close-button"
              onClick={() => setPreviewMode('none')}
            >
              ✕ 关闭
            </button>
          </div>
          <div className="markdown-preview">
            <ReactMarkdown>{markdownPreview}</ReactMarkdown>
          </div>
        </div>
      )}

      {previewMode === 'json' && jsonPreview && (
        <div className="preview-section">
          <div className="preview-header">
            <h3>📦 JSON 审计包预览</h3>
            <button
              className="close-button"
              onClick={() => setPreviewMode('none')}
            >
              ✕ 关闭
            </button>
          </div>
          <div className="json-preview">
            <pre>{JSON.stringify(jsonPreview, null, 2)}</pre>
          </div>
        </div>
      )}

      <div className="export-info">
        <h3>ℹ️ 导出说明</h3>
        <div className="info-cards">
          <div className="info-card">
            <h4>Markdown 观测清单包含:</h4>
            <ul>
              <li>观测活动信息 (如已选择)</li>
              <li>观测地点列表</li>
              <li>设备清单及状态</li>
              <li>观测目标与时间窗口</li>
              <li>风险检测结果</li>
              <li>手动驳回的风险记录</li>
              <li>风险统计摘要</li>
            </ul>
          </div>
          <div className="info-card">
            <h4>JSON 审计包包含:</h4>
            <ul>
              <li>元数据 (生成时间、版本)</li>
              <li>完整的观测活动数据</li>
              <li>所有观测点、目标、窗口数据</li>
              <li>设备配置与状态</li>
              <li>完整的风险评估记录</li>
              <li>复核记录 (如存在)</li>
              <li>内嵌的 Markdown 清单</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
