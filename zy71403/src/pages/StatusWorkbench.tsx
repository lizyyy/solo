import { useValuationStore } from '../store/useValuationStore';
import { StatusColumn } from '../components/workbench/StatusColumn';
import { useMemo } from 'react';
import { Filter } from 'lucide-react';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

export function StatusWorkbench() {
  const { getFilteredValuations } = useValuationStore(useShallow((state) => ({
    getFilteredValuations: state.getFilteredValuations,
  })));
  const [showAnomalyOnly, setShowAnomalyOnly] = useState(false);
  
  const allRecords = getFilteredValuations();
  const filteredRecords = showAnomalyOnly 
    ? allRecords.filter(r => r.anomalies.length > 0)
    : allRecords;
  
  const recordsByStatus = useMemo(() => {
    return {
      pending: filteredRecords.filter(r => r.status === 'pending'),
      returned: filteredRecords.filter(r => r.status === 'returned'),
      anomaly: filteredRecords.filter(r => r.status === 'anomaly'),
      processed: filteredRecords.filter(r => r.status === 'processed'),
    };
  }, [filteredRecords]);
  
  const pendingCount = recordsByStatus.pending.length + recordsByStatus.anomaly.length + recordsByStatus.returned.length;
  
  return (
    <div className="flex flex-col h-[calc(100vh-65px)] overflow-hidden">
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-slate-800">状态工作台</h2>
            <p className="text-sm text-slate-500 mt-1">按状态分组管理估值记录，支持快速流转处理</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">待处理:</span>
              <span className={`font-semibold ${pendingCount > 0 ? 'text-amber-600' : 'text-slate-600'}`}>
                {pendingCount} 条
              </span>
            </div>
            <button
              onClick={() => setShowAnomalyOnly(!showAnomalyOnly)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all btn-click ${
                showAnomalyOnly
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              仅看异常
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden p-6 pt-4">
        <div className="grid grid-cols-4 gap-4 h-full">
          <StatusColumn status="pending" records={recordsByStatus.pending} />
          <StatusColumn status="anomaly" records={recordsByStatus.anomaly} />
          <StatusColumn status="returned" records={recordsByStatus.returned} />
          <StatusColumn status="processed" records={recordsByStatus.processed} />
        </div>
      </div>
    </div>
  );
}
