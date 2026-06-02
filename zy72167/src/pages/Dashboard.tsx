import { useCarbonStore } from '@/store/carbonStore';
import {
  Leaf,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Upload,
  CheckSquare,
  FileSpreadsheet,
} from 'lucide-react';
import StatusBadge from '@/components/common/StatusBadge';
import SourceBadge from '@/components/common/SourceBadge';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { getStats, records, mergeGroups, currentOperator } = useCarbonStore();
  const navigate = useNavigate();
  const stats = getStats();

  const statCards = [
    {
      label: '总记录数',
      value: stats.total,
      icon: Leaf,
      color: 'bg-primary-600',
    },
    {
      label: '审核通过',
      value: stats.confirmed,
      icon: CheckCircle,
      color: 'bg-green-600',
    },
    {
      label: '待处理',
      value: stats.pending,
      icon: Clock,
      color: 'bg-blue-600',
    },
    {
      label: '需确认',
      value: stats.needsReview,
      icon: AlertTriangle,
      color: 'bg-warn-500',
    },
    {
      label: '已驳回',
      value: stats.rejected,
      icon: XCircle,
      color: 'bg-danger-500',
    },
  ];

  const recentRecords = records.slice(-5).reverse();
  const pendingGroups = mergeGroups.filter(g => g.status === 'needs_review' || g.status === 'pending');

  const quickActions = [
    { label: '导入数据', icon: Upload, path: '/import', color: 'from-blue-500 to-blue-600' },
    { label: '人工复核', icon: CheckSquare, path: '/review', color: 'from-warn-500 to-warn-600' },
    { label: '导出公示', icon: FileSpreadsheet, path: '/export', color: 'from-primary-500 to-primary-600' },
  ];

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-xl font-semibold mb-2">欢迎回来，{currentOperator}</h3>
            <p className="text-primary-100">
              当前共有 <span className="font-bold text-white">{stats.total}</span> 条碳记录，
              总碳排放量 <span className="font-bold text-white">{stats.totalCarbon.toFixed(1)}</span> kgCO2e
            </p>
          </div>
          <div className="text-right">
            <p className="text-primary-200 text-sm">待处理归并组</p>
            <p className="text-3xl font-bold">{pendingGroups.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {statCards.map((card, index) => (
          <div key={index} className="card p-5 animate-scale-in" style={{ animationDelay: `${index * 50}ms` }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">{card.label}</p>
                <p className="text-3xl font-bold text-gray-800">{card.value}</p>
              </div>
              <div className={`${card.color} p-2.5 rounded-md`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-serif text-lg font-semibold text-gray-800">待处理归并组</h4>
            <button
              onClick={() => navigate('/merge')}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              查看全部 <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3">
            {pendingGroups.slice(0, 3).map((group) => (
              <div key={group.id} className="card p-4 hover:border-primary-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h5 className="font-medium text-gray-800">{group.canonicalName}</h5>
                      <span className={`w-2 h-2 rounded-full ${
                        group.status === 'needs_review' ? 'bg-warn-500' : 'bg-blue-500'
                      }`} />
                    </div>
                    <p className="text-sm text-gray-500 mb-2">{group.standardAddress}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">
                        {group.recordCount} 条记录 · {group.totalCarbon.toFixed(1)} kgCO2e
                      </span>
                      <span className="text-sm text-primary-600 font-medium">
                        匹配度 {group.confidenceScore}%
                      </span>
                    </div>
                  </div>
                  <div className="progress-bar w-20 mt-2">
                    <div
                      className={`progress-fill ${
                        group.confidenceScore >= 85 ? 'bg-green-500' : 'bg-warn-500'
                      }`}
                      style={{ width: `${group.confidenceScore}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            
            {pendingGroups.length === 0 && (
              <div className="card p-8 text-center text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-400" />
                <p>暂无待处理的归并组</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h4 className="font-serif text-lg font-semibold text-gray-800 mb-4">快捷操作</h4>
            <div className="space-y-3">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => navigate(action.path)}
                  className={`w-full card p-4 flex items-center gap-4 hover:scale-[1.02] transition-transform bg-gradient-to-r ${action.color} text-white border-none`}
                >
                  <action.icon className="w-6 h-6" />
                  <span className="font-medium">{action.label}</span>
                  <ArrowRight className="w-5 h-5 ml-auto" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-serif text-lg font-semibold text-gray-800 mb-4">最近记录</h4>
            <div className="space-y-2">
              {recentRecords.map((record) => (
                <div key={record.id} className="card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {record.pointName}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <SourceBadge sourceType={record.sourceType} className="text-xs" />
                        <StatusBadge status={record.status} className="text-xs" />
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-primary-600 whitespace-nowrap">
                      {record.carbonAmount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
