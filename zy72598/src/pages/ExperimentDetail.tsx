import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useExperimentStore } from '@/store/useExperimentStore';
import { StepProgress } from '@/components/Layout/StepProgress';
import { CurveChart } from '@/components/DataImport/CurveChart';
import { LogImporter } from '@/components/DataImport/LogImporter';
import { NoteEditor } from '@/components/DataImport/NoteEditor';
import { ArrowLeft, FileUp, Edit3, FileText, Check, AlertTriangle, Download, Eye } from 'lucide-react';
import { generateExportReport, downloadExportReport } from '@/utils/exporter';

export const ExperimentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const experiments = useExperimentStore((s) => s.experiments);
  const trainingLogs = useExperimentStore((s) => s.trainingLogs);
  const paramNotes = useExperimentStore((s) => s.paramNotes);
  const summariesMap = useExperimentStore((s) => s.summaries);
  const conflictsMap = useExperimentStore((s) => s.conflicts);
  const setCurrentExperiment = useExperimentStore((s) => s.setCurrentExperiment);
  const addHistoryRecord = useExperimentStore((s) => s.addHistoryRecord);

  const [showExportPreview, setShowExportPreview] = useState(false);

  useEffect(() => {
    if (id) {
      setCurrentExperiment(id);
    }
  }, [id, setCurrentExperiment]);

  const experiment = experiments.find((e) => e.id === id) || null;
  const log = id ? trainingLogs[id] || null : null;
  const note = id ? paramNotes[id] || null : null;
  const summaries = id ? summariesMap[id] || [] : [];
  const conflicts = id ? conflictsMap[id] || [] : [];

  const getCurrentStep = (): 1 | 2 | 3 => {
    if (!log) return 1;
    if (!note) return 2;
    return 3;
  };

  const currentStep = getCurrentStep();
  const isCompleted = experiment?.status === 'completed';
  const pendingConflicts = conflicts.filter((c) => c.status === 'pending').length;

  const handleExport = () => {
    if (!experiment || !id) return;
    const report = generateExportReport(
      experiment,
      log,
      note,
      summaries,
      conflicts,
      null
    );
    const filename = `导出一致性报告_${experiment.name}_${new Date().toISOString().slice(0, 10)}.json`;
    downloadExportReport(report, filename);
    addHistoryRecord(id, '导出一致性报告', '阿越', { filename });
  };

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
        <StepProgress currentStep={currentStep} completed={isCompleted} />
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-3 gap-4">
          <div className={`rounded-xl p-5 border-2 transition-colors ${currentStep >= 1 ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${log ? 'bg-green-100' : currentStep === 1 ? 'bg-blue-100' : 'bg-gray-100'}`}>
                {log ? <Check className="w-6 h-6 text-green-600" /> : <FileUp className="w-6 h-6 text-blue-500" />}
              </div>
              <div>
                <p className="font-medium text-gray-900">第一步：导入训练日志</p>
                <p className="text-sm text-gray-500">{log ? `已导入 · ${log.features.length} 个特征` : '待导入'}</p>
              </div>
            </div>
          </div>
          <div className={`rounded-xl p-5 border-2 transition-colors ${currentStep >= 2 ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${note ? 'bg-green-100' : currentStep === 2 ? 'bg-amber-100' : 'bg-gray-100'}`}>
                {note ? <Check className="w-6 h-6 text-green-600" /> : <Edit3 className="w-6 h-6 text-amber-500" />}
              </div>
              <div>
                <p className="font-medium text-gray-900">第二步：补看调参笔记</p>
                <p className="text-sm text-gray-500">{note ? `已录入 · ${note.thresholds.length} 个阈值` : log ? '待录入' : '请先导入日志'}</p>
              </div>
            </div>
          </div>
          <div className={`rounded-xl p-5 border-2 transition-colors ${currentStep >= 3 ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${summaries.length > 0 ? 'bg-green-100' : currentStep === 3 ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                {summaries.length > 0 ? <Check className="w-6 h-6 text-green-600" /> : <FileText className="w-6 h-6 text-indigo-500" />}
              </div>
              <div>
                <p className="font-medium text-gray-900">第三步：可解释摘要</p>
                <p className="text-sm text-gray-500">{summaries.length > 0 ? `${summaries.length} 个版本` : '待生成'}</p>
              </div>
            </div>
          </div>
        </div>

        {!log && (
          <div>
            <h2
              className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"
              style={{ fontFamily: "'Source Serif Pro', serif" }}
            >
              <FileUp className="w-5 h-5 text-blue-500" />
              第一步：导入训练日志曲线
            </h2>
            <LogImporter experimentId={experiment.id} />
          </div>
        )}

        {log && (
          <div>
            <h2
              className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"
              style={{ fontFamily: "'Source Serif Pro', serif" }}
            >
              <FileUp className="w-5 h-5 text-green-500" />
              训练日志曲线
              <span className="text-sm font-normal text-gray-500 ml-2">已导入</span>
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

        {log && !note && (
          <div>
            <h2
              className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"
              style={{ fontFamily: "'Source Serif Pro', serif" }}
            >
              <Edit3 className="w-5 h-5 text-amber-500" />
              第二步：补看阈值调参笔记
            </h2>
            <NoteEditor existingNote={null} experimentId={experiment.id} />
          </div>
        )}

        {note && (
          <div>
            <h2
              className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"
              style={{ fontFamily: "'Source Serif Pro', serif" }}
            >
              <Edit3 className="w-5 h-5 text-green-500" />
              阈值调参笔记
              <span className="text-sm font-normal text-gray-500 ml-2">已录入</span>
            </h2>
            <NoteEditor existingNote={note} experimentId={experiment.id} />
          </div>
        )}

        {pendingConflicts > 0 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <h3 className="font-semibold text-red-900" style={{ fontFamily: "'Source Serif Pro', serif" }}>
                检测到 {pendingConflicts} 个冲突
              </h3>
            </div>
            <p className="text-sm text-red-700 mb-3">
              训练日志曲线与阈值调参笔记存在不一致，请前往冲突中心确认或驳回，不要自动拍板。
            </p>
            <button
              onClick={() => navigate('/conflicts')}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              前往冲突中心 →
            </button>
          </div>
        )}

        {summaries.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-lg font-semibold text-gray-900 flex items-center gap-2"
                style={{ fontFamily: "'Source Serif Pro', serif" }}
              >
                <FileText className="w-5 h-5 text-blue-500" />
                可解释摘要
                <span className="text-sm font-normal text-gray-500">
                  {summaries.length} 个版本
                </span>
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowExportPreview(!showExportPreview)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    showExportPreview ? 'bg-gray-200 text-gray-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  {showExportPreview ? '收起预览' : '预览报告'}
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  下载导出报告
                </button>
              </div>
            </div>

            {showExportPreview && (
              <div className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">导出一致性报告预览</h3>
                  <span className="text-xs text-gray-500">JSON 格式</span>
                </div>
                <pre className="p-4 text-xs text-gray-700 overflow-auto max-h-96">
                  {generateExportReport(experiment, log, note, summaries, conflicts, null)}
                </pre>
              </div>
            )}

            <div className="space-y-4">
              {[...summaries].reverse().map((summary, index) => (
                <div
                  key={summary.id}
                  className={`bg-white rounded-xl p-6 border-2 ${
                    index === 0 ? 'border-blue-500 shadow-md' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-600">
                      版本 v{summary.version}
                    </span>
                    {index === 0 && (
                      <span className="px-2 py-0.5 bg-blue-500 text-white rounded text-xs font-medium">
                        最新
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700 leading-relaxed">{summary.content}</p>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-2">关键指标</p>
                    <div className="grid grid-cols-4 gap-2">
                      {Object.entries(summary.metrics).slice(0, 4).map(([key, value]) => (
                        <div key={key} className="bg-gray-50 rounded p-2">
                          <p className="text-xs text-gray-500">{key}</p>
                          <p className="text-sm font-bold text-gray-900">{(value as number).toFixed(4)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
