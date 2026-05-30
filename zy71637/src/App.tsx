import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TopToolbar } from './components/layout/TopToolbar';
import { LeftPanel } from './components/layout/LeftPanel';
import { RightPanel } from './components/layout/RightPanel';
import { Timeline } from './components/layout/Timeline';
import { DepthCube } from './components/viewer3d/DepthCube';
import { ToastContainer } from './components/ui/ToastContainer';
import { useDataStore } from './store/useDataStore';
import { useUIStore } from './store/useUIStore';
import { generateMockOrderBookData } from './utils/mockData';

const App: React.FC = () => {
  const { setRawSnapshots } = useDataStore();
  const { showToast } = useUIStore();

  useEffect(() => {
    const initWithMockData = async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const mockData = generateMockOrderBookData({
        snapshotCount: 60,
        nullValueRate: 0.08,
        duplicateRate: 0.05,
        outlierRate: 0.06,
        includeMisalignment: true,
        includeTimeGrainChaos: true,
        includeNullValues: true,
        includeDuplicates: true,
        includeOutliers: true,
        includeDuplicateCancellation: true,
      });

      setRawSnapshots(mockData.snapshots, mockData.anomalies);
      showToast('info', `已加载 ${mockData.snapshots.length} 条盘口快照，包含 ${mockData.anomalies.length} 个预设异常`);
    };

    initWithMockData();
  }, [setRawSnapshots, showToast]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-950 text-white flex flex-col">
      <TopToolbar />
      
      <div className="flex-1 relative overflow-hidden">
        <LeftPanel />
        
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <DepthCube />
        </motion.div>

        <RightPanel />
      </div>

      <Timeline />
      
      <ToastContainer />

      <AnimatePresence>
        <motion.div
          className="fixed bottom-32 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-800/80 backdrop-blur-md rounded-full text-xs text-slate-400 border border-slate-700/50 pointer-events-none"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 2, duration: 0.5 }}
        >
          <span className="hidden sm:inline">鼠标左键旋转 • 滚轮缩放 • Shift+左键平移 • 点击立方体查看详情</span>
          <span className="sm:hidden">点击查看详情 • 双指缩放</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default App;
