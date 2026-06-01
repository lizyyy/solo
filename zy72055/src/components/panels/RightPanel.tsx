import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { AnomalyDetail } from './AnomalyDetail';
import type { Anomaly, InspectionRecord, AnomalyStatus } from '../../types';

interface RightPanelProps {
  collapsed: boolean;
  onToggle: () => void;
  selectedAnomaly: Anomaly | null;
  records: InspectionRecord[];
  highlightedRow: number | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: AnomalyStatus, note: string) => void;
  onAddSupplement: (id: string, content: string) => void;
  onHighlightRow: (row: number | null) => void;
}

export function RightPanel({
  collapsed,
  onToggle,
  selectedAnomaly,
  records,
  highlightedRow,
  onClose,
  onUpdateStatus,
  onAddSupplement,
  onHighlightRow,
}: RightPanelProps) {
  if (collapsed) {
    return (
      <div className="h-full w-12 bg-slate-900/90 backdrop-blur border-l border-slate-700 flex flex-col items-center py-4 gap-2">
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div className="w-8 h-px bg-slate-700 my-2" />
        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
          <Info className="w-4 h-4 text-slate-500" />
        </div>
      </div>
    );
  }
  
  if (!selectedAnomaly) {
    return (
      <div className="h-full w-80 bg-slate-900/90 backdrop-blur border-l border-slate-700 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-slate-200">异常详情</h2>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <Info className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="text-sm font-medium text-slate-400 mb-2">选择一个异常点</h3>
            <p className="text-xs text-slate-500">
              点击3D场景中的异常标记，查看详细信息和处理记录
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  const record = records.find(r => r.id === selectedAnomaly.recordId);
  
  return (
    <div className="h-full w-80 bg-slate-900/90 backdrop-blur border-l border-slate-700 flex flex-col relative">
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <h2 className="text-sm font-semibold text-slate-200">异常详情</h2>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <AnomalyDetail
          anomaly={selectedAnomaly}
          record={record}
          highlightedRow={highlightedRow}
          onClose={onClose}
          onUpdateStatus={onUpdateStatus}
          onAddSupplement={onAddSupplement}
          onHighlightRow={onHighlightRow}
        />
      </div>
    </div>
  );
}
