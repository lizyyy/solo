import { useState, useRef, useEffect, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useDrumKitStore } from '@/store/useDrumKitStore';
import { Position3D } from '@/types';

export function useDragControls() {
  const { selectedMicId, updateMicrophonePosition, session } = useDrumKitStore();
  const { camera, raycaster, scene } = useThree();
  const [isDragging, setIsDragging] = useState(false);
  const [dragPlane, setDragPlane] = useState<THREE.Plane | null>(null);
  const [hoveredMicId, setHoveredMicId] = useState<string | null>(null);
  const dragOffset = useRef<THREE.Vector3>(new THREE.Vector3());
  const dragStartPos = useRef<Position3D | null>(null);

  const getIntersectionPoint = useCallback((event: PointerEvent, plane: THREE.Plane): THREE.Vector3 | null => {
    const rect = document.querySelector('canvas')?.getBoundingClientRect();
    if (!rect) return null;
    
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    
    raycaster.setFromCamera(mouse, camera);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersection);
    
    return intersection;
  }, [camera, raycaster]);

  const handlePointerDown = useCallback((event: PointerEvent, micId: string, micPosition: Position3D) => {
    if (event.button !== 0) return;
    
    event.stopPropagation();
    event.preventDefault();
    
    useDrumKitStore.getState().selectMicrophone(micId);
    
    const normal = new THREE.Vector3(0, 1, 0);
    const plane = new THREE.Plane(normal, -micPosition.y);
    setDragPlane(plane);
    
    const intersection = getIntersectionPoint(event, plane);
    if (intersection) {
      dragOffset.current.copy(intersection).sub(
        new THREE.Vector3(micPosition.x, micPosition.y, micPosition.z)
      );
      dragStartPos.current = { ...micPosition };
      setIsDragging(true);
      
      const target = event.target as HTMLElement;
      if (target && target.setPointerCapture) {
        target.setPointerCapture(event.pointerId);
      }
    }
  }, [getIntersectionPoint]);

  const handlePointerMove = useCallback((event: PointerEvent) => {
    if (!isDragging || !selectedMicId || !dragPlane) return;
    
    const intersection = getIntersectionPoint(event, dragPlane);
    if (!intersection) return;
    
    const newPos = intersection.sub(dragOffset.current);
    
    const constrainedPos: Position3D = {
      x: Math.max(-3, Math.min(3, newPos.x)),
      y: Math.max(0.1, Math.min(4, newPos.y)),
      z: Math.max(-3, Math.min(3, newPos.z)),
    };
    
    updateMicrophonePosition(selectedMicId, constrainedPos);
  }, [isDragging, selectedMicId, dragPlane, getIntersectionPoint, updateMicrophonePosition]);

  const handlePointerUp = useCallback((event: PointerEvent) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    setDragPlane(null);
    dragStartPos.current = null;
    
    try {
      const target = event.target as HTMLElement;
      if (target && target.releasePointerCapture) {
        target.releasePointerCapture(event.pointerId);
      }
    } catch {
      // ignore
    }
  }, [isDragging]);

  useEffect(() => {
    if (!isDragging) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragStartPos.current && selectedMicId) {
        updateMicrophonePosition(selectedMicId, dragStartPos.current);
        setIsDragging(false);
        setDragPlane(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDragging, selectedMicId, updateMicrophonePosition]);

  return {
    isDragging,
    hoveredMicId,
    setHoveredMicId,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
