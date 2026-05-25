import { useState, useRef } from 'react';
import { useAppStore } from '../../store';

export const SelectionTool = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isSelecting = useAppStore((state) => state.isSelecting);
  const setIsSelecting = useAppStore((state) => state.setIsSelecting);
  const selectionBox = useAppStore((state) => state.selectionBox);
  const setSelectionBox = useAppStore((state) => state.setSelectionBox);
  const setSelectedGridIds = useAppStore((state) => state.setSelectedGridIds);
  const data = useAppStore((state) => state.data);

  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current || !isSelecting) return;

    const rect = containerRef.current.getBoundingClientRect();
    setStartPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || !startPos || !isSelecting) return;

    const rect = containerRef.current.getBoundingClientRect();
    setSelectionBox({
      startX: startPos.x,
      startY: startPos.y,
      endX: e.clientX - rect.left,
      endY: e.clientY - rect.top,
    });
  };

  const handleMouseUp = () => {
    if (!selectionBox || !data) {
      setStartPos(null);
      setSelectionBox(null);
      return;
    }

    const minX = Math.min(selectionBox.startX, selectionBox.endX);
    const maxX = Math.max(selectionBox.startX, selectionBox.endX);
    const minY = Math.min(selectionBox.startY, selectionBox.endY);
    const maxY = Math.max(selectionBox.startY, selectionBox.endY);

    if (maxX - minX < 5 || maxY - minY < 5) {
      setStartPos(null);
      setSelectionBox(null);
      return;
    }

    const selectedIds = data.gridPoints
      .filter((point) => {
        const screenX = (point.x / data.rink.width) * 100;
        const screenY = (point.y / data.rink.height) * 100;
        return (
          screenX >= (minX / containerRef.current!.clientWidth) * 100 &&
          screenX <= (maxX / containerRef.current!.clientWidth) * 100 &&
          screenY >= (minY / containerRef.current!.clientHeight) * 100 &&
          screenY <= (maxY / containerRef.current!.clientHeight) * 100
        );
      })
      .map((p) => p.id);

    setSelectedGridIds(selectedIds);
    setStartPos(null);
    setSelectionBox(null);
    setIsSelecting(false);
  };

  if (!data) return null;

  return (
    <>
      {isSelecting && (
        <div
          ref={containerRef}
          className="absolute inset-0 z-40 bg-transparent"
          style={{ cursor: 'crosshair' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {selectionBox && (
            <div
              className="absolute border-2 border-cyan-400 bg-cyan-400/20 pointer-events-none"
              style={{
                left: Math.min(selectionBox.startX, selectionBox.endX),
                top: Math.min(selectionBox.startY, selectionBox.endY),
                width: Math.abs(selectionBox.endX - selectionBox.startX),
                height: Math.abs(selectionBox.endY - selectionBox.startY),
              }}
            />
          )}
        </div>
      )}

      <button
        onClick={() => {
          setIsSelecting(!isSelecting);
          if (isSelecting) {
            setStartPos(null);
            setSelectionBox(null);
          }
        }}
        className={`absolute top-4 left-80 z-50 px-3 py-2 rounded-lg text-sm transition-colors ${
          isSelecting
            ? 'bg-cyan-600 text-white'
            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
        }`}
      >
        {isSelecting ? '✓ 框选模式' : '⬛ 框选筛选'}
      </button>
    </>
  );
};
