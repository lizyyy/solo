import { useState } from 'react';
import { TopBar } from '../components/ui/TopBar';
import { LeftPanel } from '../components/ui/LeftPanel';
import { RightPanel } from '../components/ui/RightPanel';
import { BottomTimeline } from '../components/ui/BottomTimeline';
import { Scene3D } from '../components/three/Scene3D';
import { useAppStore } from '../store/appStore';

export default function Home() {
  const [currentView, setCurrentView] = useState('俯视全景');
  const store = useAppStore((state) => state.store);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden">
      <TopBar />
      
      <div className="flex-1 flex overflow-hidden">
        <LeftPanel currentView={currentView} onViewChange={setCurrentView} />
        
        <main className="flex-1 relative">
          {store ? (
            <div className="absolute inset-0">
              <Scene3D currentView={currentView} />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-2xl">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">货架陈列体检系统</h2>
                <p className="text-slate-400 mb-6 max-w-md">
                  点击左侧面板的「导入样例数据」按钮开始体验3D货架可视化、陈列校验和动线分析
                </p>
                <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                  <FeatureCard title="3D可视化" desc="沉浸式门店货架3D场景" />
                  <FeatureCard title="智能校验" desc="自动检测陈列问题" />
                  <FeatureCard title="动线热力" desc="客流热力图分析" />
                </div>
              </div>
            </div>
          )}
        </main>
        
        <RightPanel />
      </div>
      
      <BottomTimeline />
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
      <div className="text-white font-semibold text-sm mb-1">{title}</div>
      <div className="text-slate-400 text-xs">{desc}</div>
    </div>
  );
}
