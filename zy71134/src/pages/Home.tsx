import React, { useEffect } from 'react';
import { Layers, Info } from 'lucide-react';
import { Scene3D } from '../components/Scene3D';
import { LeftPanel } from '../components/LeftPanel';
import { RightPanel } from '../components/RightPanel';
import { BottomBar } from '../components/BottomBar';
import { useAppStore } from '../store/useAppStore';
import { useScreenSize } from '../hooks/useScreenSize';

const Home: React.FC = () => {
  const { isMobile, isTablet } = useScreenSize();
  const {
    leftPanelOpen,
    rightPanelOpen,
    setLeftPanelOpen,
    setRightPanelOpen,
    toggleLeftPanel,
    toggleRightPanel,
  } = useAppStore();

  useEffect(() => {
    if (leftPanelOpen === undefined || rightPanelOpen === undefined) {
      setLeftPanelOpen(!isMobile);
      setRightPanelOpen(!isMobile);
    }
  }, [isMobile, leftPanelOpen, rightPanelOpen, setLeftPanelOpen, setRightPanelOpen]);

  const actualLeftOpen = leftPanelOpen ?? !isMobile;
  const actualRightOpen = rightPanelOpen ?? !isMobile;

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-100 flex flex-col">
      <header className="h-12 sm:h-14 bg-white border-b border-gray-200 flex items-center justify-between px-3 sm:px-4 z-30">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm sm:text-lg font-bold text-gray-800">医院氧气管线系统</h1>
            <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">交互式3D可视化培训系统</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {isMobile && (
            <>
              <button
                onClick={toggleLeftPanel}
                className={`p-2 rounded-lg transition-colors ${
                  actualLeftOpen ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Layers size={18} />
              </button>
              <button
                onClick={toggleRightPanel}
                className={`p-2 rounded-lg transition-colors ${
                  actualRightOpen ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Info size={18} />
              </button>
            </>
          )}
          <div className="hidden md:flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              系统运行正常
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 relative">
        <LeftPanel isOpen={actualLeftOpen} onToggle={toggleLeftPanel} />
        <RightPanel isOpen={actualRightOpen} onToggle={toggleRightPanel} />
        <Scene3D className="absolute inset-0" />
        
        <div className={`absolute top-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-md z-10 transition-all ${
          (actualLeftOpen && !isMobile) || (actualRightOpen && !isMobile) ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}>
          <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500" />
              <span className="hidden sm:inline">开启</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500" />
              <span className="hidden sm:inline">关闭</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-500" />
              <span className="hidden sm:inline">检修中</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-orange-500" />
              <span className="hidden sm:inline">过期</span>
            </span>
          </div>
        </div>
      </div>

      <BottomBar />
    </div>
  );
};

export default Home;
