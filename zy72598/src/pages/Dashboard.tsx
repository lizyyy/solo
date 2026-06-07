import { useEffect } from 'react';
import { useExperimentStore } from '@/store/useExperimentStore';
import { StepProgress } from '@/components/Layout/StepProgress';
import { ExperimentCard } from '@/components/Experiment/ExperimentCard';
import { CurveChart } from '@/components/DataImport/CurveChart';
import { AlertTriangle, CheckCircle2, FileText, BarChart3 } from 'lucide-react';

export const Dashboard = () => {
  const {
    experiments,
    currentExperimentId,
    setCurrentExperiment,
    getCurrentTrainingLog,
    getCurrentParamNote,
    getCurrentSummaries,
    getCurrentConflicts,
    getCurrentExperiment,
  } = useExperimentStore();

  const currentLog = getCurrentTrainingLog();
  const currentNote = getCurrentParamNote();
  const currentSummaries = getCurrentSummaries();
  const currentConflicts = getCurrentConflicts();
  const currentExperiment = getCurrentExperiment();

  useEffect(() => {
    if (experiments.length > 0 && !currentExperimentId) {
      setCurrentExperiment(experiments[0].id);
    }
  }, [experiments, currentExperimentId, setCurrentExperiment]);

  const getCurrentStep = (): 1 | 2 | 3 => {
    if (!currentLog) return 1;
    if (!currentNote) return 2;
    return 3;
  };

  const isCompleted = currentExperiment?.status === 'completed';
  const pendingConflicts = currentConflicts.filter((c) => c.status === 'pending').length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1
          className="text-2xl font-bold text-gray-900 mb-2"
          style={{ fontFamily: "'Source Serif Pro', serif" }}
        >
          多目标排序权衡实验平台
        </h1>
        <p className="text-gray-500">导入训练日志 → 补看调参笔记 → 生成可解释摘要</p>
      </div>

      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm mb-8">
        <StepProgress currentStep={getCurrentStep()} completed={isCompleted} />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm text-gray-500">实验总数</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{experiments.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-sm text-gray-500">已完成</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {experiments.filter((e) => e.status === 'completed').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-sm text-gray-500">待处理冲突</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{pendingConflicts}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-sm text-gray-500">摘要版本</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{currentSummaries.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <h2
            className="text-lg font-semibold text-gray-900 mb-4"
            style={{ fontFamily: "'Source Serif Pro', serif" }}
          >
            实验列表
          </h2>
          <div className="space-y-3">
            {experiments.map((exp) => (
              <ExperimentCard
                key={exp.id}
                experiment={exp}
                isSelected={exp.id === currentExperimentId}
                onSelect={() => setCurrentExperiment(exp.id)}
              />
            ))}
          </div>
        </div>

        <div className="col-span-2 space-y-6">
          {currentExperiment && (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h2
                className="text-lg font-semibold text-gray-900 mb-4"
                style={{ fontFamily: "'Source Serif Pro', serif" }}
              >
                {currentExperiment.name}
              </h2>
              {currentLog && <CurveChart data={currentLog.curveData} title="训练曲线" />}
            </div>
          )}

          {currentSummaries.length > 0 && (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h2
                className="text-lg font-semibold text-gray-900 mb-3"
                style={{ fontFamily: "'Source Serif Pro', serif" }}
              >
                最新摘要
              </h2>
              <p className="text-gray-700 leading-relaxed">
                {currentSummaries[currentSummaries.length - 1].content}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
