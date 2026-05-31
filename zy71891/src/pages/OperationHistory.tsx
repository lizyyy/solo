import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import OperationTimeline from '../components/history/OperationTimeline';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatusBadge from '../components/common/StatusBadge';
import { useWarningStore } from '../store/useWarningStore';
import { OperationLog, Warning } from '../types';

export default function OperationHistory() {
  const navigate = useNavigate();
  const [allLogs, setAllLogs] = useState<Array<{ log: OperationLog; warning: Warning }>>([]);

  const { warnings, loading, fetchWarnings, fetchWarningDetail } = useWarningStore();

  useEffect(() => {
    fetchWarnings();
  }, [fetchWarnings]);

  useEffect(() => {
    const loadAllLogs = async () => {
      const logs: Array<{ log: OperationLog; warning: Warning }> = [];
      
      for (const warning of warnings.slice(0, 5)) {
        await fetchWarningDetail(warning.id);
        const detail = useWarningStore.getState().warningDetail;
        if (detail) {
          detail.operationLogs.forEach(log => {
            logs.push({ log, warning });
          });
        }
      }

      logs.sort(
        (a, b) =>
          new Date(b.log.operatedAt).getTime() - new Date(a.log.operatedAt).getTime()
      );

      setAllLogs(logs);
    };

    if (warnings.length > 0) {
      loadAllLogs();
    }
  }, [warnings, fetchWarningDetail]);

  const affectingCount = allLogs.filter(l => l.log.affectsConclusion).length;
  const nonAffectingCount = allLogs.filter(l => !l.log.affectsConclusion).length;

  return (
    <div className="flex min-h-screen bg-[#0f1219]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title="操作历史"
          subtitle="查看所有操作记录，区分补材料和结论变更"
        />

        <main className="flex-1 p-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-[#1a1f2e] border border-gray-800 rounded-lg p-4">
              <p className="text-2xl font-bold text-white">{allLogs.length}</p>
              <p className="text-xs text-gray-500">总操作记录</p>
            </div>
            <div className="bg-[#1a1f2e] border border-gray-800 rounded-lg p-4">
              <p className="text-2xl font-bold text-orange-400">{affectingCount}</p>
              <p className="text-xs text-gray-500">影响结论的操作</p>
            </div>
            <div className="bg-[#1a1f2e] border border-gray-800 rounded-lg p-4">
              <p className="text-2xl font-bold text-gray-400">{nonAffectingCount}</p>
              <p className="text-xs text-gray-500">仅补材料的操作</p>
            </div>
          </div>

          {loading && allLogs.length === 0 ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" text="加载中..." />
            </div>
          ) : (
            <div className="space-y-6">
              {allLogs.map(({ log, warning }, index) => (
                <div
                  key={`${log.id}-${index}`}
                  className="bg-[#1a1f2e] border border-gray-800 rounded-lg p-4"
                  style={{
                    animation: `fadeInUp 0.3s ease-out ${index * 0.05}s both`,
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => navigate(`/warning/${warning.id}`)}
                    >
                      <StatusBadge status={warning.status} />
                      <span className="text-white font-medium">{warning.deviceName}</span>
                      <span className="text-xs text-gray-500">{warning.deviceId}</span>
                    </div>
                  </div>
                  <OperationTimeline logs={[log]} />
                </div>
              ))}

              {allLogs.length === 0 && (
                <div className="py-12 text-center text-gray-500">
                  <p>暂无操作记录</p>
                </div>
              )}
            </div>
          )}

          <style>{`
            @keyframes fadeInUp {
              from {
                opacity: 0;
                transform: translateY(10px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
        </main>
      </div>
    </div>
  );
}
