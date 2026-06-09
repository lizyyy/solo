import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileBarChart,
  User,
  Clock,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Users,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Calculator,
  Download,
  ArrowRight,
  FileText,
  Layers,
  ArrowLeft,
  List,
} from 'lucide-react';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { useAppStore } from '@/store';
import type { NextStep, ErrorItem } from '@/types';
import { cn } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';

ChartJS.register(ArcElement, Tooltip, Legend);

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const {
    mealPlanResults,
    studentAnswers,
    parameterTables,
    currentUser,
    resolveError,
    updateAnswerStatus,
  } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState<Record<string, string>>({});

  const stats = {
    total: studentAnswers.length,
    pending: studentAnswers.filter((a) => a.status === 'pending').length,
    reviewing: studentAnswers.filter((a) => a.status === 'reviewing').length,
    exception: studentAnswers.filter((a) => a.status === 'exception').length,
    normal: studentAnswers.filter((a) => a.status === 'normal').length,
  };

  const multiVersionCount = new Set(studentAnswers.map((a) => a.studentId)).size;
  const multiVersionAnswers = studentAnswers.filter(
    (a, _, arr) => arr.filter((x) => x.studentId === a.studentId).length > 1
  ).length;

  const latestResult = [...mealPlanResults].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];

  const latestTable = [...parameterTables].sort(
    (a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
  )[0];

  const pieData = {
    labels: ['正常', '复核中', '待审核', '异常'],
    datasets: [
      {
        data: [stats.normal, stats.reviewing, stats.pending, stats.exception],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#64748b'],
        borderWidth: 0,
      },
    ],
  };

  const pieOptions = {
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { boxWidth: 12, font: { size: 11 } },
      },
    },
  };

  const unresolvedCount =
    latestResult?.errors.filter((e) => !e.resolved).length || 0;
  const resolvedCount =
    latestResult?.errors.filter((e) => e.resolved).length || 0;

  const getNextStepLabel = (step: NextStep) => {
    return step === 'business' ? '业务运营团队' : '教研负责人吴老师';
  };

  const getNextStepIcon = (step: NextStep) => {
    return step === 'business' ? Briefcase : Users;
  };

  const answerById = (id?: string) => studentAnswers.find((a) => a.id === id);

  const handleResolve = (error: ErrorItem, resolved: boolean) => {
    const note = resolveNote[error.id] || (resolved ? '运营复核通过，已归档' : '需继续补充材料');
    resolveError(error.id, resolved, note);
    if (error.answerId && resolved) {
      updateAnswerStatus(error.answerId, 'normal');
    }
    if (error.answerId && !resolved) {
      updateAnswerStatus(error.answerId, 'reviewing');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg">
              <FileText className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">报告中心</h1>
              <p className="text-slate-500 mt-0.5">
                拉格朗日乘子配餐分析报告 · 参数版本{' '}
                <span className="font-mono text-slate-700 font-medium">
                  {latestResult?.parameterVersion || 'N/A'}
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/answers')}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回答案列表
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors">
            <Download className="w-4 h-4" />
            导出完整报告
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-2 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Calculator className="w-3.5 h-3.5" />
                计算依据 - 参数调试表
              </p>
              <p className="text-lg font-bold mt-2">{latestTable?.name || '未导入'}</p>
              <p className="text-sm text-slate-400 mt-1">
                {latestTable?.records.length || 0} 条约束 · 版本{' '}
                {latestTable?.version || 'N/A'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">生成时间</p>
              <p className="text-sm mt-1">{latestResult?.createdAt || '-'}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-xs text-slate-400 mb-1">计算方法</p>
            <p className="text-sm leading-relaxed text-slate-200">
              {latestResult?.calculationReason}
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              误差已处理
            </p>
          </div>
          <p className="text-3xl font-bold text-emerald-600 mt-3">{resolvedCount}</p>
          <p className="text-xs text-slate-500 mt-1">条已归档</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              保留待处理
            </p>
          </div>
          <p className="text-3xl font-bold text-amber-600 mt-3">{unresolvedCount}</p>
          <p className="text-xs text-slate-500 mt-1">条未归档，先别急着归正常</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              多版答案学生
            </p>
          </div>
          <p className="text-3xl font-bold text-slate-800 mt-3">
            {multiVersionAnswers > 0 ? multiVersionCount : 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            人 · {multiVersionAnswers} 份待运营复核
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="col-span-3 space-y-6">
          {latestResult && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-slate-600" />
                    配餐结果（含参数版本和取舍理由）
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    基于{latestResult.parameterVersion}，共 {Object.keys(latestResult.result).length} 类分配
                  </p>
                </div>
                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-mono">
                  {latestResult.parameterVersion}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(latestResult.result).map(([key, value], idx) => {
                  const param = latestTable?.records[idx];
                  return (
                    <div
                      key={key}
                      className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 text-white relative overflow-hidden"
                    >
                      <div className="absolute right-0 top-0 w-20 h-20 bg-amber-500/10 rounded-full -mr-10 -mt-10" />
                      <p className="text-sm text-slate-400">{key}</p>
                      <p className="text-3xl font-bold mt-2">{value}%</p>
                      {param && (
                        <div className="mt-3 pt-3 border-t border-slate-700/50">
                          <p className="text-xs text-slate-500">
                            取舍依据: {param.name} = {param.value} {param.constraint}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    误差说明（完整复核链路 - 非冷冰冰系统日志）
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    每条说明：为什么被留下 → 还缺什么材料 → 下一步找谁 → 处理经过
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">
                    ⏳ 待处理 {unresolvedCount}
                  </span>
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                    ✓ 已归档 {resolvedCount}
                  </span>
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {latestResult?.errors.map((error, idx) => {
                const answer = answerById(error.answerId);
                const Icon = getNextStepIcon(error.nextStep);
                return (
                  <div
                    key={error.id}
                    className={cn(
                      'transition-colors',
                      error.resolved ? 'bg-slate-50/50' : ''
                    )}
                  >
                    <div
                      className="p-6 cursor-pointer hover:bg-slate-50/50 transition-colors"
                      onClick={() =>
                        setExpandedId(expandedId === error.id ? null : error.id)
                      }
                    >
                      <div className="flex items-start justify-between gap-6">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-slate-400 font-mono">
                              #{idx + 1}
                            </span>
                            {error.resolved ? (
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                已归档 · 纳入正常结果
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-medium flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                保留在异常列表 · 待复核
                              </span>
                            )}
                            {error.studentName && (
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs rounded-full font-medium flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {error.studentName} v{error.studentVersion}
                              </span>
                            )}
                            {answer && <StatusBadge status={answer.status} />}
                          </div>

                          <h4 className="font-medium text-slate-800 mt-3 text-base">
                            {error.description}
                          </h4>

                          <div className="mt-3 flex items-center gap-4 flex-wrap">
                            <div
                              className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
                                error.nextStep === 'business'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              )}
                            >
                              <Icon className="w-4 h-4" />
                              下一步 → {getNextStepLabel(error.nextStep)}
                            </div>
                            {error.answerId && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/answers/${error.answerId}`);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                              >
                                <List className="w-4 h-4" />
                                打开答案详情
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          {!error.resolved && error.answerId && (
                            <div
                              className="flex flex-col gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => handleResolve(error, true)}
                                className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 transition-colors font-medium flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                运营已复核通过
                              </button>
                              <button
                                onClick={() => handleResolve(error, false)}
                                className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-300 transition-colors font-medium flex items-center gap-1"
                              >
                                <XCircle className="w-3 h-3" />
                                继续保留待处理
                              </button>
                            </div>
                          )}
                          {expandedId === error.id ? (
                            <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>

                    {expandedId === error.id && (
                      <div className="px-6 pb-6 border-t border-slate-100 pt-5 bg-slate-50/50">
                        <div className="grid grid-cols-2 gap-5">
                          {error.originalContent && (
                            <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-5 border border-red-100">
                              <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                                <XCircle className="w-4 h-4" />
                                原始说法（保留用于对照）
                              </p>
                              <p className="text-sm text-red-800 leading-relaxed whitespace-pre-wrap">
                                {error.originalContent}
                              </p>
                            </div>
                          )}

                          {error.correctedContent && (
                            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-5 border border-emerald-100">
                              <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" />
                                改后的值 / 正确解
                              </p>
                              <p className="text-sm text-emerald-800 leading-relaxed whitespace-pre-wrap">
                                {error.correctedContent}
                              </p>
                            </div>
                          )}

                          <div className="bg-white rounded-xl p-5 border border-slate-200 col-span-2">
                            <p className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
                              <Clock className="w-4 h-4" />
                              📋 处理原因 / 为什么这条被留下
                            </p>
                            <div className="bg-slate-50 rounded-lg p-4">
                              <p className="text-sm text-slate-700 leading-relaxed">
                                {error.reviewProcess || error.reason}
                              </p>
                            </div>
                          </div>

                          <div className="bg-white rounded-xl p-5 border border-slate-200">
                            <p className="text-xs font-semibold text-slate-600 mb-3">
                              📦 还缺什么材料
                            </p>
                            <div className="space-y-2">
                              {error.missingMaterials.map((m, i) => (
                                <div
                                  key={i}
                                  className={cn(
                                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                                    m.startsWith('✅')
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : m.startsWith('⏳')
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-slate-50 text-slate-600'
                                  )}
                                >
                                  <span className="font-medium">{m}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="bg-white rounded-xl p-5 border border-slate-200">
                            <p className="text-xs font-semibold text-slate-600 mb-3">
                              👤 下一步该找谁
                            </p>
                            <div
                              className={cn(
                                'rounded-xl p-4 border-2',
                                error.nextStep === 'business'
                                  ? 'bg-blue-50 border-blue-200'
                                  : 'bg-emerald-50 border-emerald-200'
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    'p-3 rounded-xl',
                                    error.nextStep === 'business'
                                      ? 'bg-blue-600'
                                      : 'bg-emerald-600'
                                  )}
                                >
                                  <Icon className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                  <p className="font-bold text-slate-800">
                                    {getNextStepLabel(error.nextStep)}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    {error.nextStep === 'business'
                                      ? '负责业务确认、收集纸质材料、与学生沟通'
                                      : '负责专业复核、补充手算反例、最终判定'}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="mt-3">
                              <p className="text-xs text-slate-400 mb-2">
                                复核备注（可选）
                              </p>
                              <input
                                type="text"
                                placeholder="输入处理备注后点击上面的按钮归档..."
                                value={resolveNote[error.id] || ''}
                                onChange={(e) =>
                                  setResolveNote({
                                    ...resolveNote,
                                    [error.id]: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/20"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {(!latestResult || latestResult.errors.length === 0) && (
                <div className="p-12 text-center text-slate-400">
                  <FileBarChart className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>暂无误差项，请先导入参数表</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-500" />
              答案状态分布
            </h3>
            <div className="h-48">
              <Pie data={pieData} options={pieOptions} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">📊 汇总数据</h3>
            <div className="space-y-3.5">
              {[
                { label: '参数调试表版本', value: parameterTables.length, color: 'text-slate-800' },
                { label: '学生总人数', value: multiVersionCount, color: 'text-blue-600' },
                { label: '答案总数', value: stats.total, color: 'text-slate-800' },
                { label: '多版答案冲突', value: multiVersionAnswers, color: 'text-amber-600' },
                { label: '待复核总数', value: stats.pending + stats.reviewing, color: 'text-red-600' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <span className="text-sm text-slate-600">{item.label}</span>
                  <span className={cn('font-bold text-lg', item.color)}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-white">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold">当前登录</h3>
            </div>
            <p className="text-xl font-bold">{currentUser}</p>
            <p className="text-sm text-slate-400 mt-1">教研负责人</p>
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Clock className="w-4 h-4" />
                <span>
                  {new Date().toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>
            <button
              onClick={() => navigate('/parameters')}
              className="w-full mt-5 flex items-center justify-center gap-2 py-2.5 bg-amber-500 text-slate-900 rounded-lg font-semibold hover:bg-amber-400 transition-colors"
            >
              重新走样例流程
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
