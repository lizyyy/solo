import { useEffect } from 'react';
import { useWorkbenchStore } from '@/store/useWorkbenchStore';
import GuitarNeck3D from '@/components/GuitarNeck3D';
import StringInputPanel from '@/components/StringInputPanel';
import TensionResults from '@/components/TensionResults';
import AnomalyAlert from '@/components/AnomalyAlert';
import TuningComparison from '@/components/TuningComparison';
import { Guitar } from 'lucide-react';

export default function Home() {
  const recalculate = useWorkbenchStore(s => s.recalculate);

  useEffect(() => {
    recalculate();
  }, [recalculate]);

  return (
    <div className="h-screen w-screen bg-stone-950 text-stone-200 flex flex-col overflow-hidden">
      <header className="flex items-center gap-3 px-6 py-3 bg-stone-900/80 border-b border-stone-800/60 shrink-0">
        <Guitar size={24} className="text-amber-400" />
        <h1 className="text-lg font-bold tracking-wide" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
          吉他弦张力计算
        </h1>
        <span className="text-xs text-stone-500 ml-2">3D 工作台</span>
        <div className="flex-1" />
        <span className="text-[10px] text-stone-600 font-mono">T = 4μL²f²</span>
      </header>

      <div className="flex-1 flex min-h-0">
        <div className="w-[58%] relative bg-stone-950">
          <GuitarNeck3D />
          <div className="absolute bottom-3 left-3 bg-stone-900/70 backdrop-blur-sm rounded-lg px-3 py-1.5 text-[10px] text-stone-500 border border-stone-700/30">
            拖拽旋转 · 滚轮缩放 · 点击弦高亮
          </div>
        </div>

        <div className="w-[42%] flex flex-col border-l border-stone-800/60 bg-stone-900/40 overflow-y-auto">
          <div className="p-4 space-y-4">
            <AnomalyAlert />
            <TensionResults />
            <StringInputPanel />
            <TuningComparison />
          </div>
        </div>
      </div>
    </div>
  );
}
