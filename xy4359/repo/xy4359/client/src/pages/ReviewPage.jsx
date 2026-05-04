import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { rehearsalsApi, exportApi } from '../services/api';
import { DEDUCTION_NAMES } from '../utils/gameEngine';

function ReviewPage() {
  const { rehearsalId } = useParams();
  const navigate = useNavigate();
  
  const [rehearsal, setRehearsal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRehearsal();
  }, [rehearsalId]);

  async function loadRehearsal() {
    try {
      setLoading(true);
      const response = await rehearsalsApi.getById(rehearsalId);
      if (response.success) {
        setRehearsal(response.data);
        setNotes(response.data.notes || '');
      }
    } catch (error) {
      console.error('加载记录失败:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveNotes() {
    if (!rehearsal) return;
    
    try {
      setSaving(true);
      const response = await rehearsalsApi.update(rehearsal.id, { notes });
      if (response.success) {
        alert('备注已保存！');
        setRehearsal(prev => ({ ...prev, notes }));
      }
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  function formatDate(isoString) {
    if (!isoString) return '未知';
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN');
  }

  function getDuration() {
    if (!rehearsal || !rehearsal.startTime || !rehearsal.endTime) return '未知';
    const start = new Date(rehearsal.startTime);
    const end = new Date(rehearsal.endTime);
    const seconds = Math.round((end - start) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}分${remainingSeconds}秒`;
    }
    return `${seconds}秒`;
  }

  function getTotalPointsLost() {
    if (!rehearsal || !rehearsal.deductions) return 0;
    return rehearsal.deductions.reduce((sum, d) => sum + (d.points || 0), 0);
  }

  function getDeductionTypeCounts() {
    if (!rehearsal || !rehearsal.deductions) return {};
    const counts = {};
    rehearsal.deductions.forEach(d => {
      counts[d.type] = (counts[d.type] || 0) + 1;
    });
    return counts;
  }

  if (loading) {
    return (
      <div className="card">
        <p>加载中...</p>
      </div>
    );
  }

  if (!rehearsal) {
    return (
      <div className="card">
        <p>记录不存在</p>
        <button className="btn-primary" onClick={() => navigate('/history')}>
          返回历史记录
        </button>
      </div>
    );
  }

  const deductionCounts = getDeductionTypeCounts();

  return (
    <div className="review-page">
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>排练复盘</h2>
          <p style={{ color: '#666' }}>{rehearsal.levelName || '未命名关卡'}</p>
        </div>
        <button className="btn-secondary" onClick={() => navigate('/history')}>
          返回历史
        </button>
      </div>

      <div className="review-container">
        <div className="review-section">
          <h3>基本信息</h3>
          
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 48, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 }}>
              <span style={{ 
                color: rehearsal.totalScore >= 70 ? '#28a745' : 
                       rehearsal.totalScore >= 40 ? '#ffc107' : '#dc3545' 
              }}>
                {rehearsal.totalScore}
              </span>
              <span style={{ fontSize: 24, color: '#666' }}> 分</span>
            </div>
          </div>
          
          <div className="form-group">
            <label>排练时间</label>
            <input 
              type="text" 
              value={formatDate(rehearsal.createdAt)} 
              readOnly
              style={{ background: '#f5f5f5' }}
            />
          </div>
          
          <div className="form-group">
            <label>排练时长</label>
            <input 
              type="text" 
              value={getDuration()} 
              readOnly
              style={{ background: '#f5f5f5' }}
            />
          </div>
          
          <div className="form-group">
            <label>扣分统计</label>
            <div style={{ padding: 12, background: '#f8f9fa', borderRadius: 4 }}>
              <div style={{ marginBottom: 8 }}>
                <strong>总扣分: {getTotalPointsLost()} 分</strong>
              </div>
              {Object.keys(deductionCounts).length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {Object.entries(deductionCounts).map(([type, count]) => (
                    <li key={type} style={{ padding: '4px 0' }}>
                      {DEDUCTION_NAMES[type] || type}: {count} 次
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: '#666', margin: 0 }}>无扣分记录</p>
              )}
            </div>
          </div>
        </div>

        <div className="review-section">
          <h3>扣分详情</h3>
          
          {rehearsal.deductions && rehearsal.deductions.length > 0 ? (
            <div className="deduction-list">
              {rehearsal.deductions.map((deduction, index) => (
                <div key={index} className="deduction-item">
                  <div className="deduction-type">
                    {DEDUCTION_NAMES[deduction.type] || deduction.type}
                    <span style={{ float: 'right', fontSize: 12 }}>
                      -{deduction.points}分
                    </span>
                  </div>
                  <div className="deduction-detail">
                    {deduction.description}
                    <br />
                    <small>时间: {typeof deduction.timestamp === 'number' 
                      ? `${deduction.timestamp.toFixed(1)}s` 
                      : deduction.timestamp}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="alert alert-success">
              太棒了！本次排练没有扣分记录！
            </div>
          )}
        </div>
      </div>

      <div className="review-container" style={{ marginTop: 24 }}>
        <div className="review-section" style={{ gridColumn: '1 / -1' }}>
          <h3>人工复盘备注</h3>
          <p style={{ color: '#666', marginBottom: 12, fontSize: 13 }}>
            在这里记录你的复盘心得、改进建议等内容。
          </p>
          
          <textarea
            className="notes-area"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="输入复盘备注..."
          />
          
          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            <button 
              className="btn-primary"
              onClick={saveNotes}
              disabled={saving}
            >
              {saving ? '保存中...' : '保存备注'}
            </button>
          </div>
        </div>
      </div>

      <div className="review-section" style={{ marginTop: 24 }}>
        <h3>导出报告</h3>
        <p style={{ color: '#666', marginBottom: 16, fontSize: 13 }}>
          导出复盘报告，用于后续分析和团队分享。
        </p>
        
        <div className="export-buttons">
          <button 
            className="btn-success btn-lg"
            onClick={() => exportApi.exportMarkdown(rehearsal.id)}
          >
            📝 导出 Markdown 复盘单
          </button>
          <button 
            className="btn-primary btn-lg"
            onClick={() => exportApi.exportJson(rehearsal.id)}
          >
            📋 导出 JSON 审计包
          </button>
        </div>
        
        <div style={{ marginTop: 16, padding: 12, background: '#f8f9fa', borderRadius: 4, fontSize: 13 }}>
          <strong>导出说明：</strong>
          <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
            <li><strong>Markdown 复盘单</strong>: 适合打印或在文档中分享，包含扣分详情和动作记录</li>
            <li><strong>JSON 审计包</strong>: 包含完整的排练数据，可用于进一步分析或导入其他系统</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ReviewPage;
