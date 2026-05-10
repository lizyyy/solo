import { MatchItem } from '../api';

interface Props {
  matches: MatchItem[];
  onSelect: (id: string) => void;
  onRefresh: () => void;
}

function getConfidenceLabel(confidence: string) {
  switch (confidence) {
    case 'high': return '高置信';
    case 'medium': return '中置信';
    case 'low': return '低置信';
    default: return confidence;
  }
}

function getSuggestions(match: MatchItem) {
  const suggestions = [];
  
  if (match.lost_category !== match.found_category) {
    if (match.lost_category && match.found_category) {
      suggestions.push(`分类不一致：失物(${match.lost_category}) vs 招领(${match.found_category})`);
    }
  }
  
  if (match.lost_line !== match.found_line) {
    if (match.lost_line && match.found_line) {
      suggestions.push(`线路不匹配：${match.lost_line} vs ${match.found_line}`);
    }
  }
  
  if (match.lost_station !== match.found_station) {
    if (match.lost_station && match.found_station) {
      suggestions.push(`站点不同：${match.lost_station} vs ${match.found_station}`);
    }
  }
  
  if (match.match_score >= 80) {
    suggestions.push('匹配度高，建议优先确认');
  } else if (match.match_score < 50) {
    suggestions.push('匹配度偏低，请谨慎核对');
  }
  
  if (suggestions.length === 0) {
    suggestions.push('匹配正常，请人工确认');
  }
  
  return suggestions;
}

export function MatchList({ matches, onSelect, onRefresh }: Props) {
  if (matches.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title">🔗 待人工审核的匹配候选</div>
          <button className="btn btn-secondary btn-sm" onClick={onRefresh}>
            刷新
          </button>
        </div>
        <div className="empty-state">
          <h3>暂无待审核的匹配</h3>
          <p>请先在"数据导入"页面导入数据并运行匹配</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          🔗 待人工审核的匹配候选
          <span style={{ 
            marginLeft: '0.75rem', 
            fontSize: '0.85rem', 
            color: '#6b7280', 
            fontWeight: 'normal' 
          }}>
            共 {matches.length} 条
          </span>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onRefresh}>
          刷新
        </button>
      </div>
      
      <div className="match-list">
        {matches.map((match) => {
          const suggestions = getSuggestions(match);
          return (
            <div key={match.id} className="match-item">
              <div className="match-header">
                <div className="match-score">
                  <span className={`score-badge ${match.confidence}`}>
                    {match.match_score.toFixed(1)} 分
                  </span>
                  <span className={`score-badge ${match.confidence}`}>
                    {getConfidenceLabel(match.confidence)}
                  </span>
                </div>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => onSelect(match.id)}
                >
                  查看详情
                </button>
              </div>
              
              <div className="match-content">
                <div className="match-side">
                  <h4>📝 乘客报失</h4>
                  <p>{match.lost_description}</p>
                  <div className="match-tags">
                    {match.lost_category && <span className="tag primary">{match.lost_category}</span>}
                    {match.lost_line && <span className="tag">{match.lost_line}</span>}
                    {match.lost_station && <span className="tag">{match.lost_station}</span>}
                    {match.lost_date && <span className="tag">{match.lost_date}</span>}
                  </div>
                </div>
                
                <div className="match-side">
                  <h4>🔍 招领信息</h4>
                  <p>{match.found_description}</p>
                  <div className="match-tags">
                    {match.found_category && <span className="tag primary">{match.found_category}</span>}
                    {match.found_line && <span className="tag">{match.found_line}</span>}
                    {match.found_station && <span className="tag">{match.found_station}</span>}
                    {match.found_date && <span className="tag">{match.found_date}</span>}
                  </div>
                </div>
              </div>
              
              {suggestions.length > 0 && (
                <div className="suggestions">
                  <h5>💡 处理建议</h5>
                  <ul>
                    {suggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
