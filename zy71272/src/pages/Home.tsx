import { useEffect } from 'react';
import Scene3D from '../components/three/Scene3D';
import Toolbar from '../components/ui/Toolbar';
import Sidebar from '../components/ui/Sidebar';
import IssuePanel from '../components/ui/IssuePanel';
import ReportModal from '../components/ui/ReportModal';
import LoadModal from '../components/ui/LoadModal';
import { initApp } from '../store/useStore';

export default function Home() {
  useEffect(() => {
    initApp();
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#0a0e17]">
      <Toolbar />
      <Scene3D />
      <Sidebar />
      <IssuePanel />
      <ReportModal />
      <LoadModal />

      <div className="fixed bottom-4 left-4 z-40 text-[10px] text-[#8899aa]/50 font-mono">
        <div>3D声场可视化系统 v1.0</div>
        <div>拖拽乐手调整站位 · 点击查看数据</div>
      </div>
    </div>
  );
}
