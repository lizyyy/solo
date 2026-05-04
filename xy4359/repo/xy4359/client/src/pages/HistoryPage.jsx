import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { rehearsalsApi } from '../services/api';

function HistoryPage() {
  const [rehearsals, setRehearsals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadRehearsals();
  }, []);

  async function loadRehearsals() {
    try {
      setLoading(true);
      const response = await rehearsalsApi.getAll();
      if (response.success) {
        setRehearsals(response.data.sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        ));
      }
    } catch (error) {
      console.error('加载历史记录失败:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('确定要删除这条记录吗？')) return;
    
    try {
      await rehearsalsApi.delete(id);
      loadRehearsals();
    } catch (error) {
      console.error('删除失败:', error);
    }
  }

  function formatDate(isoString) {
    if (!isoString) return '未知';
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN');
  }

  function getScoreClass(score) {
    if (score >= 70) return 'score-good';
    if (score >= 40) return 'score-medium';
    return 'score-poor';
  }

  const filteredRehearsals = rehearsals.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'good') return r.totalScore >= 70;
    if (filter === 'medium') return r.totalScore >= 40 && r.totalScore < 70;
    if (filter === 'poor') return r.totalScore < 40;
    return true;
  });

  return (
    <div className="history-page">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>排练历史记录</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ marginRight: 8 }}
            >
              <option value="all">全部</option>
              <option value="good">优秀 (≥70分)</option>
              <option value="medium">一般 (40-69分)</option>
              <option value="poor">需要改进 (<40分)</option>
            </select>
            <button className="btn-secondary" onClick={loadRehearsals}>
              刷新
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <p>加载中...</p>
        </div>
      ) : filteredRehearsals.length === 0 ? (
        <div className="card">
          <p>暂无排练记录。去关卡管理中创建关卡并开始排练吧！</p>
          <Link to="/levels">
            <button className="btn-primary" style={{ marginTop: 16 }}>
              去创建关卡
            </button>
          </Link>
        </div>
      ) : (
        <div className="history-list">
          {filteredRehearsals.map((rehearsal) => (
            <div key={rehearsal.id} className="history-item">
              <div className="history-item-info">
                <div className="history-item-title">
                  {rehearsal.levelName || '未命名关卡'}
                </div>
                <div className="history-item-meta">
                  <span>排练时间: {formatDate(rehearsal.createdAt)}</span>
                  {rehearsal.deductions && rehearsal.deductions.length > 0 && (
                    <span style={{ marginLeft: 16 }}>
                      扣分记录: {rehearsal.deductions.length} 次
                    </span>
                  )}
                  {rehearsal.notes && (
                    <span style={{ marginLeft: 16, color: '#4a90d9' }}>
                      已添加复盘备注
                    </span>
                  )}
                </div>
              </div>
              
              <div className={`history-item-score ${getScoreClass(rehearsal.totalScore)}`}>
                {rehearsal.totalScore} 分
              </div>
              
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to={`/review/${rehearsal.id}`}>
                  <button className="btn-primary">
                    查看复盘
                  </button>
                </Link>
                <button 
                  className="btn-danger btn-sm"
                  onClick={() => handleDelete(rehearsal.id)}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HistoryPage;
