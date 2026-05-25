import { useEffect, useRef, useCallback } from 'react';
import type { BoxType, PlacedItem, Commodity } from '../types/game';
import { render } from '../utils/canvas/renderer';
import { useDragDrop, DragState } from '../hooks/useDragDrop';

interface GameCanvasProps {
  boxType: BoxType | null;
  placedItems: PlacedItem[];
  selectedCommodity: Commodity | null;
  violationCommodityIds: string[];
  onPlace: (commodityId: string, x: number, y: number, layer: number, rotation: number) => boolean;
  onRemove: (commodityId: string) => void;
  validatePlacement: (commodity: Commodity, x: number, y: number, layer: number, rotation: number) => {
    isValid: boolean;
    collisionItem?: PlacedItem;
    outOfBounds?: boolean;
  };
  isPlaying: boolean;
  isPaused: boolean;
}

export const GameCanvas = ({
  boxType,
  placedItems,
  selectedCommodity,
  violationCommodityIds,
  onPlace,
  onRemove,
  validatePlacement,
  isPlaying,
  isPaused,
}: GameCanvasProps) => {
  const {
    canvasRef,
    dragState,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
    handleWheel,
  } = useDragDrop({
    selectedCommodity,
    selectedBoxType: boxType,
    placedItems,
    onPlace,
    onRemove,
    validatePlacement,
    isPlaying,
    isPaused,
  });
  
  const animationFrameRef = useRef<number>();
  
  const draw = useCallback(() => {
    if (!canvasRef.current || !boxType) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    let previewItem;
    if (dragState.isDragging && dragState.dragCommodity) {
      previewItem = {
        commodity: dragState.dragCommodity,
        x: dragState.dragX,
        y: dragState.dragY,
        layer: dragState.dragLayer,
        rotation: dragState.dragRotation,
        isValid: dragState.isValidPlacement,
      };
    }
    
    render(
      ctx,
      rect.width,
      rect.height,
      boxType,
      placedItems,
      {
        showGrid: true,
        showLabels: true,
        highlightViolations: true,
        violationCommodityIds,
        previewItem,
      }
    );
  }, [boxType, placedItems, dragState, violationCommodityIds]);
  
  useEffect(() => {
    const animate = () => {
      draw();
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [draw]);
  
  useEffect(() => {
    const handleResize = () => {
      draw();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);
  
  if (!boxType) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <p className="text-gray-500">请先选择关卡</p>
      </div>
    );
  }
  
  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg shadow-lg cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
        onWheel={handleWheel}
        style={{ cursor: selectedCommodity ? 'grab' : 'default' }}
      />
      
      {isPaused && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
          <div className="text-white text-2xl font-bold">游戏暂停</div>
        </div>
      )}
      
      {dragState.isDragging && (
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white px-3 py-2 rounded text-sm">
          <div>滚轮: 调整层级 (当前: {dragState.dragLayer + 1})</div>
          <div>R键: 旋转 (当前: {dragState.dragRotation}°)</div>
        </div>
      )}
      
      {selectedCommodity && !dragState.isDragging && (
        <div className="absolute bottom-4 left-4 bg-blue-600 text-white px-3 py-2 rounded text-sm animate-pulse">
          拖拽放置「{selectedCommodity.name}」
        </div>
      )}
    </div>
  );
};
