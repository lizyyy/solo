import { PipelineStatus, ChangeLog } from '../api';

interface Props {
  pipelineHistory: PipelineStatus[];
  changeLogs: ChangeLog[];
}

function formatTime(isoString: string | null) {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleString('zh-CN');
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN');
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'running': return '运行中';
    case 'completed': return '已完成';
    case 'failed': return '失败';
    default: return status;
  }
}

function getStageLabel(stage: string) {
  const labels: Record<string, string> = {
    'data_import': '数据导入',
    'text_cleaning': '文本清洗',
    'feature_extraction': '特征提取',
    'match_processing': '特征匹配',
    'candidate_ranking': '候选排序',
    'human_review': '人工审核',
    'completed': '完成'
  };
  return labels[stage] || stage;
}

export function HistoryPanel({ pipelineHistory, changeLogs }: Props) {
  return (
    <>
      <div className="card">
        <div className="card-header">
          <div className="card-title">📊 处理流程历史</div>
        </div>
        
        {pipelineHistory.length === 0 ? (
          <div className="empty-state">
            <h3>暂无处理记录</h3>
            <p>运行匹配流程后会在这里显示历史记录</p>
          </div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>开始时间</th>
                <th>结束时间</th>
                <th>状态</th>
                <th>当前阶段</th>
                <th>进度</th>
                <th>错误</th>
              </tr>
            </thead>
            <tbody>
              {pipelineHistory.map((p) => (
                <tr key={p.id}>
                  <td>{formatTime(p.started_at)}</td>
                  <td>{formatTime(p.finished_at)}</td>
                  <td>
                    <span className={`status-badge ${p.status}`}>
                      {getStatusLabel(p.status)}
                    </span>
                  </td>
                  <td>{getStageLabel(p.current_stage)}</td>
                  <td>{p.processed_count} / {p.total_count}</td>
                  <td style={{ color: p.error_message ? '#dc2626' : '#9ca3af', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.error_message || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      <div className="card">
        <div className="card-header">
          <div className="card-title">📜 变更日志</div>
        </div>
        
        {changeLogs.length === 0 ? (
          <div className="empty-state">
            <h3>暂无变更记录</h3>
            <p>人工确认或驳回匹配后会记录变更历史</p>
          </div>
        ) : (
          <div className="changelog">
            {changeLogs.map((log) => (
              <div key={log.id} className="changelog-item">
                <div className="changelog-time">{formatDate(log.created_at)}</div>
                <div className="changelog-content">
                  <strong style={{ color: '#2563eb' }}>
                    [{log.entity_type}]
                  </strong>
                  <span style={{ marginLeft: '0.5rem' }}>
                    {log.field_name}: 
                    {log.old_value && <span style={{ color: '#dc2626' }}> {log.old_value}</span>}
                    {log.old_value && log.new_value && ' →'}
                    {log.new_value && <span style={{ color: '#059669', marginLeft: log.old_value ? '0' : '0.25rem' }}> {log.new_value}</span>}
                  </span>
                  <span style={{ color: '#6b7280', marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                    by {log.operator}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
