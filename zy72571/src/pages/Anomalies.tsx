import { useState } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  User,
  Send,
  ThumbsUp,
  ThumbsDown,
  Eye
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { StatusBadge } from '@/components/StatusBadge';
import { AnomalySample } from '@/types';

const typeLabels: Record<string, { label: string; color: string }> = {
  time_window: { label: '时间窗穿越', color: 'warning' },
  old_caliber: { label: '旧口径数据', color: 'primary' },
  other: { label: '其他异常', color: 'slate' },
};

export default function Anomalies() {
  const { anomalies, submitForReview, reviewAnomaly, thresholdNotes } = useAppStore();
  const [selectedAnomaly, setSelectedAnomaly] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  
  const pendingCount = anomalies.filter(a => a.status === 'pending_review').length;
  const reviewedCount = anomalies.filter(a => a.status === 'reviewed').length;
  const rejectedCount = anomalies.filter(a => a.status === 'rejected').length;
  
  const handleSubmitReview = (id: string) => {
    submitForReview(id);
  };
  
  const handleReview = (id: string, passed: boolean) => {
    reviewAnomaly(id, passed, reviewComment || (passed ? '数据有效，复核通过' : '数据异常，不予通过'), '负责人');
    setReviewComment('');
    setSelectedAnomaly(null);
  };
  
  const getNoteData = (anomaly: AnomalySample) => {
    if (anomaly.noteData) return anomaly.noteData;
    return thresholdNotes.find(n => n.id === anomaly.noteId);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-stagger">
        <div>
          <h1 className="text-2xl font-bold text-white">异常样本页</h1>
          <p className="text-slate-400 mt-1">处理异常样本，时间窗穿越数据留待负责人复核</p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-warning-500 animate-pulse-soft"></span>
            <span className="text-slate-400">待复核</span>
            <span className="font-bold text-warning-400">{pendingCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success-500"></span>
            <span className="text-slate-400">已通过</span>
            <span className="font-bold text-success-400">{reviewedCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-danger-500"></span>
            <span className="text-slate-400">已驳回</span>
            <span className="font-bold text-danger-400">{rejectedCount}</span>
          </div>
        </div>
      </div>
      
      <div className="glass-card p-4 border-l-4 border-warning-500 animate-stagger" style={{ animationDelay: '100ms' }}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-warning-400 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="text-white font-medium">重要处理原则</h3>
            <p className="text-sm text-slate-400 mt-1">
              <strong className="text-warning-400">时间窗穿越的数据不归为正常！</strong>
              检测到时间窗穿越的记录会自动标记为"待复核"状态，必须提交给实验平台负责人人工复核。
              只有负责人复核通过后，才能确认数据是否有效。
            </p>
          </div>
        </div>
      </div>
      
      {anomalies.length === 0 ? (
        <div className="glass-card p-16 text-center animate-stagger" style={{ animationDelay: '200ms' }}>
          <CheckCircle2 className="mx-auto mb-4 text-success-500/50" size={48} />
          <h3 className="text-xl font-semibold text-white">暂无异常样本</h3>
          <p className="text-slate-400 mt-2">
            所有数据都正常。去导入调参笔记或从实验桶补录旧口径数据看看吧。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {anomalies.map((anomaly, index) => {
            const noteData = getNoteData(anomaly);
            const typeInfo = typeLabels[anomaly.type];
            const isExpanded = selectedAnomaly === anomaly.id;
            
            return (
              <div 
                key={anomaly.id}
                className={`glass-card overflow-hidden animate-stagger transition-all ${
                  anomaly.status === 'pending_review' ? 'ring-2 ring-warning-500/30' : ''
                }`}
                style={{ animationDelay: `${(index + 2) * 100}ms` }}
              >
                <div 
                  className={`p-5 cursor-pointer transition-colors hover:bg-slate-700/30 ${
                    anomaly.type === 'time_window' ? 'border-l-4 border-warning-500' : 
                    anomaly.type === 'old_caliber' ? 'border-l-4 border-primary-500' : 'border-l-4 border-slate-500'
                  }`}
                  onClick={() => setSelectedAnomaly(isExpanded ? null : anomaly.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        anomaly.type === 'time_window' ? 'bg-warning-500/20' :
                        anomaly.type === 'old_caliber' ? 'bg-primary-500/20' : 'bg-slate-700/50'
                      }`}>
                        {anomaly.type === 'time_window' && <Clock className="text-warning-400" size={20} />}
                        {anomaly.type === 'old_caliber' && <AlertTriangle className="text-primary-400" size={20} />}
                        {anomaly.type === 'other' && <AlertTriangle className="text-slate-400" size={20} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-semibold">{typeInfo.label}</h3>
                          <StatusBadge status={anomaly.status} />
                        </div>
                        <p className="text-sm text-slate-400 mt-0.5">{anomaly.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {noteData && (
                        <div className="text-right text-sm">
                          <p className="text-slate-400">阈值: <span className="font-mono text-slate-200">{noteData.threshold}</span></p>
                          <p className="text-slate-400">唤醒率: <span className="text-success-400">{noteData.wakeRate}%</span></p>
                        </div>
                      )}
                      <Eye className="text-slate-500" size={18} />
                    </div>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-slate-700/50 bg-slate-900/30">
                    <div className="pt-4 space-y-4">
                      {noteData && (
                        <div className="grid grid-cols-4 gap-4">
                          <div className="bg-slate-800/50 rounded-lg p-3">
                            <p className="text-xs text-slate-500">批次号</p>
                            <p className="font-mono text-sm text-white mt-1">{noteData.batchId}</p>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-3">
                            <p className="text-xs text-slate-500">阈值</p>
                            <p className="font-mono text-sm text-white mt-1">{noteData.threshold}</p>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-3">
                            <p className="text-xs text-slate-500">唤醒率</p>
                            <p className="font-mono text-sm text-success-400 mt-1">{noteData.wakeRate}%</p>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-3">
                            <p className="text-xs text-slate-500">误唤醒率</p>
                            <p className="font-mono text-sm text-slate-200 mt-1">{noteData.falseAlarmRate}%</p>
                          </div>
                        </div>
                      )}
                      
                      {anomaly.type === 'time_window' && noteData && (
                        <div className="p-4 bg-warning-500/10 rounded-lg border border-warning-500/20">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="text-warning-400 flex-shrink-0 mt-0.5" size={16} />
                            <div>
                              <p className="text-sm font-medium text-warning-300">时间窗穿越详情</p>
                              <p className="text-xs text-warning-400/80 mt-1">
                                统计时段: {noteData.timeWindowStart} ~ {noteData.timeWindowEnd}
                                <br />
                                该记录跨越了统计窗口边界，可能导致唤醒率虚高、误唤醒率偏低。
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {anomaly.reviewer && (
                        <div className="p-4 bg-slate-800/50 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <User size={16} className="text-slate-400" />
                            <span className="text-sm font-medium text-slate-300">{anomaly.reviewer}</span>
                            <StatusBadge status={anomaly.status} />
                          </div>
                          {anomaly.reviewComment && (
                            <p className="text-sm text-slate-400 pl-6">{anomaly.reviewComment}</p>
                          )}
                        </div>
                      )}
                      
                      {anomaly.status === 'pending_review' && (
                        <div className="space-y-3">
                          <textarea
                            placeholder="输入复核意见（可选）..."
                            value={selectedAnomaly === anomaly.id ? reviewComment : ''}
                            onChange={(e) => setReviewComment(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 resize-none"
                            rows={2}
                          />
                          
                          <div className="flex gap-3">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSubmitReview(anomaly.id); }}
                              className="btn-warning flex items-center gap-2"
                            >
                              <Send size={16} />
                              提交给负责人复核
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReview(anomaly.id, true); }}
                              className="btn-success flex items-center gap-2"
                            >
                              <ThumbsUp size={16} />
                              模拟：复核通过
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReview(anomaly.id, false); }}
                              className="btn-danger flex items-center gap-2"
                            >
                              <ThumbsDown size={16} />
                              模拟：复核驳回
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      <div className="glass-card p-5 animate-stagger" style={{ animationDelay: '500ms' }}>
        <h3 className="text-white font-semibold mb-4">异常类型说明</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-warning-500/10 border border-warning-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="text-warning-400" size={18} />
              <span className="font-medium text-warning-300">时间窗穿越</span>
            </div>
            <p className="text-sm text-warning-400/80">
              数据跨越了统计时间窗口，效果指标可能虚高。必须留待负责人复核，不能直接归为正常。
            </p>
          </div>
          <div className="p-4 rounded-lg bg-primary-500/10 border border-primary-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="text-primary-400" size={18} />
              <span className="font-medium text-primary-300">旧口径数据</span>
            </div>
            <p className="text-sm text-primary-400/80">
              从线上实验桶补录的旧口径数据，统计口径与当前不同，需要注意区分处理。
            </p>
          </div>
          <div className="p-4 rounded-lg bg-slate-700/30 border border-slate-600/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="text-slate-400" size={18} />
              <span className="font-medium text-slate-300">其他异常</span>
            </div>
            <p className="text-sm text-slate-400/80">
              其他类型的异常数据，需要人工判断处理方式。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
