import { useNavigate } from 'react-router-dom';
import { FileText, ClipboardCheck, FileSpreadsheet, Clock, History } from 'lucide-react';
import { useAppStore } from '@/store';
import WorkflowTimeline from '@/components/WorkflowTimeline';
import StatCard from '@/components/StatCard';

export default function Dashboard() {
  const navigate = useNavigate();
  const { getStats, changeHistories, currentStep } = useAppStore();
  const stats = getStats();

  const recentActivities = [...changeHistories]
    .sort((a, b) => new Date(b.operatedAt).getTime() - new Date(a.operatedAt).getTime())
    .slice(0, 5);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const getActivityText = (history: typeof changeHistories[0]) => {
    if (history.entityType === 'obstacle_note') {
      return `${history.operator} 更新了障碍物备注`;
    }
    if (history.entityType === 'safety_report') {
      return `${history.operator} 更新了安全报告`;
    }
    return `${history.operator} 更新了记录`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">工作流总览</h1>
      
      <div className="flex gap-6">
        <div className="w-72 shrink-0">
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-card">
            <h2 className="text-lg font-medium text-gray-900 mb-4">工作进度</h2>
            <WorkflowTimeline
              currentStep={currentStep as 'import' | 'notes' | 'report'}
              stats={{
                pendingNotes: stats.notesPending,
                pendingReviews: stats.reviewPending,
                pendingReports: stats.reportPending,
              }}
            />
          </div>
        </div>

        <div className="flex-1 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              title="待小陶补备注"
              value={stats.notesPending}
              icon={FileText}
              status="warning"
              action={{
                label: '查看详情',
                onClick: () => navigate('/obstacles'),
              }}
            />
            <StatCard
              title="待经理复核"
              value={stats.reviewPending}
              icon={ClipboardCheck}
              status="info"
              action={{
                label: '查看详情',
                onClick: () => navigate('/review'),
              }}
            />
            <StatCard
              title="待更新报告"
              value={stats.reportPending}
              icon={FileSpreadsheet}
              status="success"
              action={{
                label: '查看详情',
                onClick: () => navigate('/report'),
              }}
            />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-medium text-gray-900">最近活动</h2>
            </div>
            <div className="space-y-3">
              {recentActivities.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">暂无活动记录</p>
              ) : (
                recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-industrial-100 text-industrial-600 shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{getActivityText(activity)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{activity.newValue}</p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {formatTime(activity.operatedAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
