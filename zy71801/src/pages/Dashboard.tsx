import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { StatusBadge } from '../components/StatusBadge';
import { format } from 'date-fns';

export function Dashboard() {
  const { packs, stats, isLoading, initApp, loadPacks, loadStats } = useStore();

  useEffect(() => {
    initApp();
  }, [initApp]);

  const handleRefresh = async () => {
    await Promise.all([loadPacks(), loadStats()]);
  };

  const statCards = [
    { 
      label: '总数据包', 
      value: stats.total, 
      icon: FileText, 
      color: 'bg-primary-600',
      bgColor: 'bg-primary-50'
    },
    { 
      label: '待处理', 
      value: stats.pending, 
      icon: Clock, 
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50'
    },
    { 
      label: '复核中', 
      value: stats.reviewing, 
      icon: AlertTriangle, 
      color: 'bg-warning-500',
      bgColor: 'bg-warning-50'
    },
    { 
      label: '已完成', 
      value: stats.completed, 
      icon: CheckCircle, 
      color: 'bg-success-500',
      bgColor: 'bg-success-50'
    }
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold text-gray-900">仪表盘</h1>
            <p className="mt-1 text-gray-500">银企回单重挂业务概览</p>
          </div>
          <button 
            onClick={handleRefresh}
            className="btn-secondary flex items-center gap-2"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <div 
            key={stat.label}
            className={`${stat.bgColor} rounded-lg p-6 border transition-all hover:shadow-md`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="bg-white rounded-lg border">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">最近任务</h2>
              <Link 
                to="/evidence" 
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                查看全部
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y">
              {packs.slice(0, 5).map((pack) => (
                <Link 
                  key={pack.id}
                  to={`/evidence/${pack.id}`}
                  className="px-6 py-4 hover:bg-gray-50 flex items-center justify-between group"
                >
                  <div>
                    <div className="font-medium text-gray-900 group-hover:text-primary-600">
                      {pack.name}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {format(new Date(pack.importedAt), 'yyyy-MM-dd HH:mm')}
                      {pack.reviewer && <span className="mx-2">·</span>}
                      {pack.reviewer && <span>负责人：{pack.reviewer}</span>}
                    </div>
                    {pack.description && (
                      <div className="text-sm text-gray-400 mt-1 truncate max-w-md">
                        {pack.description}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={pack.status} />
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">快捷操作</h3>
            <div className="space-y-3">
              <Link 
                to="/import"
                className="w-full btn-primary justify-center"
              >
                导入材料包
              </Link>
              <Link 
                to="/review"
                className="w-full btn-secondary justify-center"
              >
                待复核清单
              </Link>
            </div>
          </div>

          <div className="bg-warning-50 rounded-lg border border-warning-200 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-warning-800">待关注事项</h4>
                <p className="text-sm text-warning-700 mt-1">
                  有 {stats.reviewing} 个数据包等待复核，请及时处理
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
