import { useEffect } from 'react';
import { useAppStore } from '@/store';
import { CityScene } from '@/scenes/CityScene';
import { LeftPanel } from '@/components/panels/LeftPanel';
import { RightPanel } from '@/components/panels/RightPanel';
import { TimelineController } from '@/components/timeline/TimelineController';
import { defaultMission } from '@/data/mockMissions';

export default function Home() {
  const { setCurrentMission, currentMission } = useAppStore();

  useEffect(() => {
    if (!currentMission) {
      setCurrentMission(defaultMission);
    }
  }, [currentMission, setCurrentMission]);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        <LeftPanel />
        
        <div className="flex-1 relative">
          <CityScene />
          
          <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-sm rounded-lg p-3 border border-slate-700">
            <h2 className="text-sm font-medium text-white mb-1">操作提示</h2>
            <ul className="text-xs text-slate-400 space-y-0.5">
              <li>🖱️ 左键拖动 - 旋转视角</li>
              <li>🖱️ 右键拖动 - 平移视角</li>
              <li>🖱️ 滚轮 - 缩放</li>
              <li>📍 点击航点 - 选中并拖拽编辑</li>
            </ul>
          </div>

          {currentMission && (
            <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-sm rounded-lg p-3 border border-slate-700">
              <h3 className="text-sm font-medium text-white">{currentMission.name}</h3>
              <p className="text-xs text-slate-400 mt-1">{currentMission.description}</p>
            </div>
          )}
        </div>
        
        <RightPanel />
      </div>
      
      <TimelineController />
    </div>
  );
}
