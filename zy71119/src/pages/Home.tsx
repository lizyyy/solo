import { useEffect } from 'react';
import ThreeScene from '../components/three/Scene';
import TopToolbar from '../components/layout/TopToolbar';
import LeftControlPanel from '../components/layout/LeftControlPanel';
import RightStatsPanel from '../components/layout/RightStatsPanel';
import { useAppStore } from '../store/useAppStore';
import { Sun } from 'lucide-react';

export default function Home() {
  const { isDataLoaded, loadSampleData } = useAppStore();

  useEffect(() => {
  }, []);

  return (
    <div className="w-full h-full relative overflow-hidden bg-primary-900">
      <ThreeScene />
      
      <TopToolbar />
      <LeftControlPanel />
      <RightStatsPanel />

      {!isDataLoaded && (
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <div className="text-center pointer-events-auto">
            <div className="mb-6">
              <Sun size={80} className="text-sun-500 mx-auto mb-4 animate-pulse" />
              <h1 className="text-3xl font-bold text-white mb-2">
                公寓日照投诉复盘系统
              </h1>
              <p className="text-gray-400 max-w-md">
                基于WebGL的交互式日照分析工具，帮助物业管理人员直观分析和解释日照遮挡问题
              </p>
            </div>

            <button
              onClick={loadSampleData}
              className="px-8 py-4 bg-sun-500 hover:bg-sun-600 text-white rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-lg shadow-sun-500/30"
            >
              导入样例数据开始分析
            </button>

            <div className="mt-8 grid grid-cols-3 gap-4 max-w-lg mx-auto">
              <div className="glass-panel rounded-lg p-4">
                <div className="text-sun-500 text-2xl font-bold">3D</div>
                <div className="text-gray-400 text-xs">楼栋可视化</div>
              </div>
              <div className="glass-panel rounded-lg p-4">
                <div className="text-sun-500 text-2xl font-bold">实时</div>
                <div className="text-gray-400 text-xs">遮挡计算</div>
              </div>
              <div className="glass-panel rounded-lg p-4">
                <div className="text-sun-500 text-2xl font-bold">报告</div>
                <div className="text-gray-400 text-xs">一键导出</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isDataLoaded && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30">
          <div className="glass-panel rounded-lg px-4 py-2 text-xs text-gray-400">
            鼠标左键：旋转视角 · 鼠标右键：平移 · 滚轮：缩放 · 点击窗户：选择分析
          </div>
        </div>
      )}
    </div>
  );
}