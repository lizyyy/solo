import { useWorkflow } from '../../hooks/useWorkflow';
import { useAppContext } from '../../store/AppContext';
import { CheckCircle2, ChevronRight, Play, FileText, UserCheck, Presentation } from 'lucide-react';
import type { Stakeholder } from '../../types';

const stageIcons = {
  initial_import: FileText,
  alan_review: UserCheck,
  classroom_demo: Presentation,
};

export function WorkflowProgress() {
  const {
    workflowStages,
    currentStage,
    advanceStage,
    setStage,
    runComparison,
    autoGenerateClassroomNotes,
    getStageProgress,
  } = useWorkflow();
  const { state, dispatch } = useAppContext();

  const currentStageIndex = workflowStages.findIndex(s => s.id === currentStage);
  const currentStageData = workflowStages[currentStageIndex];
  const progressWidth =
    currentStageIndex === 0
      ? '0%'
      : currentStageIndex === 1
      ? 'calc(50% - 2rem)'
      : 'calc(100% - 4rem)';

  const handleNextStep = () => {
    if (currentStage === 'initial_import') {
      runComparison();
    } else if (currentStage === 'alan_review') {
      autoGenerateClassroomNotes();
    }
    advanceStage();
  };

  const canAdvance = () => {
    switch (currentStage) {
      case 'initial_import':
        return state.parameterRecords.length > 0;
      case 'alan_review':
        return state.comparisonResults.length > 0;
      case 'classroom_demo':
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-rose-500 to-pink-600">
        <h2 className="text-xl font-bold text-white">三步工作流</h2>
        <p className="text-rose-100 text-sm mt-1">
          按步骤完成图最短路绕行比较的完整流程
        </p>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-600">当前步骤进度</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              切换身份：
            </span>
            <select
              value={state.currentUser}
              onChange={e =>
                dispatch({
                  type: 'SET_CURRENT_USER',
                  payload: e.target.value as Stakeholder,
                })
              }
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="alan">运营规划阿岚</option>
              <option value="data_reviewer">数据复核人</option>
              <option value="system">系统管理员</option>
            </select>
          </div>
        </div>

        <div className="relative">
          <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 -z-10" style={{ marginLeft: '2rem', marginRight: '2rem' }} />
          <div
            className="absolute top-5 left-0 h-1 bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-500 -z-10"
            style={{
              marginLeft: '2rem',
              width: progressWidth,
            }}
          />

          <div className="flex items-start justify-between">
            {workflowStages.map((stage, idx) => {
              const Icon = stageIcons[stage.id];
              const isActive = currentStage === stage.id;
              const isCompleted = currentStageIndex > idx;
              const progress = getStageProgress(stage.id);

              return (
                <div
                  key={stage.id}
                  className="flex flex-col items-center relative z-10"
                  style={{ flexBasis: '33%' }}
                >
                  <button
                    onClick={() => setStage(stage.id)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isCompleted
                        ? 'bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-lg'
                        : isActive
                        ? 'bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-lg ring-4 ring-rose-100'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </button>

                  <div className="mt-3 text-center">
                    <h3
                      className={`text-sm font-semibold ${
                        isActive
                          ? 'text-rose-700'
                          : isCompleted
                          ? 'text-gray-800'
                          : 'text-gray-500'
                      }`}
                    >
                      {stage.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-[180px]">
                      {stage.description}
                    </p>
                  </div>

                  {isActive && (
                    <div className="mt-3 w-full max-w-[180px]">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-rose-600 mt-1 text-center">
                        {progress}% 完成
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-800">
                第 {currentStageIndex + 1} / {workflowStages.length} 步
              </span>
              <span className="mx-2 text-gray-400">·</span>
              当前：{currentStageData?.name}
              </p>
            </div>

            {currentStage !== 'classroom_demo' && (
              <button
                onClick={handleNextStep}
                disabled={!canAdvance()}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                  canAdvance()
                    ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:from-rose-600 hover:to-pink-700 shadow-lg hover:shadow-xl'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Play className="w-4 h-4" />
                执行并进入下一步
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 p-4 bg-gray-50 rounded-xl">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            当前步骤说明
          </h4>
          {currentStage === 'initial_import' && (
            <div className="text-sm text-gray-600 space-y-1">
              <p>• 系统已自动导入 10 条参数记录</p>
              <p>• 其中 2 条分母为 0，已标记为异常，显示为空字符串</p>
              <p>• 重复导入同一批数据不会重复计数</p>
              <p>• 点击"执行并进入下一步"将自动运行绕行比较</p>
            </div>
          )}
          {currentStage === 'alan_review' && (
            <div className="text-sm text-gray-600 space-y-1">
              <p>• 运营规划阿岚需要检查分母为 0 的记录</p>
              <p>• 补充手算反例，说明为什么分母为 0</p>
              <p>• 可以修改备注和分母值</p>
              <p>• 点击"执行并进入下一步"将自动生成课堂演示说明</p>
            </div>
          )}
          {currentStage === 'classroom_demo' && (
            <div className="text-sm text-gray-600 space-y-1">
              <p>• 所有比较结果已生成可解释的报告</p>
              <p>• 每条记录说明为什么被留下、缺什么材料、下一步找谁</p>
              <p>• 专业计算旁显示参数版本和取舍理由</p>
              <p>• 可以切换可视化方式展示结果</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
