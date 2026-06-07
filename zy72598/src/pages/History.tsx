import { useExperimentStore } from '@/store/useExperimentStore';
import { HistoryTimeline } from '@/components/History/HistoryTimeline';
import { History, Clock } from 'lucide-react';

export const HistoryPage = () => {
  const { experiments, currentExperimentId, setCurrentExperiment, getCurrentHistory } =
    useExperimentStore();

  const historyRecords = getCurrentHistory();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-3"
            style={{ fontFamily: "'Source Serif Pro', serif" }}
          >
            <History className="w-7 h-7 text-slate-700" />
            历史记录
          </h1>
          <p className="text-gray-500">完整的操作日志和审计追踪，所有变更可追溯</p>
        </div>
        <select
          value={currentExperimentId || ''}
          onChange={(e) => setCurrentExperiment(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {experiments.map((exp) => (
            <option key={exp.id} value={exp.id}>
              {exp.name}
            </option>
          ))}
        </select>
      </div>

      {historyRecords.length > 0 ? (
        <HistoryTimeline records={historyRecords} />
      ) : (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">暂无历史记录</h3>
          <p className="text-gray-500">该实验尚无操作记录</p>
        </div>
      )}
    </div>
  );
};
