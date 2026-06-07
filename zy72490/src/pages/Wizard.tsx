import { Check, ArrowRight, Upload, FileSearch, Table2, RotateCcw, Lightbulb } from 'lucide-react';
import { useScheduleStore } from '../store/useScheduleStore';
import { samplingPoints, complaintRecords } from '../data/mockData';

const steps = [
  {
    step: 1,
    title: '夜间采样点第一次导入',
    description: '系统导入夜间采样点基础数据，生成初始排程记录',
    icon: Upload,
    color: 'primary',
  },
  {
    step: 2,
    title: '街道规划员补看居民投诉编号',
    description: '居民投诉编号到位后，姜规划员匹配投诉信息到对应采样点',
    icon: FileSearch,
    color: 'supplement',
  },
  {
    step: 3,
    title: '冲突复核表更新',
    description: '系统自动检测口径冲突，生成冲突复核表，分类标记处理结果',
    icon: Table2,
    color: 'warning',
  },
];

export function Wizard() {
  const { wizardState, advanceWizardStep, resetWizard, resetToDemoData, records } =
    useScheduleStore();

  const currentStep = Math.min(wizardState.currentStep, 3);
  const isComplete = wizardState.currentStep > 3;

  const handleNext = () => {
    if (!isComplete) {
      advanceWizardStep();
    }
  };

  const handleReset = () => {
    resetWizard();
    resetToDemoData();
  };

  const getStepStatus = (stepNum: number) => {
    if (isComplete || wizardState.currentStep > stepNum) return 'done';
    if (wizardState.currentStep === stepNum) return 'current';
    return 'pending';
  };

  const getDemoPointsForStep = () => {
    if (currentStep === 1) return samplingPoints.slice(0, 3);
    if (currentStep === 2) return samplingPoints.slice(0, 4);
    return samplingPoints;
  };

  const getDemoComplaintsForStep = () => {
    if (currentStep <= 1) return [];
    if (currentStep === 2) return complaintRecords.slice(0, 3);
    return complaintRecords;
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold text-gray-900 mb-2">流程向导</h1>
            <p className="text-gray-500">
              模拟标准工作流程：导入采样点 → 匹配投诉编号 → 生成冲突复核表
            </p>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            重置流程
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, index) => {
            const status = getStepStatus(s.step);
            const Icon = s.icon;
            const isLast = index === steps.length - 1;

            return (
              <div key={s.step} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 ${
                      status === 'done'
                        ? 'bg-success-600 text-white shadow-lg shadow-success-200'
                        : status === 'current'
                        ? `bg-${s.color}-600 text-white shadow-lg shadow-${s.color}-200 animate-pulse`
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {status === 'done' ? (
                      <Check className="w-7 h-7" />
                    ) : (
                      <Icon className="w-7 h-7" />
                    )}
                  </div>
                  <p
                    className={`mt-3 text-sm font-medium ${
                      status === 'done' || status === 'current'
                        ? 'text-gray-900'
                        : 'text-gray-400'
                    }`}
                  >
                    步骤 {s.step}
                  </p>
                </div>
                {!isLast && (
                  <div className="flex-1 mx-4">
                    <div
                      className={`h-1 rounded-full transition-all duration-500 ${
                        status === 'done' ? 'bg-success-500' : 'bg-gray-200'
                      }`}
                    ></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-center mb-8">
          {isComplete ? (
            <div className="p-6 bg-success-50 rounded-2xl border border-success-200">
              <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-success-600" />
              </div>
              <h2 className="text-xl font-semibold text-success-800 mb-2">流程演示完成！</h2>
              <p className="text-success-700">
                您已走完标准三步工作流。可以查看排程总览、冲突复核表或历史记录了解详情。
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {steps[currentStep - 1].title}
              </h2>
              <p className="text-gray-500">{steps[currentStep - 1].description}</p>
            </>
          )}
        </div>

        {!isComplete && currentStep === 1 && (
          <div className="bg-gray-50 rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">正在导入的采样点：</h3>
            <div className="grid grid-cols-3 gap-3">
              {getDemoPointsForStep().map((p) => (
                <div
                  key={p.id}
                  className="bg-white p-3 rounded-lg border border-gray-200 hover:border-primary-300 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{p.location}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full">
                      夜间采样
                    </span>
                    <span className="text-xs text-gray-400">{p.importTime}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isComplete && currentStep === 2 && (
          <div className="bg-supplement-50 rounded-xl p-5 mb-6 border border-supplement-100">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-supplement-100 rounded-lg">
                <Lightbulb className="w-5 h-5 text-supplement-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-supplement-800">
                  姜规划员正在补看居民投诉编号
                </h3>
                <p className="text-sm text-supplement-700 mt-1">
                  投诉编号滞后是常见情况，需要手动匹配到对应采样点。注意区分：正常口径、汇总无原文、旧口径。
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {getDemoComplaintsForStep().map((c) => (
                <div
                  key={c.complaintNo}
                  className={`p-3 rounded-lg border ${
                    c.summaryOnly
                      ? 'bg-warning-50 border-warning-200'
                      : c.oldCaliber
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-medium text-gray-600">
                      {c.complaintNo}
                    </span>
                    <div className="flex items-center gap-2">
                      {c.summaryOnly && (
                        <span className="text-xs px-2 py-0.5 bg-warning-200 text-warning-800 rounded-full">
                          仅汇总
                        </span>
                      )}
                      {c.oldCaliber && (
                        <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full">
                          旧口径
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700">{c.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isComplete && currentStep === 3 && (
          <div className="bg-warning-50 rounded-xl p-5 mb-6 border border-warning-100">
            <h3 className="text-sm font-semibold text-warning-800 mb-3">
              冲突复核表已生成，自动检测到以下分类：
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg border border-success-200">
                <p className="text-2xl font-bold text-success-600">2</p>
                <p className="text-sm text-gray-600 mt-1">正常记录</p>
                <p className="text-xs text-gray-400 mt-1">口径一致，处理顺畅</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-warning-200">
                <p className="text-2xl font-bold text-warning-600">2</p>
                <p className="text-sm text-gray-600 mt-1">待社区书记复核</p>
                <p className="text-xs text-gray-400 mt-1">意见只剩汇总无原文</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-supplement-200">
                <p className="text-2xl font-bold text-supplement-600">2</p>
                <p className="text-sm text-gray-600 mt-1">补录旧口径</p>
                <p className="text-xs text-gray-400 mt-1">从投诉编号补录，需人工修正+重跑</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-center">
          <button
            onClick={handleNext}
            disabled={isComplete}
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-medium transition-all duration-300 ${
              isComplete
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-200 hover:shadow-xl hover:shadow-primary-300 hover:-translate-y-0.5'
            }`}
          >
            {isComplete ? (
              '流程已完成'
            ) : currentStep === 3 ? (
              <>
                完成流程
                <Check className="w-5 h-5" />
              </>
            ) : (
              <>
                下一步
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>

      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4">三种典型处理结果说明</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="w-10 h-10 bg-success-100 rounded-lg flex items-center justify-center mb-3">
              <Check className="w-5 h-5 text-success-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">顺利记录</h4>
            <p className="text-sm text-gray-500">
              投诉编号与采样点口径一致，无需额外处理，直接标记为正常。
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="w-10 h-10 bg-warning-100 rounded-lg flex items-center justify-center mb-3">
              <Lightbulb className="w-5 h-5 text-warning-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">待复核记录</h4>
            <p className="text-sm text-gray-500">
              居民意见只剩汇总没有原文，别急着归正常，留给社区书记复核决定。
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="w-10 h-10 bg-supplement-100 rounded-lg flex items-center justify-center mb-3">
              <RotateCcw className="w-5 h-5 text-supplement-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">补录记录</h4>
            <p className="text-sm text-gray-500">
              后来从居民投诉编号补来旧口径，需要人工修正并重跑排程，全过程留痕。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
