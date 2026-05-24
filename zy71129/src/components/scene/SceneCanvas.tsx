
import { useEffect, useRef, useCallback } from 'react';
import { SceneManager } from '../../three/SceneManager';
import { CollisionEngine } from '../../three/CollisionEngine';
import { useModelStore } from '../../store/useModelStore';
import { useFilterStore } from '../../store/useFilterStore';
import { useSceneStore } from '../../store/useSceneStore';
import { useCollisionStore } from '../../store/useCollisionStore';

interface SceneCanvasProps {
  onSceneReady?: (manager: SceneManager) => void;
}

export function SceneCanvas({ onSceneReady }: SceneCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const collisionEngineRef = useRef<CollisionEngine | null>(null);
  
  const { getFilteredElements, setSelectedElement, selectedElementId } = useModelStore();
  const { types, elevationRange } = useFilterStore();
  const { showGrid, showAxes, showElevationLines, wireframeMode, autoRotate, cameraPosition, cameraTarget, isOrthographic } = useSceneStore();
  const { setCollisions, setIsDetecting, setSoftCollisionThreshold, selectedCollisionId, getCollisionById } = useCollisionStore();

  const handleElementSelect = useCallback((id: string | null) => {
    setSelectedElement(id);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.highlightElement(id);
    }
  }, [setSelectedElement]);

  useEffect(() => {
    if (!containerRef.current) return;

    const sceneManager = new SceneManager(containerRef.current);
    const collisionEngine = new CollisionEngine();
    
    sceneManagerRef.current = sceneManager;
    collisionEngineRef.current = collisionEngine;
    
    sceneManager.setOnElementSelect(handleElementSelect);
    
    if (onSceneReady) {
      onSceneReady(sceneManager);
    }

    return () => {
      sceneManager.dispose();
    };
  }, [onSceneReady, handleElementSelect]);

  useEffect(() => {
    if (!sceneManagerRef.current) return;
    
    const allElements = getFilteredElements();
    const filteredElements = allElements.filter(el => {
      if (!types.includes(el.type)) return false;
      if (el.elevation < elevationRange[0] || el.elevation > elevationRange[1]) return false;
      return true;
    });
    
    sceneManagerRef.current.loadElements(filteredElements);
  }, [getFilteredElements, types, elevationRange]);

  useEffect(() => {
    if (!sceneManagerRef.current) return;
    sceneManagerRef.current.setShowGrid(showGrid);
    sceneManagerRef.current.setShowAxes(showAxes);
    sceneManagerRef.current.setShowElevationLines(showElevationLines);
    sceneManagerRef.current.setWireframeMode(wireframeMode);
    sceneManagerRef.current.setAutoRotate(autoRotate);
  }, [showGrid, showAxes, showElevationLines, wireframeMode, autoRotate]);

  useEffect(() => {
    if (!sceneManagerRef.current) return;
    sceneManagerRef.current.setCameraPosition(cameraPosition, cameraTarget);
  }, [cameraPosition, cameraTarget]);

  useEffect(() => {
    if (!sceneManagerRef.current) return;
    sceneManagerRef.current.setOrthographic(isOrthographic);
  }, [isOrthographic]);

  useEffect(() => {
    if (!sceneManagerRef.current || !selectedCollisionId) return;
    const collision = getCollisionById(selectedCollisionId);
    if (collision) {
      sceneManagerRef.current.focusOnCollision(collision);
    }
  }, [selectedCollisionId, getCollisionById]);

  useEffect(() => {
    if (!sceneManagerRef.current) return;
    sceneManagerRef.current.highlightElement(selectedElementId);
  }, [selectedElementId]);

  const runCollisionDetection = useCallback(() => {
    if (!sceneManagerRef.current || !collisionEngineRef.current) return;
    
    setIsDetecting(true);
    
    setTimeout(() => {
      const elements = getFilteredElements().filter(el => {
        if (!types.includes(el.type)) return false;
        if (el.elevation < elevationRange[0] || el.elevation > elevationRange[1]) return false;
        return true;
      });
      
      const collisions = collisionEngineRef.current!.detectCollisions(elements);
      setCollisions(collisions);
      sceneManagerRef.current!.loadCollisions(collisions);
      setIsDetecting(false);
    }, 100);
  }, [getFilteredElements, types, elevationRange, setCollisions, setIsDetecting]);

  useEffect(() => {
    if (collisionEngineRef.current) {
      const { softCollisionThreshold } = useCollisionStore.getState();
      collisionEngineRef.current.setSoftThreshold(softCollisionThreshold);
    }
  }, [setSoftCollisionThreshold]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    />
  );
}
