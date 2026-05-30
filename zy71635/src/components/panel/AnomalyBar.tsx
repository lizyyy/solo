import { AlertCircle, AlertTriangle, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { useHallStore } from '@/store/useHallStore';
import AnomalyCard from './AnomalyCard';

export default function AnomalyBar() {
  const anomalies = useHallStore((s) => s.anomalies);
  const impacts = useHallStore((s) => s.impacts);
  const selection = useHallStore((s) => s.selection);
  const setSelection = useHallStore((s) => s.setSelection);
  const setFocusTarget = useHallStore((s) => s.setFocusTarget);
  const scrollRef = useRef<HTMLDivElement>(null);

  const criticalCount = anomalies.filter((a) => a.severity === 'critical').length;
  const warningCount = anomalies.filter((a) => a.severity === 'warning').length;
  const infoCount = anomalies.filter((a) => a.severity === 'info').length;

  const getImpact = (anomalyId: string) => {
    return impacts.find((i) => i.anomalyId === anomalyId);
  };

  const handleSelect = (anomaly: typeof anomalies[0]) => {
    setSelection({ type: 'anomaly', id: anomaly.id });
    setFocusTarget({ type: anomaly.sourceType, id: anomaly.sourceId });
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -280 : 280,
        behavior: 'smooth',
      });
    }
  };

  if (anomalies.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-hall-panel backdrop-blur-md border-t border-hall-border z-40">
      <div className="flex items-center justify-between px-4 py-2 border-b border-hall-border/50">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-hall-amber">异常检测</span>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-hall-danger">
              <AlertCircle className="w-3 h-3" />
              {criticalCount} 严重
            </span>
            <span className="flex items-center gap-1 text-hall-warn">
              <AlertTriangle className="w-3 h-3" />
              {warningCount} 警告
            </span>
            <span className="flex items-center gap-1 text-hall-info">
              <Info className="w-3 h-3" />
              {infoCount} 提示
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => scroll('left')}
            className="p-1 rounded hover:bg-hall-surface text-hall-textDim hover:text-hall-text transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-1 rounded hover:bg-hall-surface text-hall-textDim hover:text-hall-text transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex items-start gap-3 p-3 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {anomalies.map((anomaly) => (
          <AnomalyCard
            key={anomaly.id}
            anomaly={anomaly}
            impact={getImpact(anomaly.id)}
            selected={selection.id === anomaly.id}
            onClick={() => handleSelect(anomaly)}
          />
        ))}
      </div>
    </div>
  );
}
