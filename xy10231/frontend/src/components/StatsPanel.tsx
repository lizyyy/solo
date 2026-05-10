import { Statistics } from '../api';

interface Props {
  stats: Statistics;
}

export function StatsPanel({ stats }: Props) {
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-label">报失记录总数</div>
        <div className="stat-value primary">{stats.lost_items.total}</div>
        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
          待匹配: {stats.lost_items.pending} | 已匹配: {stats.lost_items.matched}
        </div>
      </div>
      
      <div className="stat-card">
        <div className="stat-label">招领记录总数</div>
        <div className="stat-value primary">{stats.found_items.total}</div>
        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
          待匹配: {stats.found_items.pending} | 已匹配: {stats.found_items.matched}
        </div>
      </div>
      
      <div className="stat-card">
        <div className="stat-label">待人工审核</div>
        <div className="stat-value warning">{stats.matches.pending_review}</div>
        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
          候选池: {stats.matches.candidate}
        </div>
      </div>
      
      <div className="stat-card">
        <div className="stat-label">已确认匹配</div>
        <div className="stat-value success">{stats.matches.confirmed}</div>
        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
          已驳回: {stats.matches.rejected} | 平均分数: {stats.matches.avg_score?.toFixed(1) || '-'}
        </div>
      </div>
    </div>
  );
}
