import { ControlPanel } from './components/ControlPanel';
import { Timeline } from './components/Timeline';
import { InfoPanel } from './components/InfoPanel';
import { Scene } from './scene/Scene';

function App() {
  return (
    <div className="h-screen w-screen flex flex-col bg-gray-950 overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        <ControlPanel />
        
        <div className="flex-1 relative">
          <Scene />
          
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
            <div className="bg-gray-900 bg-opacity-80 px-6 py-2 rounded-full">
              <span className="text-white text-sm font-medium">
                🌲 森林瞭望覆盖分析系统 - 点击地图元素查看详情
              </span>
            </div>
          </div>
          
          <div className="absolute bottom-24 left-4 z-10">
            <div className="bg-gray-900 bg-opacity-80 p-3 rounded-lg text-white text-xs space-y-2">
              <div className="font-medium mb-2">图例</div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-500 opacity-50 mr-2 rounded"></div>
                <span>覆盖区域</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-red-500 opacity-50 mr-2 rounded"></div>
                <span>盲区</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-500 mr-2 rounded-full"></div>
                <span>巡护路线</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-orange-500 mr-2" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}></div>
                <span>瞭望塔</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-red-500 mr-2" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}></div>
                <span>火点</span>
              </div>
            </div>
          </div>
        </div>
        
        <InfoPanel />
      </div>
      
      <Timeline />
    </div>
  );
}

export default App;
