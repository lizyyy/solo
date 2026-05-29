import { useState, useRef, useCallback, useEffect } from 'react';
import type { Bubble, BubbleVersion, Issue } from '../../types';
import { useBubbleStore } from '../../store/bubbleStore';
import { useIssueStore } from '../../store/issueStore';
import { StatusBadge } from '../common/StatusBadge';
import { ConflictBadge } from '../common/ConflictBadge';
import { estimateCapacity } from '../../utils/helpers';
import { Grip, Type, Move } from 'lucide-react';

interface BubbleCanvasProps {
  pageImageUrl: string;
  pageWidth: number;
  pageHeight: number;
  bubbles: Bubble[];
  getCurrentVersion: (bubbleId: string) => BubbleVersion | undefined;
  getBubbleIssues: (bubbleId: string) => Issue[];
  onSelectBubble: (bubbleId: string | null) => void;
  selectedBubbleId: string | null;
  onUpdateBubble: (bubbleId: string, updates: Partial<BubbleVersion>) => void;
}

interface DragState {
  bubbleId: string;
  type: 'move' | 'resize';
  startX: number;
  startY: number;
  startBubbleX: number;
  startBubbleY: number;
  startWidth: number;
  startHeight: number;
}

export function BubbleCanvas({
  pageImageUrl,
  pageWidth,
  pageHeight,
  bubbles,
  getCurrentVersion,
  getBubbleIssues,
  onSelectBubble,
  selectedBubbleId,
  onUpdateBubble,
}: BubbleCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.8);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const sortedBubbles = [...bubbles].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  const getMousePosition = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  }, [scale]);

  const handleMouseDown = useCallback((e: React.MouseEvent, bubbleId: string, type: 'move' | 'resize') => {
    e.stopPropagation();
    const version = getCurrentVersion(bubbleId);
    if (!version) return;

    const pos = getMousePosition(e);
    setDragState({
      bubbleId,
      type,
      startX: pos.x,
      startY: pos.y,
      startBubbleX: version.x,
      startBubbleY: version.y,
      startWidth: version.width,
      startHeight: version.height,
    });
    onSelectBubble(bubbleId);
  }, [getCurrentVersion, getMousePosition, onSelectBubble]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDrawing && drawStart) {
      const pos = getMousePosition(e);
      setDrawRect({
        x: Math.min(drawStart.x, pos.x),
        y: Math.min(drawStart.y, pos.y),
        width: Math.abs(pos.x - drawStart.x),
        height: Math.abs(pos.y - drawStart.y),
      });
      return;
    }

    if (!dragState) return;
    const pos = getMousePosition(e);
    const dx = pos.x - dragState.startX;
    const dy = pos.y - dragState.startY;

    if (dragState.type === 'move') {
      onUpdateBubble(dragState.bubbleId, {
        x: Math.max(0, Math.min(pageWidth - 50, dragState.startBubbleX + dx)),
        y: Math.max(0, Math.min(pageHeight - 30, dragState.startBubbleY + dy)),
      });
    } else if (dragState.type === 'resize') {
      onUpdateBubble(dragState.bubbleId, {
        width: Math.max(50, dragState.startWidth + dx),
        height: Math.max(30, dragState.startHeight + dy),
      });
    }
  }, [dragState, getMousePosition, onUpdateBubble, pageWidth, pageHeight, isDrawing, drawStart]);

  const handleMouseUp = useCallback(() => {
    if (isDrawing && drawRect && drawRect.width > 30 && drawRect.height > 20) {
      const importBubble = useBubbleStore.getState().importBubble;
      const pageId = bubbles[0]?.pageId;
      if (pageId) {
        const maxSeq = Math.max(...bubbles.map(b => b.sequenceNumber), 0);
        importBubble({
          pageId,
          sequenceNumber: maxSeq + 1,
          text: '',
          x: drawRect.x,
          y: drawRect.y,
          width: drawRect.width,
          height: drawRect.height,
          operator: '编辑',
        });
      }
    }
    setDragState(null);
    setIsDrawing(false);
    setDrawStart(null);
    setDrawRect(null);
  }, [isDrawing, drawRect, bubbles]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      onSelectBubble(null);
      setIsDrawing(true);
      const pos = getMousePosition(e);
      setDrawStart(pos);
    }
  }, [getMousePosition, onSelectBubble]);

  const handleCanvasClick = useCallback(() => {
    onSelectBubble(null);
  }, [onSelectBubble]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-4 py-2">
        <div className="flex items-center gap-2">
          <Move size={16} className="text-stone-500" />
          <span className="text-sm text-stone-600">画布比例: {(scale * 100).toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale(s => Math.min(2, s + 0.1))}
            className="rounded border border-stone-300 bg-white px-2 py-1 text-sm hover:bg-stone-50"
          >
            +
          </button>
          <button
            onClick={() => setScale(s => Math.max(0.3, s - 0.1))}
            className="rounded border border-stone-300 bg-white px-2 py-1 text-sm hover:bg-stone-50"
          >
            -
          </button>
          <button
            onClick={() => setScale(0.8)}
            className="rounded border border-stone-300 bg-white px-2 py-1 text-sm hover:bg-stone-50"
          >
            重置
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-stone-100 p-4">
        <div
          ref={canvasRef}
          className="relative mx-auto cursor-crosshair select-none shadow-lg"
          style={{
            width: pageWidth * scale,
            height: pageHeight * scale,
            backgroundImage: `url(${pageImageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleCanvasClick}
        >
          {sortedBubbles.map((bubble) => {
            const version = getCurrentVersion(bubble.id);
            if (!version) return null;
            const issues = getBubbleIssues(bubble.id);
            const hasOverlap = issues.some(i => i.type === 'OVERLAP');
            const hasSpill = issues.some(i => i.type === 'SPILL');
            const hasSequence = issues.some(i => i.type === 'SEQUENCE');
            const isSelected = selectedBubbleId === bubble.id;
            const capacity = estimateCapacity(version.width, version.height);
            const textLength = version.text.length;
            const lengthRatio = textLength / capacity;

            return (
              <div
                key={bubble.id}
                className={`absolute cursor-move transition-all duration-150 ${
                  isSelected ? 'z-20' : 'z-10'
                }`}
                style={{
                  left: version.x * scale,
                  top: version.y * scale,
                  width: version.width * scale,
                  height: version.height * scale,
                }}
                onMouseDown={(e) => handleMouseDown(e, bubble.id, 'move')}
              >
                <div
                  className={`h-full w-full rounded-md border-2 transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/30 shadow-lg'
                      : hasOverlap
                      ? 'border-red-500 bg-red-50/30 border-dashed'
                      : 'border-amber-500/70 bg-amber-50/20'
                  }`}
                >
                  <div className="absolute -top-5 left-0 flex items-center gap-1">
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded bg-stone-800 px-1 text-xs font-bold text-white">
                      {bubble.sequenceNumber}
                    </span>
                    {bubble.hasConflict && (
                      <ConflictBadge versionCount={bubble.latestVersion} />
                    )}
                  </div>

                  <div
                    className="absolute left-0 top-0 flex h-full w-full items-center justify-center overflow-hidden p-1"
                    style={{ fontSize: Math.max(10, 14 * scale) }}
                  >
                    <span
                      className={`line-clamp-2 text-center ${
                        hasSpill ? 'text-red-600' : 'text-stone-700'
                      } ${lengthRatio > 0.9 ? 'font-bold' : ''}`}
                    >
                      {version.text || <Type size={16 * scale} className="text-stone-400" />}
                    </span>
                  </div>

                  {hasSequence && (
                    <div className="absolute -right-1 -top-1 rounded-full bg-orange-500 px-1 text-xs text-white">
                      ⚠
                    </div>
                  )}

                  {lengthRatio > 0.8 && (
                    <div className="absolute bottom-0 right-0 rounded-tl bg-amber-500 px-1 text-[10px] text-white">
                      {textLength}/{capacity}
                    </div>
                  )}

                  <div
                    className="absolute -bottom-1 -right-1 cursor-se-resize rounded-sm bg-stone-800 p-0.5"
                    onMouseDown={(e) => handleMouseDown(e, bubble.id, 'resize')}
                  >
                    <Grip size={10} className="text-white" />
                  </div>
                </div>

                {isSelected && (
                  <div className="absolute -bottom-8 left-0 flex gap-1">
                    <StatusBadge status={bubble.status} size="sm" />
                  </div>
                )}
              </div>
            );
          })}

          {drawRect && (
            <div
              className="absolute border-2 border-dashed border-blue-500 bg-blue-100/30"
              style={{
                left: drawRect.x * scale,
                top: drawRect.y * scale,
                width: drawRect.width * scale,
                height: drawRect.height * scale,
              }}
            />
          )}
        </div>
      </div>

      <div className="border-t border-stone-200 bg-stone-50 px-4 py-2 text-xs text-stone-500">
        提示：在空白区域拖拽可创建新气泡，拖拽气泡可移动位置，拖拽右下角可调整大小
      </div>
    </div>
  );
}
