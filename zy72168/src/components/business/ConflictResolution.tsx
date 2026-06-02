import { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, FileText, Database } from 'lucide-react';
import type { Feedback, ConflictDecision } from '@/types';
import { useAppStore } from '@/store';
import { formatDateTime } from '@/utils/export';

interface ConflictResolutionProps {
  feedback: Feedback;
  onClose: () => void;
}

export default function ConflictResolution({ feedback, onClose }: ConflictResolutionProps) {
  const [decision, setDecision] = useState<ConflictDecision | null>(null);
  const [note, setNote] = useState('');
  const resolveConflict = useAppStore((state) => state.resolveConflict);
  const loading = useAppStore((state) => state.loading);

  const handleSubmit = async () => {
    if (!decision) return;
    await resolveConflict(feedback.id, decision, note);
    onClose();
  };

  if (!feedback.conflictEvidence) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">数据冲突处理</h3>
              <p className="text-sm text-slate-500">同一点位同一时段存在不一致的描述，请人工判断</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="border-2 border-blue-200 rounded-lg p-5 bg-blue-50/50">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-blue-800">现场会议纪要</h4>
              </div>
              <div className="text-sm text-slate-600 mb-2">
                <span className="text-slate-400">记录人：</span>周姐
                <span className="mx-2">·</span>
                <span className="text-slate-400">时间：</span>
                {formatDateTime(feedback.reportTime)}
              </div>
              <div className="bg-white rounded-md p-4 border border-blue-200">
                <p className="text-slate-700 leading-relaxed">
                  {feedback.conflictEvidence.meetingContent}
                </p>
              </div>
            </div>

            <div className="border-2 border-purple-200 rounded-lg p-5 bg-purple-50/50">
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-5 h-5 text-purple-600" />
                <h4 className="font-semibold text-purple-800">系统导入数据</h4>
              </div>
              <div className="text-sm text-slate-600 mb-2">
                <span className="text-slate-400">来源：</span>市政数据导入
                <span className="mx-2">·</span>
                <span className="text-slate-400">时间：</span>
                {formatDateTime(feedback.reportTime)}
              </div>
              <div className="bg-white rounded-md p-4 border border-purple-200">
                <p className="text-slate-700 leading-relaxed">
                  {feedback.conflictEvidence.systemContent}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <h5 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              建议动作
            </h5>
            <ul className="space-y-2 text-sm text-amber-900">
              {feedback.conflictEvidence.suggestedActions.map((action, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-amber-600 font-bold">{index + 1}.</span>
                  {action}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h5 className="font-semibold text-slate-700">请选择处理方式：</h5>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setDecision('accept_meeting')}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  decision === 'accept_meeting'
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-sm">采信会议纪要</span>
                </div>
                <p className="text-xs text-slate-500">以现场人工记录为准</p>
              </button>
              <button
                onClick={() => setDecision('accept_system')}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  decision === 'accept_system'
                    ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                    : 'border-slate-200 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Database className="w-4 h-4 text-purple-600" />
                  <span className="font-medium text-sm">采信系统数据</span>
                </div>
                <p className="text-xs text-slate-500">以导入的官方数据为准</p>
              </button>
              <button
                onClick={() => setDecision('custom')}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  decision === 'custom'
                    ? 'border-slate-600 bg-slate-50 ring-2 ring-slate-200'
                    : 'border-slate-200 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-slate-600" />
                  <span className="font-medium text-sm">自定义处理</span>
                </div>
                <p className="text-xs text-slate-500">现场复核后手动录入</p>
              </button>
            </div>

            {decision === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  请输入处理说明：
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="请描述现场复核情况和最终处理结果..."
                />
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-slate-300 rounded-md text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!decision || (decision === 'custom' && !note.trim()) || loading}
            className="px-5 py-2 bg-blue-700 text-white rounded-md text-sm hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                确认处理
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Lightbulb(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>;
}
