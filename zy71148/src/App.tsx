import { Sidebar } from './components/ui/Sidebar';
import { StatusBar } from './components/ui/StatusBar';
import { Timeline } from './components/ui/Timeline';
import { ReportExport } from './components/ui/ReportExport';
import { SelectionTool } from './components/ui/SelectionTool';
import { Scene } from './components/three/Scene';

function App() {
  return (
    <div className="w-full h-full flex flex-col bg-slate-950">
      <StatusBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 relative">
          <Scene />
          <SelectionTool />
          <ReportExport />

          <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur rounded-lg p-3 text-xs">
            <div className="text-slate-400 mb-2">操作提示</div>
            <div className="space-y-1 text-slate-300">
              <div>🖱️ 左键拖拽: 旋转视角</div>
              <div>🖱️ 滚轮: 缩放</div>
              <div>🖱️ 右键拖拽: 平移</div>
            </div>
          </div>
        </div>
      </div>
      <Timeline />
    </div>
  );
}

export default App;
