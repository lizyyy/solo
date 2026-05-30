import FilterToolbar from '../components/toolbar/FilterToolbar';
import PianoKeyboard3D from '../components/piano3d/PianoKeyboard3D';
import DataPanel from '../components/panels/DataPanel';

export default function Home() {
  return (
    <div className="h-screen w-screen bg-zinc-950 overflow-hidden flex">
      <div className="flex-1 relative">
        <FilterToolbar />
        <PianoKeyboard3D />
        
        <div className="absolute bottom-4 left-4 bg-zinc-900/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-zinc-700">
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>低压</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>正常</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>偏高</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>高压</span>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 right-4 bg-zinc-900/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-zinc-700">
          <p className="text-xs text-zinc-500">
            鼠标拖拽旋转 · 滚轮缩放 · 点击琴键查看详情
          </p>
        </div>
      </div>
      
      <DataPanel />
    </div>
  );
}
