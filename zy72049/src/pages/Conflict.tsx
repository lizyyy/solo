import { useParams, useNavigate } from 'react-router-dom';
import { getRecordById } from '../data/mockRecords';
import { useTrainingStore } from '../store/trainingStore';
import { ArrowLeft, CheckCircle, User, Monitor, FileText, AlertTriangle } from 'lucide-react';

const Conflict = () => {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();
  const { conflictResolved, resolveConflict } = useTrainingStore();

  const record = recordId ? getRecordById(recordId) : undefined;
  const conflictData = record?.conflictData;

  if (!record || !conflictData) {
    return (
      <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">未找到冲突数据</h2>
          <p className="text-zinc-400 mb-4">该记录没有待处理的冲突信息</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-sm transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <header className="border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-zinc-800 rounded-md transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold">冲突处理 - {record.title}</h1>
            <p className="text-xs text-zinc-400">
              学生练习记录与系统导入数据存在差异，请人工确认
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-purple-400" />
              <h2 className="font-semibold">学生报告</h2>
            </div>
            <p className="text-zinc-300 text-sm mb-4">{conflictData.studentClaim.description}</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">报告分数</span>
                <span className="font-mono text-lg font-bold text-purple-400">
                  {conflictData.studentClaim.reportedScore}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-900/50 rounded p-3 text-center">
                  <div className="text-xs text-zinc-500 mb-1">能源</div>
                  <div className="font-mono text-sm">{conflictData.studentClaim.reportedResources.energy}</div>
                </div>
                <div className="bg-zinc-900/50 rounded p-3 text-center">
                  <div className="text-xs text-zinc-500 mb-1">算力</div>
                  <div className="font-mono text-sm">{conflictData.studentClaim.reportedResources.compute}</div>
                </div>
                <div className="bg-zinc-900/50 rounded p-3 text-center">
                  <div className="text-xs text-zinc-500 mb-1">时间</div>
                  <div className="font-mono text-sm">{conflictData.studentClaim.reportedResources.time}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Monitor className="w-5 h-5 text-blue-400" />
              <h2 className="font-semibold">系统计算</h2>
            </div>
            <p className="text-zinc-300 text-sm mb-4">{conflictData.systemData.description}</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">计算分数</span>
                <span className="font-mono text-lg font-bold text-blue-400">
                  {conflictData.systemData.calculatedScore}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-900/50 rounded p-3 text-center">
                  <div className="text-xs text-zinc-500 mb-1">能源</div>
                  <div className="font-mono text-sm">{conflictData.systemData.calculatedResources.energy}</div>
                </div>
                <div className="bg-zinc-900/50 rounded p-3 text-center">
                  <div className="text-xs text-zinc-500 mb-1">算力</div>
                  <div className="font-mono text-sm">{conflictData.systemData.calculatedResources.compute}</div>
                </div>
                <div className="bg-zinc-900/50 rounded p-3 text-center">
                  <div className="text-xs text-zinc-500 mb-1">时间</div>
                  <div className="font-mono text-sm">{conflictData.systemData.calculatedResources.time}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            <h3 className="font-semibold text-orange-400">分数差异</h3>
          </div>
          <p className="text-zinc-300 text-sm">
            学生报告分数 <span className="font-mono text-purple-400">{conflictData.studentClaim.reportedScore}</span> 与
            系统计算分数 <span className="font-mono text-blue-400">{conflictData.systemData.calculatedScore}</span> 存在
            <span className="font-mono text-orange-400"> {conflictData.studentClaim.reportedScore - conflictData.systemData.calculatedScore} </span>
            分的差异。以下证据供参考，请勿自动裁决。
          </p>
        </div>

        <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-zinc-400" />
            <h2 className="font-semibold">证据列表</h2>
          </div>
          <div className="space-y-3">
            {conflictData.evidences.map((evidence, index) => (
              <div key={index} className="flex items-start gap-4 p-4 bg-zinc-900/50 rounded-md">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-zinc-700 text-xs font-medium shrink-0">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      evidence.source === 'student'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {evidence.source === 'student' ? '学生方' : '系统方'}
                    </span>
                    <span className="text-xs text-zinc-500">{evidence.timestamp}</span>
                  </div>
                  <p className="text-sm text-zinc-300">{evidence.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 p-6">
          <h2 className="font-semibold mb-4">处理建议</h2>
          <div className="space-y-3">
            {conflictData.suggestions.map((suggestion, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-md">
                <span className="text-blue-400 text-sm font-medium shrink-0">建议{index + 1}:</span>
                <p className="text-sm text-zinc-300">{suggestion}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-zinc-700">
          <button
            onClick={() => navigate(`/train/${recordId}`)}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-md text-sm transition-colors"
          >
            返回训练
          </button>
          <button
            onClick={() => {
              resolveConflict();
              navigate(`/report/${recordId}`);
            }}
            disabled={conflictResolved}
            className={`flex items-center gap-2 px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              conflictResolved
                ? 'bg-green-600/20 text-green-400 cursor-default'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            {conflictResolved ? '已确认' : '确认处理'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Conflict;
