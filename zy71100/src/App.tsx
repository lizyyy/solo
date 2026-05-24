import { Toolbar } from './components/Toolbar';
import { SidebarLeft } from './components/SidebarLeft';
import { SidebarRight } from './components/SidebarRight';
import { Timeline } from './components/Timeline';
import { Viewport3D } from './components/Viewport3D';

function App() {
  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-950 relative">
      <Toolbar />
      <SidebarLeft />
      <SidebarRight />
      <Timeline />
      <Viewport3D />

      <div className="absolute bottom-28 left-4 text-xs text-slate-500 z-10 pointer-events-none">
        <div>🖱️ 左键拖拽旋转 · 滚轮缩放 · 右键平移</div>
      </div>
    </div>
  );
}

export default App;
