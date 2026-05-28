import { useEffect, useState } from 'react';
import WarehouseScene from '../three/WarehouseScene';
import StatusBar from '../components/layout/StatusBar';
import FilterBar from '../components/controls/FilterBar';
import LayerPanel from '../components/controls/LayerPanel';
import TimelineControl from '../components/controls/TimelineControl';
import DetailPanel from '../components/panels/DetailPanel';
import { useDataStore } from '../store/dataStore';
import { Loader2 } from 'lucide-react';

interface Workspace3DProps {
  noHeader?: boolean;
}

export default function Workspace3D({ noHeader }: Workspace3DProps) {
  const loadData = useDataStore((s) => s.loadData);
  const isLoading = useDataStore((s) => s.isLoading);
  const warehouse = useDataStore((s) => s.warehouse);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading || !warehouse) {
    return (
      <div className="flex-1 flex items-center justify-center bg-warehouse-bg">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-accent-blue animate-spin" />
          <div className="text-slate-400 text-sm font-mono">加载仓库数据...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-warehouse-bg overflow-hidden">
      <div className="flex-none px-4 py-2">
        <FilterBar />
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div
          className="flex-none transition-all duration-300 overflow-y-auto"
          style={{ width: leftPanelOpen ? 240 : 0, opacity: leftPanelOpen ? 1 : 0 }}
        >
          <LayerPanel />
        </div>

        <div className="flex-1 relative">
          <WarehouseScene />

          <div className="absolute bottom-4 left-4 right-4 z-10">
            <TimelineControl />
          </div>

          <button
            onClick={() => setLeftPanelOpen(!leftPanelOpen)}
            className="absolute top-2 left-2 z-10 w-8 h-8 flex items-center justify-center rounded-md glass-light hover:bg-warehouse-surface/80 transition-all"
            title={leftPanelOpen ? '收起图层' : '展开图层'}
          >
            <span className="text-slate-400 text-xs">◀</span>
          </button>

          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center rounded-md glass-light hover:bg-warehouse-surface/80 transition-all"
            title={rightPanelOpen ? '收起详情' : '展开详情'}
          >
            <span className="text-slate-400 text-xs">▶</span>
          </button>
        </div>

        <div
          className="flex-none transition-all duration-300 overflow-y-auto panel-enter"
          style={{ width: rightPanelOpen ? 320 : 0, opacity: rightPanelOpen ? 1 : 0 }}
        >
          <DetailPanel />
        </div>
      </div>

      <StatusBar />
    </div>
  );
}
