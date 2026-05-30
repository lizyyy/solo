import { useEffect, useRef } from 'react';
import { Scene } from '@/components/three/Scene';
import { LeftPanel } from '@/components/controls/LeftPanel';
import { RightPanel } from '@/components/panels/RightPanel';
import { TopToolbar } from '@/components/toolbar/TopToolbar';
import { BottomStatusBar } from '@/components/statusbar/BottomStatusBar';
import { useAcousticAnalysis } from '@/hooks/useAcousticAnalysis';
import { useDrumKitStore } from '@/store/useDrumKitStore';

export function MainPage() {
  useAcousticAnalysis();
  const { session, analysis, leftPanelOpen, rightPanelOpen } = useDrumKitStore();
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        
        const { selectedMicId, removeMicrophone } = useDrumKitStore.getState();
        if (selectedMicId) {
          e.preventDefault();
          if (confirm('确定删除选中的麦克风吗？')) {
            removeMicrophone(selectedMicId);
          }
        }
      }
      
      if (e.key === 'Escape') {
        const { selectMicrophone, selectDrumPiece } = useDrumKitStore.getState();
        selectMicrophone(null);
        selectDrumPiece(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  return (
    <div className="w-full h-screen bg-slate-900 overflow-hidden relative">
      <TopToolbar />
      
      <LeftPanel />
      <RightPanel />
      
      <div
        id="canvas-container"
        ref={containerRef}
        className="absolute inset-0 pt-14 pb-12 transition-all duration-300"
        style={{
          paddingLeft: leftPanelOpen ? '20rem' : '2.5rem',
          paddingRight: rightPanelOpen ? '20rem' : '2.5rem',
        }}
      >
        <div className="w-full h-full rounded-lg overflow-hidden border border-slate-700 shadow-2xl">
          <Scene />
        </div>
        
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 bg-slate-800/90 backdrop-blur-sm rounded-full border border-slate-700 text-xs text-slate-400">
          <span>鼠标左键：旋转视图</span>
          <span className="w-px h-4 bg-slate-600" />
          <span>滚轮：缩放</span>
          <span className="w-px h-4 bg-slate-600" />
          <span>拖拽麦克风：调整位置</span>
          <span className="w-px h-4 bg-slate-600" />
          <span>ESC：取消选择</span>
        </div>
        
        <div className="absolute top-20 right-4 text-right text-xs text-slate-500">
          <div>麦克风: {session.microphones.length}</div>
          <div>鼓件: {session.drumPieces.length}</div>
          <div>相位关系: {analysis.phaseRelations.length}</div>
          <div>串音数据: {analysis.crosstalkMatrix.length}</div>
        </div>
      </div>
      
      <BottomStatusBar />
    </div>
  );
}
