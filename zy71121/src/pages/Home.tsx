import { Scene3D } from '../components/Canvas3D/Scene3D';
import { PlantControls } from '../components/ControlPanel/PlantControls';
import { LightControls } from '../components/ControlPanel/LightControls';
import { RobotControls } from '../components/ControlPanel/RobotControls';
import { Toolbar } from '../components/Toolbar/Toolbar';
import { InfoPanel } from '../components/InfoPanel/InfoPanel';

export default function Home() {
  return (
    <div className="w-full h-screen bg-gray-100 relative overflow-hidden">
      <div className="absolute inset-0">
        <Scene3D />
      </div>
      
      <Toolbar />
      
      <div className="absolute left-4 top-20 bottom-4 w-72 z-10 overflow-y-auto space-y-4 pr-2">
        <PlantControls />
        <LightControls />
        <RobotControls />
      </div>
      
      <InfoPanel />
      
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg">
          <div className="text-xs text-gray-500 text-center">
            <span className="font-medium">操作提示：</span>
            鼠标左键拖拽旋转 · 滚轮缩放 · 右键平移
          </div>
        </div>
      </div>
    </div>
  );
}
