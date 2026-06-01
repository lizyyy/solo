import { Toolbar } from '../components/Toolbar/Toolbar';
import { PointList } from '../components/PointList/PointList';
import { DetailPanel } from '../components/DetailPanel/DetailPanel';
import { Scene3D } from '../components/Scene3D/Scene3D';

export default function Home() {
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900 overflow-hidden">
      <Toolbar />
      
      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 flex-shrink-0 border-r border-slate-700">
          <PointList />
        </div>
        
        <div id="main-canvas" className="flex-1 relative">
          <Scene3D />
          
          <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur rounded-lg px-4 py-3 text-sm text-white">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-slate-300">正常</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span className="text-slate-300">待确认</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="text-slate-300">异常</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              鼠标左键旋转 | 右键平移 | 滚轮缩放
            </div>
          </div>

          <div className="absolute top-4 left-4 bg-blue-600/90 backdrop-blur rounded-lg px-3 py-2 text-xs text-white">
            <span className="font-semibold">剧场灯位安全网</span>
            <span className="ml-2 text-blue-200">GIS 空间核对工具</span>
          </div>
        </div>
        
        <div className="w-80 flex-shrink-0 border-l border-slate-700">
          <DetailPanel />
        </div>
      </div>
    </div>
  );
}