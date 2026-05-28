import { useEffect, useRef, useState } from 'react';
import { Brain, AlertTriangle, Layers, RotateCcw } from 'lucide-react';
import { SliceStack3D } from '@/components/viewer/SliceStack3D';
import { WindowControl } from '@/components/controls/WindowControl';
import { SliceFilter } from '@/components/controls/SliceFilter';
import { ThicknessControl } from '@/components/controls/ThicknessControl';
import { AnnotationPanel } from '@/components/annotation/AnnotationPanel';
import { HistoryPanel } from '@/components/collaboration/HistoryPanel';
import { ScreenshotExporter } from '@/components/export/ScreenshotExporter';
import { useAppStore } from '@/store/useAppStore';
import { generateSampleSlices, generateSampleAnnotations, generateSampleCaseNotes } from '@/utils/mriGenerator';

export const Workbench = () => {
  const { initializeSlices, addAnnotation, addCaseNote, slices } = useAppStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (isInitialized) return;

    const sampleSlices = generateSampleSlices(24);
    initializeSlices(sampleSlices);

    setTimeout(() => {
      const sampleAnnotations = generateSampleAnnotations(sampleSlices);
      sampleAnnotations.forEach((annotation) => {
        addAnnotation(annotation);
      });

      const sampleNotes = generateSampleCaseNotes();
      sampleNotes.forEach((note) => {
        addCaseNote(note);
      });
    }, 100);

    setIsInitialized(true);
  }, [initializeSlices, addAnnotation, addCaseNote, isInitialized]);

  const handleCanvasReady = (canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  };

  const errorCount = slices.filter((s) => s.hasError).length;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">MRI 3D 工作台</h1>
              <p className="text-xs text-slate-400">医学物理课 · 核磁共振切片分析</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {errorCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-xs text-red-400">{errorCount} 个问题待处理</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 rounded-lg">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-300">{slices.length} 层切片</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-65px)]">
        <aside className="w-72 bg-slate-800/50 border-r border-slate-700 p-4 overflow-y-auto space-y-4">
          <WindowControl />
          <ThicknessControl />
          <SliceFilter />
          <ScreenshotExporter canvasRef={canvasRef} />
        </aside>

        <main className="flex-1 relative">
          <div className="absolute inset-0">
            <SliceStack3D onCanvasReady={handleCanvasReady} />
          </div>

          <div className="absolute bottom-4 left-4 right-4 flex justify-center">
            <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl px-4 py-2 border border-slate-700">
              <div className="flex items-center gap-6 text-xs text-slate-400">
                <span>🖱️ 拖拽旋转</span>
                <span>🔍 滚轮缩放</span>
                <span>📍 点击切片选择</span>
              </div>
            </div>
          </div>

          <div className="absolute top-4 left-4">
            <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700">
              <div className="text-xs text-slate-500 mb-1">操作提示</div>
              <div className="text-xs text-slate-300">
                使用左侧面板调整窗宽窗位，点击切片添加标注
              </div>
            </div>
          </div>
        </main>

        <aside className="w-80 bg-slate-800/50 border-l border-slate-700 p-4 overflow-y-auto space-y-4">
          <AnnotationPanel />
          <HistoryPanel />
        </aside>
      </div>
    </div>
  );
};
