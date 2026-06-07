import { History, User, FileText, FlaskConical, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { HistoryRecord, TargetType } from '@/types';

const iconMap: Record<TargetType, React.ReactNode> = {
  note: <FileText size={16} />,
  experiment: <FlaskConical size={16} />,
  anomaly: <AlertTriangle size={16} />,
};

const colorMap: Record<string, string> = {
  '导入调参笔记': 'text-primary-400 bg-primary-500/20',
  '检测到异常': 'text-warning-400 bg-warning-500/20',
  '从实验桶补录': 'text-primary-400 bg-primary-500/20',
  '标记旧口径': 'text-primary-400 bg-primary-500/20',
  '提交复核': 'text-warning-400 bg-warning-500/20',
  '复核通过': 'text-success-400 bg-success-500/20',
  '复核驳回': 'text-danger-400 bg-danger-500/20',
  '重跑校准': 'text-primary-400 bg-primary-500/20',
  '系统初始化': 'text-slate-400 bg-slate-500/20',
};

export default function HistoryPage() {
  const { history, thresholdNotes, anomalies } = useAppStore();
  
  const sortedHistory = [...history].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  const normalCount = thresholdNotes.filter(n => n.status === 'normal').length;
  const timeWindowCount = anomalies.filter(a => a.type === 'time_window').length;
  const oldCaliberCount = anomalies.filter(a => a.type === 'old_caliber').length;
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-stagger">
        <div>
          <h1 className="text-2xl font-bold text-white">历史记录</h1>
          <p className="text-slate-400 mt-1">完整的操作轨迹和三种样本处理结果对比</p>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 animate-stagger" style={{ animationDelay: '100ms' }}>
        <div className="glass-card p-5 border-l-4 border-success-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success-500/20 flex items-center justify-center">
              <CheckCircle2 className="text-success-400" size={20} />
            </div>
            <div>
              <p className="text-3xl font-bold text-success-400">{normalCount}</p>
              <p className="text-sm text-slate-400">顺利记录</p>
            </div>
          </div>
        </div>
        
        <div className="glass-card p-5 border-l-4 border-warning-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning-500/20 flex items-center justify-center">
              <AlertTriangle className="text-warning-400" size={20} />
            </div>
            <div>
              <p className="text-3xl font-bold text-warning-400">{timeWindowCount}</p>
              <p className="text-sm text-slate-400">时间窗穿越虚高</p>
            </div>
          </div>
        </div>
        
        <div className="glass-card p-5 border-l-4 border-primary-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
              <History className="text-primary-400" size={20} />
            </div>
            <div>
              <p className="text-3xl font-bold text-primary-400">{oldCaliberCount}</p>
              <p className="text-sm text-slate-400">旧口径补录</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="glass-card overflow-hidden animate-stagger" style={{ animationDelay: '200ms' }}>
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-white">操作日志</h2>
        </div>
        
        <div className="p-6">
          {sortedHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <History className="mx-auto mb-3 opacity-50" size={40} />
              <p>暂无操作记录</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-700" />
              
              <div className="space-y-6">
                {sortedHistory.map((record, index) => {
                  const colorClass = colorMap[record.action] || 'text-slate-400 bg-slate-500/20';
                  
                  return (
                    <div 
                      key={record.id} 
                      className="relative pl-12 animate-stagger"
                      style={{ animationDelay: `${(index + 3) * 50}ms` }}
                    >
                      <div className={`absolute left-0 w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}>
                        {iconMap[record.targetType]}
                      </div>
                      
                      <div className="glass-card p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 text-xs rounded-full ${colorClass} font-medium`}>
                                {record.action}
                              </span>
                              <span className="text-xs text-slate-500">
                                {new Date(record.timestamp).toLocaleString('zh-CN')}
                              </span>
                            </div>
                            <p className="text-sm text-slate-300 mt-2">{record.detail}</p>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <User size={12} />
                            {record.operator}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="glass-card p-5 animate-stagger" style={{ animationDelay: '400ms' }}>
        <h3 className="text-white font-semibold mb-4">三种样本处理结果对比</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="table-header text-left">样本类型</th>
                <th className="table-header text-left">处理方式</th>
                <th className="table-header text-left">是否自动标记</th>
                <th className="table-header text-left">是否需要复核</th>
                <th className="table-header text-left">最终状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              <tr className="hover:bg-slate-700/30">
                <td className="table-cell">
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="text-success-400" size={16} />
                    顺利记录（正常）
                  </span>
                </td>
                <td className="table-cell text-slate-300">直接纳入正常数据</td>
                <td className="table-cell text-success-400">-</td>
                <td className="table-cell text-slate-400">不需要</td>
                <td className="table-cell">
                  <span className="status-badge bg-success-500/20 text-success-400 border-success-500/30">正常</span>
                </td>
              </tr>
              <tr className="hover:bg-slate-700/30">
                <td className="table-cell">
                  <span className="inline-flex items-center gap-2">
                    <AlertTriangle className="text-warning-400" size={16} />
                    时间窗穿越虚高
                  </span>
                </td>
                <td className="table-cell text-slate-300">标记为异常，不归为正常</td>
                <td className="table-cell text-success-400">是，系统自动检测</td>
                <td className="table-cell text-warning-400 font-medium">必须复核</td>
                <td className="table-cell">
                  <span className="status-badge bg-warning-500/20 text-warning-400 border-warning-500/30">待复核</span>
                </td>
              </tr>
              <tr className="hover:bg-slate-700/30">
                <td className="table-cell">
                  <span className="inline-flex items-center gap-2">
                    <History className="text-primary-400" size={16} />
                    旧口径补录
                  </span>
                </td>
                <td className="table-cell text-slate-300">标记为旧口径，单独处理</td>
                <td className="table-cell text-success-400">是，来源识别</td>
                <td className="table-cell text-slate-400">建议复核</td>
                <td className="table-cell">
                  <span className="status-badge bg-primary-500/20 text-primary-400 border-primary-500/30">旧口径</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
