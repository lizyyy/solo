import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  Users,
  BarChart3,
  Calculator,
  Layers,
  FileBarChart,
} from 'lucide-react';
import { useAppStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const {
    studentAnswers,
    parameterTables,
    mealPlanResults,
    getLatestMealPlan,
    getStats,
  } = useAppStore();

  const latestPlan = getLatestMealPlan();
  const unresolvedErrors = latestPlan?.errors.filter(e => !e.resolved).length || 0;
  const resolvedErrors = latestPlan?.errors.filter(e => e.resolved).length || 0;
  const globalStats = getStats();

  const stats = {
    total: studentAnswers.length,
    pending: studentAnswers.filter(a => a.status === 'pending').length,
    reviewing: studentAnswers.filter(a => a.status === 'reviewing').length,
    exception: studentAnswers.filter(a => a.status === 'exception').length,
    normal: studentAnswers.filter(a => a.status === 'normal').length,
  };

  const multiVersionStudents = globalStats.multiVersionStudentCount;

  const recentAnswers = [...studentAnswers]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const statCards = [
    {
      label: '待审核答案',
      value: stats.pending,
      icon: Clock,
      color: 'bg-slate-500',
      bgColor: 'bg-slate-50',
    },
    {
      label: '复核中答案（运营）',
      value: stats.reviewing,
      icon: AlertTriangle,
      color: 'bg-amber-500',
      bgColor: 'bg-amber-50',
    },
    {
      label: '异常答案',
      value: stats.exception,
      icon: AlertTriangle,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
    },
    {
      label: '已通过答案',
      value: stats.normal,
      icon: CheckCircle,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">欢迎回来，吴老师</h1>
          <p className="text-slate-500 mt-1">
            今天是 {new Date().toLocaleDateString('zh-CN')}，您有 {stats.pending + stats.reviewing} 条待处理事项
          </p>
        </div>
        <button
          onClick={() => navigate('/parameters')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
        >
          <FileText className="w-4 h-4" />
          导入参数表
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`${card.bgColor} rounded-xl p-6 border border-slate-100 hover:shadow-md transition-shadow`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-600 text-sm">{card.label}</p>
                <p className="text-3xl font-bold text-slate-800 mt-2">{card.value}</p>
              </div>
              <div className={`${card.color} p-3 rounded-lg`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-800">最近提交的答案</h3>
            <button
              onClick={() => navigate('/answers')}
              className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
            >
              查看全部 <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            {recentAnswers.map((answer) => (
              <div
                key={answer.id}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                onClick={() => navigate(`/answers/${answer.id}`)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-slate-600">
                      {answer.studentName[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">
                      {answer.studentName}
                      <span className="text-slate-400 text-sm ml-2">v{answer.version}</span>
                    </p>
                    <p className="text-sm text-slate-500 truncate max-w-md">
                      {answer.content.substring(0, 50)}...
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-400">{answer.createdAt}</span>
                  <StatusBadge status={answer.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border-2 border-amber-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-5 h-5 text-amber-600" />
              <p className="font-semibold text-slate-800">三步样例流程</p>
            </div>
            <div className="space-y-2.5">
              <button
                onClick={() => navigate('/parameters')}
                className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center">1</span>
                  <span className="text-sm text-slate-700">导入参数调试表</span>
                </div>
                <span className="text-xs text-slate-400">{parameterTables.length}条 →</span>
              </button>
              <button
                onClick={() => navigate('/answers')}
                className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">2</span>
                  <span className="text-sm text-slate-700">吴老师补看手算反例</span>
                </div>
                <span className="text-xs text-slate-400">
                  {studentAnswers.filter(a => a.manualExample).length}已补 →
                </span>
              </button>
              <button
                onClick={() => navigate('/reports')}
                className="w-full flex items-center justify-between p-3 bg-amber-50 rounded-lg hover:bg-amber-100 border border-amber-200 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-400 text-white text-xs font-bold flex items-center justify-center">3</span>
                  <span className="text-sm font-medium text-amber-800">误差说明更新（同数据）</span>
                </div>
                <span className="text-xs font-medium text-amber-700">
                  {unresolvedErrors}待处理 →
                </span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">多版答案冲突</p>
                <p className="text-2xl font-bold text-slate-800">{multiVersionStudents} 人</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              已标记<span className="font-medium text-amber-600"> 留待运营复核 </span>，勿提前归正常
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">参数版本</p>
                <p className="text-2xl font-bold text-slate-800">{parameterTables.length}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/parameters')}
              className="w-full text-sm text-slate-600 hover:text-slate-800 text-left flex items-center justify-between"
            >
              <span>
                生效版本：
                <span className="font-mono font-semibold text-slate-800 ml-1">
                  {latestPlan?.parameterVersion || '暂无'}
                </span>
              </span>
              <Calculator className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <FileBarChart className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">最新误差报告</p>
                  <p className="text-2xl font-bold">
                    {resolvedErrors}/{latestPlan?.errors.length || 0}
                  </p>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              保留原始说法、改后值、处理原因、下一步找谁
            </p>
            <button
              onClick={() => navigate('/reports')}
              className="w-full flex items-center justify-center gap-2 py-2 bg-amber-500 text-slate-900 rounded-lg font-medium hover:bg-amber-400 transition-colors"
            >
              查看完整误差说明
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
