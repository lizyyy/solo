import { useState, useCallback, useRef, useEffect } from 'react';
import type { CommodityInstance, BoxType, PlacedItem } from '../types/game';
import { snapToGrid, checkCollision, isWithinBox, getCommodityAABB } from '../utils/rules/collision';
import { getCommodityById } from '../data/commodities';

interface UseDragDropProps {
  selectedCommodity: CommodityInstance | null;
  selectedBoxType: BoxType | null;
  placedItems: PlacedItem[];
  onPlace: (instanceId: string, x: number, y: number, layer: number, rotation: number) => boolean;
  onRemove: (instanceId: string) => void;
  validatePlacement: (commodity: CommodityInstance, x: number, y: number, layer: number, rotation: number) => {
    isValid: boolean;
    collisionItem?: PlacedItem;
    outOfBounds?: boolean;
  };
  isPlaying: boolean;
  isPaused: boolean;
}

export interface DragState {
  isDragging: boolean;
  dragCommodity: CommodityInstance | null;
  dragX: number;
  dragY: number;
  dragLayer: number;
  dragRotation: number;
  isValidPlacement: boolean;
}

export const useDragDrop = ({
  selectedCommodity,
  selectedBoxType,
  placedItems,
  onPlace,
  onRemove,
  validatePlacement,
  isPlaying,
  isPaused,
}: UseDragDropProps) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragCommodity: null,
    dragX: 0,
    dragY: 0,
    dragLayer: 0,
    dragRotation: 0,
    isValidPlacement: false,
  });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  
  const pixelToGrid = useCallback((pixelX: number, pixelY: number) => {
    if (!selectedBoxType || !canvasRef.current) return { x: 0, y: 0 };
    
    const rect = canvasRef.current.getBoundingClientRect();
    const boxPixelWidth = selectedBoxType.width * selectedBoxType.gridSize;
    const boxPixelHeight = selectedBoxType.height * selectedBoxType.gridSize;
    const offsetX = (rect.width - boxPixelWidth) / 2;
    const offsetY = (rect.height - boxPixelHeight) / 2;
    
    const x = (pixelX - rect.left - offsetX) / selectedBoxType.gridSize;
    const y = (pixelY - rect.top - offsetY) / selectedBoxType.gridSize;
    
    return { x, y };
  }, [selectedBoxType]);
  
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPlaying || isPaused) return;
    if (!selectedCommodity || !selectedBoxType) return;
    
    e.preventDefault();
    const { x, y } = pixelToGrid(e.clientX, e.clientY);
    const snapped = snapToGrid(x, y);
    
    const validation = validatePlacement(
      selectedCommodity,
      snapped.x,
      snapped.y,
      0,
      rotationRef.current
    );
    
    setDragState({
      isDragging: true,
      dragCommodity: selectedCommodity,
      dragX: snapped.x,
      dragY: snapped.y,
      dragLayer: 0,
      dragRotation: rotationRef.current,
      isValidPlacement: validation.isValid,
    });
  }, [isPlaying, isPaused, selectedCommodity, selectedBoxType, pixelToGrid, validatePlacement]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragState.isDragging || !selectedCommodity || !selectedBoxType) return;
    
    const { x, y } = pixelToGrid(e.clientX, e.clientY);
    const snapped = snapToGrid(x, y);
    
    const validation = validatePlacement(
      selectedCommodity,
      snapped.x,
      snapped.y,
      dragState.dragLayer,
      dragState.dragRotation
    );
    
    setDragState(prev => ({
      ...prev,
      dragX: snapped.x,
      dragY: snapped.y,
      isValidPlacement: validation.isValid,
    }));
  }, [dragState.isDragging, dragState.dragLayer, dragState.dragRotation, selectedCommodity, selectedBoxType, pixelToGrid, validatePlacement]);
  
  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragState.isDragging || !dragState.dragCommodity) {
      setDragState(prev => ({ ...prev, isDragging: false }));
      return;
    }
    
    if (dragState.isValidPlacement) {
      onPlace(
        dragState.dragCommodity.instanceId,
        dragState.dragX,
        dragState.dragY,
        dragState.dragLayer,
        dragState.dragRotation
      );
    }
    
    rotationRef.current = 0;
    setDragState({
      isDragging: false,
      dragCommodity: null,
      dragX: 0,
      dragY: 0,
      dragLayer: 0,
      dragRotation: 0,
      isValidPlacement: false,
    });
  }, [dragState, onPlace]);
  
  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isPlaying || isPaused || !selectedBoxType) return;
    
    const { x, y } = pixelToGrid(e.clientX, e.clientY);
    
    for (const item of placedItems) {
      const commodity = getCommodityById(item.commodityId);
      if (!commodity) continue;
      
      const aabb = getCommodityAABB(item, commodity);
      if (
        x >= aabb.x &&
        x < aabb.x + aabb.width &&
        y >= aabb.y &&
        y < aabb.y + aabb.height
      ) {
        onRemove(item.instanceId);
        return;
      }
    }
  }, [isPlaying, isPaused, selectedBoxType, placedItems, pixelToGrid, onRemove]);
  
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!dragState.isDragging) return;
    e.preventDefault();
    
    const newLayer = Math.max(0, Math.min(3, dragState.dragLayer + (e.deltaY > 0 ? -1 : 1)));
    
    const validation = validatePlacement(
      dragState.dragCommodity!,
      dragState.dragX,
      dragState.dragY,
      newLayer,
      dragState.dragRotation
    );
    
    setDragState(prev => ({
      ...prev,
      dragLayer: newLayer,
      isValidPlacement: validation.isValid,
    }));
  }, [dragState, validatePlacement]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!dragState.isDragging) return;
      
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        const newRotation = (dragState.dragRotation + 90) % 360;
        
        const validation = validatePlacement(
          dragState.dragCommodity!,
          dragState.dragX,
          dragState.dragY,
          dragState.dragLayer,
          newRotation
        );
        
        setDragState(prev => ({
          ...prev,
          dragRotation: newRotation,
          isValidPlacement: validation.isValid,
        }));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dragState.isDragging, dragState.dragX, dragState.dragY, dragState.dragLayer, dragState.dragRotation, dragState.dragCommodity, validatePlacement]);
  
  return {
    canvasRef,
    dragState,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
    handleWheel,
  };
};
