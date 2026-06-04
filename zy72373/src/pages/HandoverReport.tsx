import { useParams, useNavigate } from 'react-router-dom';
import { 
  FileText, 
  CheckCircle, 
  User, 
  Clock,
  ArrowLeft,
  List,
  MessageSquare,
  History
} from 'lucide-react';
import { format } from 'date-fns';
import { useDiagnosisStore } from '../store/useDiagnosisStore';
import { StepProgress } from '../components/StepProgress';
import { formatNextAction } from '../services/reportService';
import type { StepInfo } from '../types';

export function HandoverReport() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { getCurrentTask, setCurrentTask } = useDiagnosisStore();

  const task = getCurrentTask();
  const report = task?.report;

  const steps: StepInfo[] = [
    { step: 1, title: '数据导入', description: '导入传感器数据', status: 'completed' },
    { step: 2, title: '照片补录', description: '补录工况照片', status: 'completed' },
    { step: 3, title: '生成报告', description: '生成交接报告', status: 'completed' },
  ];

  const handleBack = () => {
    if (taskId) {
      navigate(`/diagnosis/${taskId}/review`);
    }
  };

  const handleReplay = () => {
    if (taskId) {
      setCurrentTask(taskId);
      navigate(`/diagnosis/${taskId}/replay`);
    }
  };

  if (!report) {
    return (
      <div className="space-y-8">
        <div className="card">
          <StepProgress steps={steps} />
        </div>
        <div className="card text-center py-12">
          <FileText className="w-16 h-16 mx-auto mb-4 text-industrial-300" />
          <p className="text-industrial-500">报告尚未生成</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="card">
        <StepProgress steps={steps} />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-industrial-100 p-2 rounded-lg">
              <FileText className="w-6 h-6 text-industrial-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-industrial-900">交接报告</h2>
              <p className="text-sm text-industrial-500">
                版本 v{report.version} · 更新于 {format(new Date(report.updatedAt), 'yyyy-MM-dd HH:mm')}
              </p>
            </div>
          </div>
          <button
            onClick={handleReplay}
            className="btn-secondary flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            流程复盘
          </button>
        </div>

        <div className="space-y-6">
          <div className="border-l-4 border-alert-orange bg-orange-50 p-4 rounded-r-lg">
            <div className="flex items-start gap-3">
              <MessageSquare className="w-5 h-5 text-alert-orange mt-0.5" />
              <div>
                <h3 className="font-semibold text-industrial-900 mb-2">
                  为什么留下这条？
                </h3>
                <p className="text-industrial-700 leading-relaxed">
                  {report.problemStatement}
                </p>
              </div>
            </div>
          </div>

          <div className="border border-industrial-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <List className="w-5 h-5 text-industrial-500 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-industrial-900 mb-3">
                  还缺什么材料？
                </h3>
                {report.missingMaterials.length > 0 ? (
                  <ul className="space-y-2">
                    {report.missingMaterials.map((material, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-warning-400 rounded-full" />
                        <span className="text-industrial-700">{material}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-industrial-500">材料齐全</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-industrial-50 border border-industrial-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-industrial-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-industrial-900 mb-2">
                  下一步该找谁？
                </h3>
                <div className="flex items-center gap-4">
                  <div className="bg-white px-4 py-2 rounded-lg border border-industrial-200">
                    <span className="text-sm text-industrial-500">对接人：</span>
                    <span className="font-medium text-industrial-900 ml-1">
                      {report.nextHandler}
                    </span>
                  </div>
                  <div className="bg-alert-orange/10 px-4 py-2 rounded-lg">
                    <span className="text-sm text-alert-orange">
                      {formatNextAction(report.nextAction)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-industrial-100 pt-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-industrial-500">
                <Clock className="w-4 h-4" />
                <span>生成时间：{format(new Date(report.generatedAt), 'yyyy-MM-dd HH:mm')}</span>
              </div>
              <div className="flex items-center gap-2 text-industrial-500">
                <History className="w-4 h-4" />
                <span>版本历史：{report.versionHistory.length} 次更新</span>
              </div>
            </div>
          </div>

          {report.versionHistory.length > 1 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-industrial-700 mb-3 flex items-center gap-2">
                <History className="w-4 h-4" />
                版本历史
              </h4>
              <div className="space-y-2">
                {report.versionHistory.slice().reverse().map((version) => (
                  <div
                    key={version.version}
                    className="flex items-start gap-3 p-3 bg-industrial-50 rounded-lg"
                  >
                    <span className="bg-industrial-200 text-industrial-700 px-2 py-0.5 rounded text-xs font-mono">
                      v{version.version}
                    </span>
                    <div className="flex-1">
                      <p className="text-xs text-industrial-500 mb-1">
                        {format(new Date(version.updatedAt), 'yyyy-MM-dd HH:mm')}
                      </p>
                      <ul className="text-sm text-industrial-700 space-y-1">
                        {version.changes.map((change, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                            {change}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-6 mt-6 border-t border-industrial-100">
          <button onClick={handleBack} className="btn-secondary flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回复核
          </button>
          <div className="text-right">
            <p className="text-sm text-industrial-500">报告签发</p>
            <p className="font-medium text-industrial-900">训练教练老唐</p>
          </div>
        </div>
      </div>
    </div>
  );
}
