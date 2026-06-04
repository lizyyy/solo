import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Calculator,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Droplets,
  ArrowRight,
  FileText,
  SearchCheck,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const {
    calculations,
    reviewTasks,
    screenshots,
    loadAllData,
    isLoading,
    currentUser,
  } = useStore();

  useEffect(() => {
    loadAllData();
  }, []);

  const pendingReviews = reviewTasks.filter((t) => t.status === 'pending').length;
  const completedCalcs = calculations.filter((c) => c.status === 'completed').length;
  const highRiskCount = calculations.filter((c) => c.riskLevel === 'high' || c.riskLevel === 'critical').length;
  const recentCalcs = calculations.slice(0, 3);

  const stats = [
    {
      label: '待复核任务',
      value: pendingReviews,
      icon: SearchCheck,
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      action: () => navigate('/review'),
      actionLabel: '前往复核',
    },
    {
      label: '高风险计算',
      value: highRiskCount,
      icon: AlertTriangle,
      color: 'from-red-500 to-rose-500',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      action: () => navigate('/calculations'),
      actionLabel: '查看详情',
    },
    {
      label: '已完成计算',
      value: completedCalcs,
      icon: CheckCircle,
      color: 'from-emerald-500 to-green-500',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      action: () => navigate('/calculations'),
      actionLabel: '全部计算',
    },
    {
      label: '已导入截图',
      value: screenshots.filter((s) => s.status !== 'duplicate').length,
      icon: Upload,
      color: 'from-cyan-500 to-blue-500',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/30',
      action: () => navigate('/import'),
      actionLabel: '导入数据',
    },
  ];

  const quickActions = [
    {
      title: '导入维修群截图',
      description: '上传截图，智能去重不翻倍',
      icon: Upload,
      color: 'cyan',
      path: '/import',
    },
    {
      title: '新建风险计算',
      description: '选择截图和采样间隔开始计算',
      icon: Calculator,
      color: 'blue',
      path: '/calculations',
    },
    {
      title: '三步工作流',
      description: '导入→补说明→更新复盘',
      icon: Clock,
      color: 'purple',
      path: '/import',
    },
    {
      title: '生成复盘报告',
      description: '人文化报告，责任人明确',
      icon: FileText,
      color: 'emerald',
      path: '/calculations',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">加载数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">
            欢迎回来，{currentUser?.name || '用户'}
          </h1>
          <p className="text-slate-400 text-sm">
            泵站汽蚀风险计算系统 · 智能去重 · 全链路追溯 · 人文化复盘
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className={cn(
              'relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl',
              stat.bgColor,
              stat.borderColor
            )}
          >
            <div
              className={cn(
                'absolute -right-8 -top-8 w-24 h-24 rounded-full bg-gradient-to-br opacity-20 blur-2xl',
                stat.color
              )}
            />
            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div
                  className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br',
                    stat.color
                  )}
                >
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <button
                  onClick={stat.action}
                  className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors"
                >
                  {stat.actionLabel}
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="text-3xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm text-slate-400">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">快捷操作</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {quickActions.map((action, idx) => {
              const colorClasses: Record<string, string> = {
                cyan: 'from-cyan-500/20 to-blue-500/10 border-cyan-500/30 hover:border-cyan-400/50',
                blue: 'from-blue-500/20 to-indigo-500/10 border-blue-500/30 hover:border-blue-400/50',
                purple: 'from-purple-500/20 to-pink-500/10 border-purple-500/30 hover:border-purple-400/50',
                emerald: 'from-emerald-500/20 to-green-500/10 border-emerald-500/30 hover:border-emerald-400/50',
              };
              const iconColors: Record<string, string> = {
                cyan: 'text-cyan-400',
                blue: 'text-blue-400',
                purple: 'text-purple-400',
                emerald: 'text-emerald-400',
              };
              return (
                <button
                  key={idx}
                  onClick={() => navigate(action.path)}
                  className={cn(
                    'text-left p-5 rounded-xl border bg-gradient-to-br transition-all duration-300 hover:scale-[1.02] hover:shadow-lg group',
                    colorClasses[action.color]
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg bg-slate-800/50 flex items-center justify-center shrink-0',
                        iconColors[action.color]
                      )}
                    >
                      <action.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium mb-1 group-hover:text-white transition-colors">
                        {action.title}
                      </h3>
                      <p className="text-xs text-slate-400">{action.description}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">近期计算</h2>
              <button
                onClick={() => navigate('/calculations')}
                className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                查看全部 <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-3">
              {recentCalcs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800">
                  <Calculator className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>暂无计算任务</p>
                </div>
              ) : (
                recentCalcs.map((calc) => (
                  <div
                    key={calc.id}
                    onClick={() => navigate(`/calculations/${calc.id}`)}
                    className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center',
                            calc.riskLevel === 'low' && 'bg-emerald-500/20',
                            calc.riskLevel === 'medium' && 'bg-amber-500/20',
                            calc.riskLevel === 'high' && 'bg-orange-500/20',
                            calc.riskLevel === 'critical' && 'bg-red-500/20'
                          )}
                        >
                          <Droplets
                            className={cn(
                              'w-5 h-5',
                              calc.riskLevel === 'low' && 'text-emerald-400',
                              calc.riskLevel === 'medium' && 'text-amber-400',
                              calc.riskLevel === 'high' && 'text-orange-400',
                              calc.riskLevel === 'critical' && 'text-red-400'
                            )}
                          />
                        </div>
                        <div>
                          <h3 className="font-medium group-hover:text-cyan-300 transition-colors">
                            {calc.name}
                          </h3>
                          <p className="text-xs text-slate-500">
                            {new Date(calc.createdAt).toLocaleString('zh-CN')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div
                            className={cn(
                              'text-2xl font-bold font-mono',
                              calc.riskLevel === 'low' && 'text-emerald-400',
                              calc.riskLevel === 'medium' && 'text-amber-400',
                              calc.riskLevel === 'high' && 'text-orange-400',
                              calc.riskLevel === 'critical' && 'text-red-400'
                            )}
                          >
                            {calc.riskScore}
                            <span className="text-sm font-normal text-slate-500"> 分</span>
                          </div>
                        </div>
                        <StatusBadge status={calc.status} />
                      </div>
                    </div>
                    {calc.parameters.missingIntervals.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-800 flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs text-amber-300">
                          缺失 {calc.parameters.missingIntervals.length} 个采样间隔，待质检员复核
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">系统状态</h2>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-medium text-emerald-400">系统运行正常</span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">数据同步</span>
                <span className="text-emerald-400">实时</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">OCR 服务</span>
                <span className="text-emerald-400">在线</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">3D 引擎</span>
                <span className="text-emerald-400">就绪</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span className="font-medium text-amber-300">关键提示</span>
            </div>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-amber-400">•</span>
                <span>重复导入截图会自动去重，不新增计算任务</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400">•</span>
                <span>修改备注会记录改前改后，便于追溯</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400">•</span>
                <span>采样时间缺半小时，自动流转质检员复核</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400">•</span>
                <span>点击图表数据点可追溯原始截图</span>
              </li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/20">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              <span className="font-medium text-cyan-300">三步工作流</span>
            </div>
            <div className="relative">
              <div className="absolute left-4 top-8 bottom-4 w-0.5 bg-gradient-to-b from-cyan-500 via-blue-500 to-emerald-500" />
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400 text-sm font-bold shrink-0 z-10">
                    1
                  </div>
                  <div>
                    <p className="text-sm font-medium">维修群截图导入</p>
                    <p className="text-xs text-slate-500">智能去重，OCR识别</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center text-blue-400 text-sm font-bold shrink-0 z-10">
                    2
                  </div>
                  <div>
                    <p className="text-sm font-medium">林老师补看采样间隔</p>
                    <p className="text-xs text-slate-500">核对说明，补录数据</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 text-sm font-bold shrink-0 z-10">
                    3
                  </div>
                  <div>
                    <p className="text-sm font-medium">实验复盘图更新</p>
                    <p className="text-xs text-slate-500">人文化报告，明确责任人</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
