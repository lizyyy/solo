import { motion } from 'framer-motion';
import { Toolbar } from '../components/editor/Toolbar';
import { EditorCanvas } from '../components/editor/EditorCanvas';
import { ParameterPanel } from '../components/editor/ParameterPanel';
import { useEditorStore } from '../store/useEditorStore';
import { Lightbulb } from 'lucide-react';

export function TrackEditor() {
  const { currentSampleId } = useEditorStore();

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      <Toolbar />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
          {!currentSampleId && useEditorStore.getState().trackElements.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 card border-plasma-blue/30 bg-plasma-blue/5 max-w-md text-center"
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <Lightbulb className="w-5 h-5 text-plasma-blue" />
                <span className="font-display font-bold text-white">开始设计</span>
              </div>
              <p className="font-mono text-xs text-tech-light">
                从左侧工具栏拖拽轨道片和磁场块到画布上，设计你的粒子加速器。
                或从样例库加载预置场景开始学习。
              </p>
            </motion.div>
          )}

          <EditorCanvas />
        </div>

        <ParameterPanel />
      </div>
    </div>
  );
}
