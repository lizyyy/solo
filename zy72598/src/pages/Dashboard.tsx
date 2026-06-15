import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExperimentStore } from '@/store/useExperimentStore';
import { StepProgress } from '@/components/Layout/StepProgress';
import { ExperimentCard } from '@/components/Experiment/ExperimentCard';
import { CurveChart } from '@/components/DataImport/CurveChart';
import { AlertTriangle, CheckCircle2, FileText, BarChart3, Plus, X } from 'lucide-react';

export const Dashboard = () => {
  const navigate = useNavigate();
  const experiments = useExperimentStore((s) => s.experiments);
  const currentExperimentId = useExperimentStore((s) => s.currentExperimentId);
  const trainingLogs = useExperimentStore((s) => s.trainingLogs);
  const paramNotes = useExperimentStore((s) => s.paramNotes);
  const summariesMap = useExperimentStore((s) => s.summaries);
  const conflictsMap = useExperimentStore((s) => s.conflicts);
  const setCurrentExperiment = useExperimentStore((s) => s.setCurrentExperiment);
  const createExperiment = useExperimentStore((s) => s.createExperiment);

  const currentLog = currentExperimentId ? trainingLogs[currentExperimentId] || null : null;
  const currentNote = currentExperimentId ? paramNotes[currentExperimentId] || null : null;
  const currentSummaries = currentExperimentId ? summariesMap[currentExperimentId] || [] : [];
  const currentConflicts = currentExperimentId ? conflictsMap[currentExperimentId] || [] : [];
  const currentExperiment = experiments.find((e) => e.id === currentExperimentId) || null;

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newExperimentName, setNewExperimentName] = useState('');

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

  const handleCreateExperiment = () => {
    if (!newExperimentName.trim()) return;
    const newId = createExperiment(newExperimentName.trim());
    setNewExperimentName('');
    setShowNewDialog(false);
    navigate(`/experiment/${newId}`);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900 mb-2"
            style={{ fontFamily: "'Source Serif Pro', serif" }}
          >
            多目标排序权衡实验平台
          </h1>
          <p className="text-gray-500">导入训练日志 → 补看调参笔记 → 生成可解释摘要</p>
        </div>
        <button
          onClick={() => setShowNewDialog(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建空实验
        </button>
      </div>

      {showNewDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-lg font-semibold text-gray-900"
                style={{ fontFamily: "'Source Serif Pro', serif" }}
              >
                新建空实验
              </h3>
              <button
                onClick={() => setShowNewDialog(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              创建一个空白实验，从导入训练日志曲线开始走完三步流程。
            </p>
            <input
              type="text"
              value={newExperimentName}
              onChange={(e) => setNewExperimentName(e.target.value)}
              placeholder="请输入实验名称"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateExperiment();
              }}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowNewDialog(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleCreateExperiment}
                disabled={!newExperimentName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                创建并进入
              </button>
            </div>
          </div>
        </div>
      )}

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
          {currentExperiment && currentLog && (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h2
                className="text-lg font-semibold text-gray-900 mb-4"
                style={{ fontFamily: "'Source Serif Pro', serif" }}
              >
                {currentExperiment.name}
              </h2>
              <CurveChart data={currentLog.curveData} title="训练曲线" />
            </div>
          )}

          {currentExperiment && !currentLog && (
            <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
              <h2
                className="text-lg font-semibold text-gray-900 mb-3"
                style={{ fontFamily: "'Source Serif Pro', serif" }}
              >
                {currentExperiment.name}
              </h2>
              <p className="text-gray-500 mb-4">该实验尚未导入训练日志，请进入详情页开始操作</p>
              <button
                onClick={() => navigate(`/experiment/${currentExperiment.id}`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                进入实验 →
              </button>
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
