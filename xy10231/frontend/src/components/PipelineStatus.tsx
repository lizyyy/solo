import { PipelineStatus as PipelineStatusType } from '../api';

const STAGES = [
  { key: 'data_import', name: '数据导入', icon: '📥' },
  { key: 'text_cleaning', name: '文本清洗', icon: '🧹' },
  { key: 'feature_extraction', name: '特征提取', icon: '🔍' },
  { key: 'match_processing', name: '特征匹配', icon: '🔗' },
  { key: 'candidate_ranking', name: '候选排序', icon: '📊' },
  { key: 'human_review', name: '人工审核', icon: '👤' },
  { key: 'completed', name: '完成', icon: '✅' }
];

interface Props {
  pipeline: PipelineStatusType;
  onRefresh: () => void;
}

export function PipelineStatus({ pipeline, onRefresh }: Props) {
  const currentStageIndex = STAGES.findIndex(s => s.key === pipeline.current_stage);
  const isCompleted = pipeline.status === 'completed';
  const isFailed = pipeline.status === 'failed';

  const getStageStatus = (index: number) => {
    if (isCompleted || isFailed) {
      return isCompleted && index === STAGES.length - 1 ? 'completed' : 
             index < STAGES.length - 1 ? 'completed' : 'pending';
    }
    if (index < currentStageIndex) return 'completed';
    if (index === currentStageIndex) return 'active';
    return 'pending';
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('zh-CN');
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          处理流程状态
          <span className={`status-badge ${pipeline.status}`} style={{ marginLeft: '0.75rem' }}>
            {pipeline.status === 'running' ? '运行中' : 
             pipeline.status === 'completed' ? '已完成' : 
             pipeline.status === 'failed' ? '失败' : pipeline.status}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            进度: {pipeline.processed_count} / {pipeline.total_count}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={onRefresh}>
            刷新
          </button>
        </div>
      </div>
      
      <div className="pipeline-status">
        {STAGES.map((stage, index) => {
          const status = getStageStatus(index);
          return (
            <div key={stage.key} className="pipeline-stage">
              <div className={`stage-circle ${status}`}>
                {status === 'completed' ? '✓' : status === 'active' ? '⏳' : index + 1}
              </div>
              <div className={`stage-name ${status === 'active' ? 'active' : ''}`}>
                {stage.icon} {stage.name}
              </div>
            </div>
          );
        })}
      </div>
      
      {pipeline.error_message && (
        <div style={{ 
          marginTop: '1rem', 
          padding: '0.75rem', 
          background: '#fee2e2', 
          color: '#dc2626', 
          borderRadius: '6px',
          fontSize: '0.85rem'
        }}>
          ⚠️ 错误: {pipeline.error_message}
        </div>
      )}
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginTop: '1rem', 
        fontSize: '0.8rem', 
        color: '#6b7280' 
      }}>
        <span>开始时间: {pipeline.started_at ? formatTime(pipeline.started_at) : '-'}</span>
        <span>结束时间: {pipeline.finished_at ? formatTime(pipeline.finished_at) : '-'}</span>
      </div>
    </div>
  );
}
