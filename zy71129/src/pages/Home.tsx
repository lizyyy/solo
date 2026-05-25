
import { useState, useRef, useCallback, useEffect } from 'react';
import { SceneCanvas } from '../components/scene/SceneCanvas';
import { Toolbar } from '../components/toolbar/Toolbar';
import { Sidebar } from '../components/sidebar/Sidebar';
import { SidebarContent } from '../components/sidebar/SidebarContent';
import { CollisionPanel } from '../components/collision/CollisionPanel';
import { CollisionPanelContent } from '../components/collision/CollisionPanelContent';
import { ComparePanel } from '../components/compare/ComparePanel';
import { VersionTimeline } from '../components/timeline/VersionTimeline';
import { SceneManager } from '../three/SceneManager';
import { CollisionEngine } from '../three/CollisionEngine';
import { useModelStore } from '../store/useModelStore';
import { useFilterStore } from '../store/useFilterStore';
import { useCollisionStore } from '../store/useCollisionStore';
import { Point3D } from '../types/model';

interface CameraState {
  position: Point3D;
  target: Point3D;
}

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [collisionPanelOpen, setCollisionPanelOpen] = useState(true);
  const [sceneManager, setSceneManager] = useState<SceneManager | null>(null);
  const [leftSceneManager, setLeftSceneManager] = useState<SceneManager | null>(null);
  const [rightSceneManager, setRightSceneManager] = useState<SceneManager | null>(null);
  const collisionEngineRef = useRef<CollisionEngine | null>(null);
  const isSyncingRef = useRef(false);

  const { 
    getFilteredElements, 
    getElementsByVersion,
    loaded, 
    compareView, 
    versionDiff,
    currentVersion,
    compareVersion
  } = useModelStore();
  const { types, elevationRange } = useFilterStore();
  const { setCollisions, setIsDetecting, setSoftCollisionThreshold, isDetecting } = useCollisionStore();

  const handleSceneReady = useCallback((manager: SceneManager) => {
    setSceneManager(manager);
    collisionEngineRef.current = new CollisionEngine();
  }, []);

  const handleLeftSceneReady = useCallback((manager: SceneManager) => {
    setLeftSceneManager(manager);
    if (collisionEngineRef.current === null) {
      collisionEngineRef.current = new CollisionEngine();
    }
  }, []);

  const handleRightSceneReady = useCallback((manager: SceneManager) => {
    setRightSceneManager(manager);
    if (collisionEngineRef.current === null) {
      collisionEngineRef.current = new CollisionEngine();
    }
  }, []);

  const syncCamera = useCallback((source: SceneManager, target: SceneManager | null) => {
    if (!target || isSyncingRef.current) return;
    
    isSyncingRef.current = true;
    const cameraState = source.getCameraState();
    target.setCameraState(cameraState);
    
    setTimeout(() => {
      isSyncingRef.current = false;
    }, 50);
  }, []);

  useEffect(() => {
    if (!compareView.syncViews) return;
    
    if (leftSceneManager && rightSceneManager) {
      const leftHandler = () => syncCamera(leftSceneManager, rightSceneManager);
      const rightHandler = () => syncCamera(rightSceneManager, leftSceneManager);
      
      leftSceneManager.onCameraChange(leftHandler);
      rightSceneManager.onCameraChange(rightHandler);
      
      const initialState = leftSceneManager.getCameraState();
      rightSceneManager.setCameraState(initialState);
    }
  }, [leftSceneManager, rightSceneManager, compareView.syncViews, syncCamera]);

  const handleDetectCollisions = useCallback(() => {
    if (!collisionEngineRef.current || !sceneManager || !loaded) return;

    setIsDetecting(true);

    setTimeout(() => {
      const elements = getFilteredElements().filter(el => {
        if (!types.includes(el.type)) return false;
        if (el.elevation < elevationRange[0] || el.elevation > elevationRange[1]) return false;
        return true;
      });

      const collisions = collisionEngineRef.current!.detectCollisions(elements);
      setCollisions(collisions);
      sceneManager.loadCollisions(collisions);
      setIsDetecting(false);

      if (collisions.length > 0 && !collisionPanelOpen) {
        setCollisionPanelOpen(true);
      }
    }, 300);
  }, [sceneManager, loaded, getFilteredElements, types, elevationRange, setCollisions, setIsDetecting, collisionPanelOpen]);

  useEffect(() => {
    if (!sceneManager || !loaded) return;

    if (compareView.enabled && compareView.viewMode === 'overlay') {
      const elements = getFilteredElements().filter(el => {
        if (!types.includes(el.type)) return false;
        if (el.elevation < elevationRange[0] || el.elevation > elevationRange[1]) return false;
        return true;
      });
      sceneManager.loadElements(elements);
    } else {
      const elements = getElementsByVersion(currentVersion).filter(el => {
        if (!types.includes(el.type)) return false;
        if (el.elevation < elevationRange[0] || el.elevation > elevationRange[1]) return false;
        return true;
      });
      sceneManager.loadElements(elements);
    }
  }, [sceneManager, loaded, compareView.enabled, compareView.viewMode, currentVersion, compareVersion, types, elevationRange, getFilteredElements, getElementsByVersion]);

  useEffect(() => {
    if (!sceneManager || !compareView.enabled || !versionDiff) {
      if (sceneManager) {
        sceneManager.clearDiffHighlight();
      }
      return;
    }

    if (compareView.highlightDiff) {
      sceneManager.applyDiffHighlight(versionDiff.changes);
    } else {
      sceneManager.clearDiffHighlight();
    }
  }, [sceneManager, compareView.enabled, compareView.highlightDiff, versionDiff]);

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden">
      <div className={`absolute inset-0 ${compareView.enabled ? 'pt-28' : 'pt-14'} md:pt-14 pb-16 md:pb-16 ${compareView.enabled ? 'md:pt-28' : ''}`}>
        {compareView.enabled && compareView.viewMode === 'sideBySide' ? (
          <div className="w-full h-full flex gap-2 p-2">
            <div className="flex-1 relative rounded-lg overflow-hidden border border-slate-700">
              <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-slate-800/80 text-xs text-slate-300 rounded">
                V{compareVersion} (旧版本)
              </div>
              <SceneCanvas 
                onSceneReady={handleLeftSceneReady}
                key="compare-old"
                versionNumber={compareVersion}
              />
            </div>
            <div className="flex-1 relative rounded-lg overflow-hidden border border-slate-700">
              <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-slate-800/80 text-xs text-blue-400 rounded">
                V{currentVersion} (新版本)
              </div>
              <SceneCanvas 
                onSceneReady={handleRightSceneReady}
                key="compare-new"
                versionNumber={currentVersion}
              />
            </div>
          </div>
        ) : (
          <SceneCanvas onSceneReady={handleSceneReady} />
        )}
      </div>

      <Toolbar
        sceneManager={sceneManager || rightSceneManager}
        onDetectCollisions={handleDetectCollisions}
      />

      <ComparePanel />

      <div className="hidden md:block">
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
      </div>

      <div className="hidden lg:block">
        <CollisionPanel
          isOpen={collisionPanelOpen}
          onToggle={() => setCollisionPanelOpen(!collisionPanelOpen)}
        />
      </div>

      <VersionTimeline />

      <div className="md:hidden absolute left-0 top-1/2 -translate-y-1/2 z-20">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="w-8 h-12 bg-slate-800/90 border border-slate-700 rounded-r-lg flex items-center justify-center text-slate-400 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      <div className="lg:hidden absolute right-0 top-1/2 -translate-y-1/2 z-20">
        <button
          onClick={() => setCollisionPanelOpen(!collisionPanelOpen)}
          className="w-8 h-12 bg-slate-800/90 border border-slate-700 rounded-l-lg flex items-center justify-center text-slate-400 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </button>
      </div>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-15">
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-14 bottom-16 w-72 bg-slate-900/98 border-r border-slate-700 overflow-y-auto">
            <SidebarContent onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {collisionPanelOpen && (
        <div className="lg:hidden fixed inset-0 z-15">
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setCollisionPanelOpen(false)}
          />
          <div className="absolute right-0 top-14 bottom-16 w-80 bg-slate-900/98 border-l border-slate-700 overflow-y-auto">
            <CollisionPanelContent onClose={() => setCollisionPanelOpen(false)} />
          </div>
        </div>
      )}

      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-30">
          <div className="text-center px-4">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400 text-sm">点击"导入样例"加载演示数据</p>
          </div>
        </div>
      )}

      {isDetecting && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 z-30">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span className="hidden sm:inline">正在进行碰撞检测...</span>
          <span className="sm:hidden">检测中...</span>
        </div>
      )}
    </div>
  );
}
