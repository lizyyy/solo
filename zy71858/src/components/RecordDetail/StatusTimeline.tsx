import { StatusHistory } from '@/types';
import { statusLabels, statusColorsBg } from '@/utils/statusUtils';
import { formatDate } from '@/utils/statusUtils';
import { User, MessageSquare } from 'lucide-react';

interface StatusTimelineProps {
  histories: StatusHistory[];
}

export function StatusTimeline({ histories }: StatusTimelineProps) {
  if (histories.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">状态历史</h3>
        <div className="text-center py-8 text-slate-400">
          <p>暂无状态变更记录</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-6">状态历史</h3>

      <div className="relative">
        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-200" />

        <div className="space-y-6">
          {histories.map((history, index) => (
            <div key={history.id} className="relative pl-10">
              <div
                className={`absolute left-2 w-5 h-5 rounded-full border-4 border-white ${statusColorsBg[history.toStatus]}`}
              />

              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {history.fromStatus && (
                      <>
                        <span className="text-sm text-slate-500">
                          {statusLabels[history.fromStatus]}
                        </span>
                        <span className="text-slate-300">→</span>
                      </>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        history.toStatus === 'confirmed'
                          ? 'bg-green-100 text-green-700'
                          : history.toStatus === 'to_supplement'
                          ? 'bg-red-100 text-red-700'
                          : history.toStatus === 'modified'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {statusLabels[history.toStatus]}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {formatDate(history.operateTime)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                  <User className="w-4 h-4" />
                  <span>{history.operator}</span>
                </div>

                <div className="flex items-start gap-2 text-sm">
                  <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5" />
                  <span className="text-slate-700">{history.reason}</span>
                </div>

                {history.remark && (
                  <div className="mt-2 text-sm text-slate-500 bg-white px-3 py-2 rounded">
                    备注: {history.remark}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
