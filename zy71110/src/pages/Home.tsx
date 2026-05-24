import { useState, useCallback } from 'react';
import { Scene } from '../scene/Scene';
import { ControlPanel } from '../components/ControlPanel';
import { ReportPanel } from '../components/ReportPanel';
import { Timeline } from '../components/Timeline';

export default function Home() {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  const handleCanvasReady = useCallback((canvasEl: HTMLCanvasElement) => {
    setCanvas(canvasEl);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100 overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        <ControlPanel />
        
        <div className="flex-1 relative">
          <Scene onCanvasReady={handleCanvasReady} />
          
          <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded-lg text-sm">
            <p className="font-medium">操作提示</p>
            <p className="text-xs text-gray-300">鼠标拖拽旋转 | 滚轮缩放 | 点击喷头选中拖拽</p>
          </div>
        </div>
        
        <ReportPanel canvas={canvas} />
      </div>
      
      <Timeline />
    </div>
  );
}
