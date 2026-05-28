import { useRef, useEffect } from 'react';
import { useSynthStore } from '../../store/useSynthStore';
import { HistoryItemComponent } from './HistoryItem';

export function HistoryTimeline() {
  const { history } = useSynthStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-gray-300 font-bold text-sm tracking-widest uppercase flex items-center gap-2">
          <span className="w-2 h-2 bg-cyan-400 rounded-full" />
          操作历史
        </h3>
        <span className="text-xs text-gray-500 font-mono">{history.length} 条记录</span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600"
      >
        {history.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <div className="text-4xl mb-2">🎛️</div>
            <div className="text-sm">开始调节参数</div>
            <div className="text-xs">操作记录将显示在这里</div>
          </div>
        ) : (
          history.map((item) => <HistoryItemComponent key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}
