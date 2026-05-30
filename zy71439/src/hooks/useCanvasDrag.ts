import { useRef, useCallback, useState } from 'react';
import { GeoPoint } from '../types';

export interface CanvasDragState {
  isDragging: boolean;
  dragStart: { x: number; y: number } | null;
  dragCurrent: { x: number; y: number } | null;
}

export interface CanvasCoordinateConverter {
  canvasToGeo: (x: number, y: number) => GeoPoint;
  geoToCanvas: (point: GeoPoint) => { x: number; y: number };
}

export function useCanvasDrag(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  converter: CanvasCoordinateConverter,
  onDragEnd?: (geoPoint: GeoPoint) => void,
  onDragMove?: (geoPoint: GeoPoint) => void
) {
  const [dragState, setDragState] = useState<CanvasDragState>({
    isDragging: false,
    dragStart: null,
    dragCurrent: null
  });

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setDragState({
      isDragging: true,
      dragStart: { x, y },
      dragCurrent: { x, y }
    });
  }, [canvasRef]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragState.isDragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setDragState(prev => ({
      ...prev,
      dragCurrent: { x, y }
    }));

    const geoPoint = converter.canvasToGeo(x, y);
    onDragMove?.(geoPoint);
  }, [dragState.isDragging, canvasRef, converter, onDragMove]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const geoPoint = converter.canvasToGeo(x, y);
    onDragEnd?.(geoPoint);

    setDragState({
      isDragging: false,
      dragStart: null,
      dragCurrent: null
    });
  }, [canvasRef, converter, onDragEnd]);

  const handleMouseLeave = useCallback(() => {
    if (dragState.isDragging && dragState.dragCurrent) {
      const geoPoint = converter.canvasToGeo(
        dragState.dragCurrent.x,
        dragState.dragCurrent.y
      );
      onDragEnd?.(geoPoint);
    }

    setDragState({
      isDragging: false,
      dragStart: null,
      dragCurrent: null
    });
  }, [dragState, converter, onDragEnd]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || e.touches.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    setDragState({
      isDragging: true,
      dragStart: { x, y },
      dragCurrent: { x, y }
    });
  }, [canvasRef]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!dragState.isDragging || !canvasRef.current || e.touches.length === 0) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    setDragState(prev => ({
      ...prev,
      dragCurrent: { x, y }
    }));

    const geoPoint = converter.canvasToGeo(x, y);
    onDragMove?.(geoPoint);
  }, [dragState.isDragging, canvasRef, converter, onDragMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!dragState.dragCurrent) return;

    const geoPoint = converter.canvasToGeo(
      dragState.dragCurrent.x,
      dragState.dragCurrent.y
    );
    onDragEnd?.(geoPoint);

    setDragState({
      isDragging: false,
      dragStart: null,
      dragCurrent: null
    });
  }, [dragState.dragCurrent, converter, onDragEnd]);

  return {
    dragState,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  };
}
