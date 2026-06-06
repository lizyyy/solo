import { useNavigate } from 'react-router-dom';
import {
  Thermometer,
  AlertTriangle,
  Clock,
  CheckCircle,
  ArrowRight,
  ClipboardList,
  Cpu,
  FileBarChart,
} from 'lucide-react';
import { useThresholdStore } from '@/store/useThresholdStore';
import { useRecordStore } from '@/store/useRecordStore';
import { useReviewStore } from '@/store/useReviewStore';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatDateShort } from '@/utils/helpers';

export function Dashboard() {
  const navigate = useNavigate();
  const thresholds = useThresholdStore(state => state.thresholds);
  const records = useRecordStore(state => state.records);
  const tasks = useReviewStore(state => state.tasks);
  const history = useRecordStore(state => state.history);

  const pendingTasks = tasks.filter(t => t.status === 'pending');

  const stats = {
    total: records.length,
    normal: records.filter(r => r.status === 'normal').length,
    warning: records.filter(r => r.status === 'warning').length,
    error: records.filter(r => r.status === 'error').length,
    pendingReview: records.filter(r => r.status === 'pending_review').length,
  };

  const recentActivity = history.slice(0, 5);

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">欢迎回来，老唐</h1>
        <p className="text-gray-500 mt-1">混凝土养护温度追踪系统 · 今日概览</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          icon={<Thermometer className="w-6 h-6 text-primary-500" />}
          label="测温记录总数"
          value={stats.total}
          bgColor="bg-blue-50"
        />
        <StatCard
          icon={<CheckCircle className="w-6 h-6 text-industry-success" />}
          label="正常记录"
          value={stats.normal}
          bgColor="bg-green-50"
        />
        <StatCard
          icon={<AlertTriangle className="w-6 h-6 text-industry-warning" />}
          label="预警记录"
          value={stats.warning}
          bgColor="bg-amber-50"
        />
        <StatCard
          icon={<AlertTriangle className="w-6 h-6 text-industry-danger" />}
          label="异常记录"
          value={stats.error}
          bgColor="bg-red-50"
        />
        <StatCard
          icon={<Clock className="w-6 h-6 text-amber-600" />}
          label="待复核任务"
          value={stats.pendingReview}
          bgColor="bg-amber-50"
          onClick={() => navigate('/review')}
          clickable
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">最近活动</h2>
            <button
              onClick={() => navigate('/playback')}
              className="text-sm text-primary-500 hover:text-primary-600 flex items-center gap-1"
            >
              查看全部 <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            {recentActivity.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-primary-600">
                    {item.userName.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">
                    <span className="font-medium">{item.userName}</span>
                    {' '}修改了{' '}
                    <span className="text-primary-600">{getFieldLabel(item.fieldName)}</span>
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500 line-through">{item.oldValue || '(空)'}</span>
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-700 font-medium">{item.newValue || '(空)'}</span>
                  </div>
                  {item.changeReason && (
                    <p className="text-xs text-gray-500 mt-1">原因：{item.changeReason}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {formatDateShort(item.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">快捷操作</h2>
            <div className="grid grid-cols-2 gap-3">
              <QuickAction
                icon={<ClipboardList className="w-5 h-5" />}
                label="导入阈值表"
                onClick={() => navigate('/thresholds')}
              />
              <QuickAction
                icon={<Cpu className="w-5 h-5" />}
                label="查看设备"
                onClick={() => navigate('/equipment')}
              />
              <QuickAction
                icon={<Thermometer className="w-5 h-5" />}
                label="温度看板"
                onClick={() => navigate('/tracking')}
              />
              <QuickAction
                icon={<FileBarChart className="w-5 h-5" />}
                label="生成报告"
                onClick={() => navigate('/reports')}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">待复核任务</h2>
            {pendingTasks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">暂无待复核任务</p>
            ) : (
              <div className="space-y-3">
                {pendingTasks.slice(0, 3).map(task => (
                  <div key={task.id} className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-amber-800">
                        记录 {task.recordId.slice(-4)}
                      </span>
                      <StatusBadge status="pending_review" />
                    </div>
                    <p className="text-xs text-amber-600 mt-1">
                      分配给：{task.assigneeName}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-sm p-6 text-white">
            <h2 className="text-lg font-semibold mb-2">阈值表统计</h2>
            <p className="text-3xl font-bold mb-2">{thresholds.length}</p>
            <p className="text-sm text-white/80">条安全阈值已导入</p>
            <button
              onClick={() => navigate('/thresholds')}
              className="mt-4 w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              管理阈值表
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bgColor,
  onClick,
  clickable = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bgColor: string;
  onClick?: () => void;
  clickable?: boolean;
}) {
  return (
    <div
      className={`${bgColor} rounded-xl p-5 ${clickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        {icon}
        {clickable && <ArrowRight className="w-4 h-4 text-gray-400" />}
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-sm text-gray-600 mt-1">{label}</p>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
    >
      <div className="text-primary-500">{icon}</div>
      <span className="text-xs text-gray-700">{label}</span>
    </button>
  );
}

function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    remark: '备注',
    manualCoefficient: '人工系数',
    reviewReason: '复核原因',
    temperature: '温度值',
    tradeOffReason: '取舍理由',
    parameterVersion: '参数版本',
  };
  return labels[field] || field;
}
