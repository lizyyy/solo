import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  Bus,
  FileText,
  MapPin,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import { useAppStore } from '@/store';

export default function Dashboard() {
  const navigate = useNavigate();
  const { points, busTimeSlots, stallRotations, getPendingReviewPoints } = useAppStore();

  const pendingPoints = getPendingReviewPoints();
  const boundaryPoints = points.filter((p) => p.isBoundary);
  const activeStalls = stallRotations.filter((s) => s.status === 'active');

  const stats = [
    {
      label: '总点位数量',
      value: points.length,
      icon: MapPin,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: '边界点位',
      value: boundaryPoints.length,
      icon: AlertTriangle,
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: '公交时段数',
      value: busTimeSlots.length,
      icon: Bus,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
    },
    {
      label: '活跃摊位',
      value: activeStalls.length,
      icon: TrendingUp,
      color: 'from-purple-500 to-indigo-500',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
  ];

  const quickActions = [
    {
      label: '导入公交刷卡时段',
      description: '上传Excel/CSV文件导入时段数据',
      icon: Bus,
      path: '/bus-time',
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      label: '编辑红线图备注',
      description: '查看和修改点位备注信息',
      icon: FileText,
      path: '/redline-remark',
      color: 'bg-green-500 hover:bg-green-600',
    },
    {
      label: '查看地图展示',
      description: '2D/3D地图、图表统计、导出',
      icon: MapPin,
      path: '/map-view',
      color: 'bg-purple-500 hover:bg-purple-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 font-serif">工作台</h2>
        <p className="text-slate-500 mt-1">欢迎使用早市摊位轮换管理系统</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-500 text-sm">{stat.label}</p>
                  <p className="text-3xl font-bold text-slate-800 mt-2">
                    {stat.value}
                  </p>
                </div>
                <div
                  className={`w-12 h-12 ${stat.bgColor} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}
                >
                  <Icon size={24} className={stat.iconColor} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {pendingPoints.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center animate-pulse">
              <AlertTriangle size={20} className="text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-800">待办提醒</h3>
              <p className="text-amber-700 text-sm">
                您有 {pendingPoints.length} 个边界点位等待复核
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingPoints.slice(0, 3).map((point) => (
              <span
                key={point.id}
                className="px-3 py-1 bg-white rounded-full text-sm text-amber-700 border border-amber-200"
              >
                {point.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">快捷操作</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={index}
                  onClick={() => navigate(action.path)}
                  className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 text-left group"
                >
                  <div
                    className={`w-12 h-12 ${action.color} rounded-xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}
                  >
                    <Icon size={24} />
                  </div>
                  <h4 className="font-semibold text-slate-800 mb-1">
                    {action.label}
                  </h4>
                  <p className="text-sm text-slate-500">{action.description}</p>
                  <div className="mt-4 flex items-center text-blue-600 text-sm font-medium">
                    立即前往
                    <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-800 mb-4">最近操作</h3>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 divide-y divide-slate-100">
            {[
              { text: '导入了3条公交刷卡时段', time: '10分钟前', type: 'import' },
              { text: '修改了两街交界点位A的备注', time: '30分钟前', type: 'edit' },
              { text: '生成了本周摊位轮换表', time: '1小时前', type: 'create' },
            ].map((item, index) => (
              <div key={index} className="p-4 flex items-start gap-3 hover:bg-slate-50">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    item.type === 'import'
                      ? 'bg-blue-100 text-blue-600'
                      : item.type === 'edit'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-purple-100 text-purple-600'
                  }`}
                >
                  <CheckCircle size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 truncate">{item.text}</p>
                  <p className="text-xs text-slate-400 mt-1">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardCheck size={20} className="text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-800">核心流程指引</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { step: 1, text: '导入公交刷卡时段', active: true },
            { step: 2, text: '补看红线图备注', active: true },
            { step: 3, text: '导出更新地图', active: false },
          ].map((item, index, arr) => (
            <div key={index} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                  item.active
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    item.active
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-300 text-white'
                  }`}
                >
                  {item.step}
                </span>
                <span className="text-sm font-medium">{item.text}</span>
              </div>
              {index < arr.length - 1 && (
                <ArrowRight size={16} className="mx-2 text-slate-300" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
