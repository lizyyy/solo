import { useNavigate } from 'react-router-dom';
import {
  Clock,
  AlertTriangle,
  FileText,
  ArrowRight,
  Music,
} from 'lucide-react';
import { useStore } from '../store/useStore';

export default function Dashboard() {
  const navigate = useNavigate();
  const totalRecords = useStore((state) => state.getTotalRecords());
  const lateCount = useStore((state) => state.getLateCount());
  const pendingReviewCount = useStore((state) => state.getPendingReviewCount());
  const contracts = useStore((state) => state.contracts);
  const trackAliases = useStore((state) => state.trackAliases);

  const stats = [
    {
      label: '排练记录总数',
      value: totalRecords,
      icon: FileText,
      color: 'bg-primary-100 text-primary-700',
      path: '/statistics',
    },
    {
      label: '迟到人次',
      value: lateCount,
      icon: Clock,
      color: 'bg-danger-100 text-danger-600',
      path: '/statistics',
    },
    {
      label: '待复核异常',
      value: pendingReviewCount,
      icon: AlertTriangle,
      color: 'bg-amber-100 text-amber-700',
      path: '/review',
    },
    {
      label: '曲目别名数',
      value: trackAliases.length,
      icon: Music,
      color: 'bg-accent-100 text-accent-700',
      path: '/aliases',
    },
  ];

  const workflowSteps = [
    {
      step: 1,
      title: '导入合同页截图',
      description: '上传合同截图，系统自动去重',
      path: '/contracts',
      status: '基础步骤',
    },
    {
      step: 2,
      title: '补看曲目别名表',
      description: '对照截图补充备注，保留原始格式',
      path: '/aliases',
      status: '关键步骤',
    },
    {
      step: 3,
      title: '更新排练变更记录',
      description: '含返工原因自动标记待复核',
      path: '/statistics',
      status: '最终步骤',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-serif font-bold text-primary-800">
          欢迎回来，老周
        </h1>
        <p className="text-gray-600 mt-1">
          乐团排练迟到统计系统 - 数据可追溯，结论有依据
        </p>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="card cursor-pointer group"
              onClick={() => navigate(stat.path)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-3xl font-bold text-primary-800 mt-2">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm text-primary-600 group-hover:text-primary-700">
                <span>查看详情</span>
                <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-serif font-semibold text-primary-800">
            三步核心工作流
          </h2>
          <span className="text-xs text-gray-500">
            按顺序操作，确保数据完整可追溯
          </span>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {workflowSteps.map((step, index) => (
            <div
              key={step.step}
              className="relative p-5 bg-gradient-to-br from-primary-50 to-white rounded-xl border border-primary-100 cursor-pointer hover:shadow-md transition-all duration-200"
              onClick={() => navigate(step.path)}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary-700 text-white flex items-center justify-center font-serif font-bold">
                  {step.step}
                </div>
                <div>
                  <h3 className="font-medium text-primary-800">{step.title}</h3>
                  <span className="text-xs text-accent-600">{step.status}</span>
                </div>
              </div>
              <p className="text-sm text-gray-600">{step.description}</p>
              {index < workflowSteps.length - 1 && (
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white border-2 border-primary-200 flex items-center justify-center">
                  <ArrowRight className="w-3 h-3 text-primary-400" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-serif font-semibold text-primary-800 mb-4">
            最近合同截图
          </h2>
          <div className="space-y-3">
            {contracts.slice(0, 3).map((contract) => (
              <div
                key={contract.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-primary-50 cursor-pointer transition-colors"
                onClick={() => navigate('/contracts')}
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-primary-100 flex-shrink-0">
                  <img
                    src={contract.fileUrl}
                    alt={contract.fileName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary-800 truncate">
                    {contract.fileName}
                  </p>
                  <p className="text-xs text-gray-500">
                    导入 {contract.importCount} 次
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-serif font-semibold text-primary-800 mb-4">
            边界规则提醒
          </h2>
          <div className="space-y-3">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-medium text-amber-800">
                📝 备注保留规则
              </p>
              <p className="text-xs text-amber-700 mt-1">
                曲目别名表备注保留原始换行、空格，不做任何清洗
              </p>
            </div>
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg">
              <p className="text-sm font-medium text-danger-800">
                ⚠️ 返工原因检测
              </p>
              <p className="text-xs text-danger-700 mt-1">
                备注含「返工、重录、补录、修正、重新」自动标记待复核
              </p>
            </div>
            <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
              <p className="text-sm font-medium text-primary-800">
                🔍 重复导入检测
              </p>
              <p className="text-xs text-primary-700 mt-1">
                基于 SHA-256 哈希去重，统计数量不翻倍
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
