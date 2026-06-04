import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Copy, 
  Check, 
  Clock, 
  User,
  Terminal,
  ListTodo,
  Play
} from 'lucide-react';
import { format } from 'date-fns';
import { useDiagnosisStore } from '../store/useDiagnosisStore';
import { CommandGenerator } from '../services/commandService';

export function Replay() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { getCurrentTask, getTaskLogs } = useDiagnosisStore();
  const [copied, setCopied] = useState(false);

  const task = getCurrentTask();
  const logs = taskId ? getTaskLogs(taskId) : [];

  const handleBack = () => {
    if (taskId) {
      navigate(`/diagnosis/${taskId}/report`);
    }
  };

  const handleCopyCommand = () => {
    if (task) {
      const script = CommandGenerator.generateFullScript(task);
      navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-industrial-900">流程复盘</h1>
          <p className="text-industrial-500 mt-1">
            {task?.title || '诊断任务'} - 操作记录与可重跑命令
          </p>
        </div>
        <button onClick={handleBack} className="btn-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          返回报告
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-industrial-100 p-2 rounded-lg">
              <ListTodo className="w-5 h-5 text-industrial-700" />
            </div>
            <div>
              <h2 className="font-semibold text-industrial-900">操作日志</h2>
              <p className="text-sm text-industrial-500">完整记录每一步操作</p>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin pr-2">
            {logs.map((log, index) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 bg-industrial-50 rounded-lg animate-slide-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="w-8 h-8 bg-industrial-200 rounded-full flex items-center justify-center text-xs font-semibold text-industrial-600">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-industrial-800">{log.action}</span>
                    <span className="text-xs text-industrial-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(log.timestamp), 'HH:mm:ss')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-industrial-500 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {log.operator}
                    </span>
                  </div>
                  {Object.keys(log.details).length > 0 && (
                    <div className="mt-2 text-xs text-industrial-600 bg-white p-2 rounded border border-industrial-100">
                      {JSON.stringify(log.details, null, 2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-gray-900 p-2 rounded-lg">
                <Terminal className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h2 className="font-semibold text-industrial-900">可重跑命令</h2>
                <p className="text-sm text-industrial-500">一键复制，重新执行</p>
              </div>
            </div>
            <button
              onClick={handleCopyCommand}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  复制脚本
                </>
              )}
            </button>
          </div>

          <div className="terminal-code">
            <pre className="whitespace-pre-wrap">
              {task ? CommandGenerator.generateFullScript(task) : '# 加载任务中...'}
            </pre>
          </div>

          <div className="mt-4 p-4 bg-industrial-50 rounded-lg">
            <h3 className="text-sm font-medium text-industrial-700 mb-2 flex items-center gap-2">
              <Play className="w-4 h-4" />
              使用说明
            </h3>
            <ul className="text-sm text-industrial-600 space-y-1">
              <li>1. 复制上面的完整脚本</li>
              <li>2. 在终端中粘贴执行</li>
              <li>3. 系统将自动复现完整诊断流程</li>
              <li>4. 包含：数据导入 → 照片补录 → 人工修正 → 重跑诊断</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-industrial-900 mb-4">三步标准作业流程回顾</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center font-semibold">
                1
              </div>
              <span className="font-medium text-emerald-800">传感器编号第一次导入</span>
            </div>
            <p className="text-sm text-emerald-700">
              上传传感器数据文件，系统自动检测温度单位混用但不自动修正，标注为"待老唐复核"状态
            </p>
          </div>
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center font-semibold">
                2
              </div>
              <span className="font-medium text-emerald-800">训练教练老唐补看工况照片</span>
            </div>
            <p className="text-sm text-emerald-700">
              老唐回看群里补传的工况照片，对照数据进行人工复核
            </p>
          </div>
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center font-semibold">
                3
              </div>
              <span className="font-medium text-emerald-800">交接报告更新</span>
            </div>
            <p className="text-sm text-emerald-700">
              根据复核结果更新交接报告，明确问题原因、缺失材料、下一步行动
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
