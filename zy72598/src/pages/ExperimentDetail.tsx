import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useExperimentStore } from '@/store/useExperimentStore';
import { StepProgress } from '@/components/Layout/StepProgress';
import { CurveChart } from '@/components/DataImport/CurveChart';
import { NoteEditor } from '@/components/DataImport/NoteEditor';
import { ArrowLeft, FileUp, Edit3, FileText, Check, AlertTriangle } from 'lucide-react';

export const ExperimentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    experiments,
    setCurrentExperiment,
    getCurrentTrainingLog,
    getCurrentParamNote,
    getCurrentSummaries,
    getCurrentConflicts,
    getCurrentExperiment,
  } = useExperimentStore();

  useEffect(() => {
    if (id) {
      setCurrentExperiment(id);
    }
  }, [id, setCurrentExperiment]);

  const experiment = getCurrentExperiment();
  const log = getCurrentTrainingLog();
  const note = getCurrentParamNote();
  const summaries = getCurrentSummaries();
  const conflicts = getCurrentConflicts();

  const getCurrentStep = (): 1 | 2 | 3 => {
    if (!log) return 1;
    if (!note) return 2;
    return 3;
  };

  const isCompleted = experiment?.status === 'completed';
  const pendingConflicts = conflicts.filter((c) => c.status === 'pending').length;

  if (!experiment) {
    return (
      <div className="p-8">
        <div className="text-center py-20">
          <p className="text-gray-500">实验不存在</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            返回工作台
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        返回工作台
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900 mb-1"
            style={{ fontFamily: "'Source Serif Pro', serif" }}
          >
            {experiment.name}
          </h1>
          <p className="text-gray-500">ID: {experiment.id}</p>
        </div>
        {pendingConflicts > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-700 font-medium">
              {pendingConflicts} 个冲突待处理
            </span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm mb-8">
        <StepProgress currentStep={getCurrentStep()} completed={isCompleted} />
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-5 border border-gray-200 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${log ? 'bg-green-100' : 'bg-gray-100'}`}>
              {log ? <Check className="w-6 h-6 text-green-600" /> : <FileUp className="w-6 h-6 text-gray-400" />}
            </div>
            <div>
              <p className="font-medium text-gray-900">训练日志</p>
              <p className="text-sm text-gray-500">{log ? '已导入' : '待导入'}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${note ? 'bg-green-100' : 'bg-gray-100'}`}>
              {note ? <Check className="w-6 h-6 text-green-600" /> : <Edit3 className="w-6 h-6 text-gray-400" />}
            </div>
            <div>
              <p className="font-medium text-gray-900">调参笔记</p>
              <p className="text-sm text-gray-500">{note ? '已录入' : '待录入'}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${summaries.length > 0 ? 'bg-green-100' : 'bg-gray-100'}`}>
              {summaries.length > 0 ? <Check className="w-6 h-6 text-green-600" /> : <FileText className="w-6 h-6 text-gray-400" />}
            </div>
            <div>
              <p className="font-medium text-gray-900">可解释摘要</p>
              <p className="text-sm text-gray-500">{summaries.length > 0 ? `${summaries.length} 个版本` : '待生成'}</p>
            </div>
          </div>
        </div>

        {log && (
          <div>
            <h2
              className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"
              style={{ fontFamily: "'Source Serif Pro', serif" }}
            >
              <FileUp className="w-5 h-5 text-blue-500" />
              训练日志曲线
            </h2>
            <CurveChart data={log.curveData} />

            <div className="mt-4 bg-white rounded-xl p-5 border border-gray-200">
              <h3 className="font-medium text-gray-900 mb-3">特征清单</h3>
              <div className="grid grid-cols-2 gap-3">
                {log.features.map((feature, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      feature.present
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{feature.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          feature.present
                            ? 'bg-green-200 text-green-800'
                            : 'bg-red-200 text-red-800'
                        }`}
                      >
                        {feature.present ? '正常' : `缺失(默认值: ${feature.defaultValue})`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {log.hasDefaultScores && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    ⚠️ 检测到线上特征缺失使用了默认分，请推荐负责人复核
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <h2
            className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"
            style={{ fontFamily: "'Source Serif Pro', serif" }}
          >
            <Edit3 className="w-5 h-5 text-amber-500" />
            阈值调参笔记
          </h2>
          <NoteEditor existingNote={note || null} experimentId={experiment.id} />
        </div>

        {summaries.length > 0 && (
          <div>
            <h2
              className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"
              style={{ fontFamily: "'Source Serif Pro', serif" }}
            >
              <FileText className="w-5 h-5 text-blue-500" />
              最新可解释摘要
            </h2>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">
                  版本 v{summaries[summaries.length - 1].version}
                </span>
              </div>
              <p className="text-gray-700 leading-relaxed">
                {summaries[summaries.length - 1].content}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
