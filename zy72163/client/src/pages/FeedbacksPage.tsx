import { useState, useEffect } from 'react';
import { feedbacksApi, locationsApi } from '../api';
import type { ResidentFeedback, Location } from '../api';

export default function FeedbacksPage() {
  const [feedbacks, setFeedbacks] = useState<ResidentFeedback[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    priority: ''
  });
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  useEffect(() => {
    loadData();
  }, [filters]);

  async function loadData() {
    try {
      const [feedbacksRes, locationsRes] = await Promise.all([
        feedbacksApi.getAll(filters.status || filters.priority ? filters : undefined),
        locationsApi.getAll()
      ]);
      setFeedbacks(feedbacksRes.data);
      setLocations(locationsRes.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }

  const getLocationName = (locationId: number) => {
    return locations.find(l => l.id === locationId)?.name || '未知点位';
  };

  async function handleImport() {
    try {
      const data = JSON.parse(importText);
      const result = await feedbacksApi.import(Array.isArray(data) ? data : [data]);
      alert(`导入成功: ${result.data.imported}条`);
      setShowImport(false);
      setImportText('');
      loadData();
    } catch (e: any) {
      alert(`导入失败: ${e.message}`);
    }
  }

  async function handleStatusChange(id: number, status: string) {
    try {
      await feedbacksApi.update(id, { status: status as any });
      loadData();
    } catch (error) {
      console.error('更新状态失败:', error);
    }
  }

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>居民反馈</h2>
        <p>管理所有居民反馈记录，追踪处理进度</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>反馈列表 ({feedbacks.length}条)</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select 
              className="form-input" 
              style={{ width: '120px', padding: '6px 10px' }}
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
            >
              <option value="">全部优先级</option>
              <option value="urgent">紧急</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
            <select 
              className="form-input" 
              style={{ width: '120px', padding: '6px 10px' }}
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">全部状态</option>
              <option value="pending">待处理</option>
              <option value="processing">处理中</option>
              <option value="resolved">已解决</option>
              <option value="closed">已关闭</option>
            </select>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => setShowImport(true)}
            >
              📥 批量导入
            </button>
            <button className="btn btn-secondary btn-sm" onClick={loadData}>
              🔄 刷新
            </button>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>反馈编号</th>
                <th>点位</th>
                <th>反馈内容</th>
                <th>来源</th>
                <th>反馈人</th>
                <th>日期</th>
                <th>优先级</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {feedbacks.map(feedback => (
                <tr key={feedback.id}>
                  <td>{feedback.feedbackNo || '-'}</td>
                  <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {getLocationName(feedback.locationId)}
                  </td>
                  <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {feedback.content}
                  </td>
                  <td>{feedback.source}</td>
                  <td>{feedback.reporter || '匿名'}</td>
                  <td>{feedback.feedbackDate}</td>
                  <td>
                    <span className={`badge badge-${feedback.priority}`}>
                      {feedback.priority === 'urgent' ? '紧急' :
                       feedback.priority === 'high' ? '高' :
                       feedback.priority === 'medium' ? '中' : '低'}
                    </span>
                  </td>
                  <td>
                    <select 
                      className="form-input" 
                      style={{ width: '90px', padding: '4px 6px', fontSize: '12px' }}
                      value={feedback.status}
                      onChange={(e) => handleStatusChange(feedback.id, e.target.value)}
                    >
                      <option value="pending">待处理</option>
                      <option value="processing">处理中</option>
                      <option value="resolved">已解决</option>
                      <option value="closed">已关闭</option>
                    </select>
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm">查看</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showImport && (
        <div className="card">
          <div className="card-header">
            <h3>批量导入反馈</h3>
            <button className="close-btn" onClick={() => setShowImport(false)}>&times;</button>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              请粘贴JSON格式的反馈数据，支持数组或单个对象
            </p>
            <textarea
              className="form-textarea"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`[
  {
    "locationName": "点位名称",
    "lat": 31.2304,
    "lng": 121.4737,
    "feedbackDate": "2024-03-01",
    "content": "反馈内容",
    "rawContent": "原始内容",
    "source": "来源",
    "priority": "high"
  }
]`}
              style={{ minHeight: '200px' }}
            />
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <button className="btn btn-primary" onClick={handleImport}>
                确认导入
              </button>
              <button className="btn btn-secondary" onClick={() => setShowImport(false)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
