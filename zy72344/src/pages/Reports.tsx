import React, { useState } from 'react';
import {
  FileBarChart,
  User,
  Clock,
  AlertCircle,
  CheckCircle,
  Users,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Calculator,
  Download,
} from 'lucide-react';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { useAppStore } from '@/store';
import type { NextStep } from '@/types';

ChartJS.register(ArcElement, Tooltip, Legend);

const Reports: React.FC = () => {
  const { mealPlanResults, studentAnswers, parameterTables, currentUser } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const latestResult = mealPlanResults[0];

  const stats = {
    total: studentAnswers.length,
    pending: studentAnswers.filter((a) => a.status === 'pending').length,
    reviewing: studentAnswers.filter((a) => a.status === 'reviewing').length,
    exception: studentAnswers.filter((a) => a.status === 'exception').length,
    normal: studentAnswers.filter((a) => a.status === 'normal').length,
  };

  const pieData = {
    labels: ['正常', '复核中', '待审核', '异常'],
    datasets: [
      {
        data: [stats.normal, stats.reviewing, stats.pending, stats.exception],
        backgroundColor: ['#10b981', '#f59e0b', '#64748b', '#ef4444'],
        borderWidth: 0,
      },
    ],
  };

  const getNextStepLabel = (step: NextStep) => {
    return step === 'business' ? '业务运营' : '教研负责人吴老师';
  };

  const getNextStepIcon = (step: NextStep) => {
    return step === 'business' ? Briefcase : Users;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">报告中心</h1>
          <p className="text-slate-500 mt-1">
            拉格朗日乘子配餐分析报告，含误差说明和行动指引
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors">
          <Download className="w-4 h-4" />
          导出报告
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="col-span-3 space-y-6">
          {latestResult && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">
                    最新配餐分析报告
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    生成于 {latestResult.createdAt}
                  </p>
                </div>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  参数版本: {latestResult.parameterVersion}
                </span>
              </div>

              <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Calculator className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">
                    计算说明
                  </span>
                </div>
                <p className="text-sm text-slate-600">
                  {latestResult.calculationReason}
                </p>
              </div>

              <div className="mt-6">
                <h4 className="font-medium text-slate-800 mb-4">配餐结果</h4>
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(latestResult.result).map(([key, value]) => (
                    <div
                      key={key}
                      className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-4 text-white"
                    >
                      <p className="text-sm text-slate-400">{key}</p>
                      <p className="text-2xl font-bold mt-1">{value}%</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-slate-800">误差说明</h3>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                以下误差项已保留，请按指引完成后续处理
              </p>
            </div>

            <div className="divide-y divide-slate-200">
              {latestResult?.errors.map((error) => (
                <div key={error.id} className="p-6">
                  <div
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() =>
                      setExpandedId(expandedId === error.id ? null : error.id)
                    }
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`p-2 rounded-lg ${
                          error.kept ? 'bg-amber-100' : 'bg-slate-100'
                        }`}
                      >
                        {error.kept ? (
                          <AlertCircle className="w-5 h-5 text-amber-600" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-800">
                          {error.description}
                        </h4>
                        <p className="text-sm text-slate-500 mt-1">
                          {error.reason}
                        </p>
                        {error.kept && (
                          <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded-full">
                            已保留 · 需处理
                          </span>
                        )}
                      </div>
                    </div>
                    {expandedId === error.id ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>

                  {expandedId === error.id && (
                    <div className="mt-6 ml-9 grid grid-cols-2 gap-6">
                      <div>
                        <h5 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                          缺少材料
                        </h5>
                        <ul className="space-y-2">
                          {error.missingMaterials.map((material, idx) => (
                            <li
                              key={idx}
                              className="flex items-center gap-2 text-sm text-slate-600"
                            >
                              <span className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                              {material}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                          下一步行动
                        </h5>
                        <div
                          className={`p-4 rounded-lg ${
                            error.nextStep === 'business'
                              ? 'bg-blue-50 border border-blue-200'
                              : 'bg-emerald-50 border border-emerald-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {React.createElement(getNextStepIcon(error.nextStep), {
                              className: `w-5 h-5 ${
                                error.nextStep === 'business'
                                  ? 'text-blue-600'
                                  : 'text-emerald-600'
                              }`,
                            })}
                            <span
                              className={`font-medium ${
                                error.nextStep === 'business'
                                  ? 'text-blue-700'
                                  : 'text-emerald-700'
                              }`}
                            >
                              联系 {getNextStepLabel(error.nextStep)}
                            </span>
                          </div>
                          <p
                            className={`text-sm mt-2 ${
                              error.nextStep === 'business'
                                ? 'text-blue-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {error.nextStep === 'business'
                              ? '请业务运营团队补充相关材料'
                              : '请吴老师进行教研复核和补充'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">答案状态分布</h3>
            <div className="h-48">
              <Pie data={pieData} options={{ plugins: { legend: { position: 'bottom' as const } } }} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">快速统计</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">参数版本数</span>
                <span className="font-semibold text-slate-800">
                  {parameterTables.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">学生总数</span>
                <span className="font-semibold text-slate-800">
                  {new Set(studentAnswers.map((a) => a.studentId)).size}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">答案总数</span>
                <span className="font-semibold text-slate-800">
                  {stats.total}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">待处理事项</span>
                <span className="font-semibold text-amber-600">
                  {stats.pending + stats.reviewing}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-white">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold">当前用户</h3>
            </div>
            <p className="text-lg font-medium">{currentUser}</p>
            <p className="text-sm text-slate-400 mt-1">教研负责人</p>
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Clock className="w-4 h-4" />
                <span>
                  最后登录: {new Date().toLocaleDateString('zh-CN')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
