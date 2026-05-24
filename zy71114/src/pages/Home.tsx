import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { GarageScene } from '../scenes/GarageScene';
import { ControlPanel } from '../components/ControlPanel';
import { Timeline } from '../components/Timeline';
import { InfoPanel } from '../components/InfoPanel';

export default function Home() {
  const {
    selectedGarage,
    selectedVehicle,
    riskPoints,
    cameraPreset,
    showRiskMarkers,
    showMeasurements,
    simulation,
    togglePlay,
  } = useAppStore();

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 relative">
      <div
        className={`absolute inset-0 transition-all duration-300 ${
          isMobile ? 'pb-0' : 'pb-16'
        }`}
      >
        <GarageScene
          garage={selectedGarage}
          vehicle={selectedVehicle}
          riskPoints={riskPoints}
          cameraPreset={cameraPreset}
          showRiskMarkers={showRiskMarkers}
          showMeasurements={showMeasurements}
        />
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-black/50 backdrop-blur-sm text-white px-6 py-2 rounded-full text-sm font-medium flex items-center gap-3">
          <span className="text-gray-300">{selectedGarage.name}</span>
          <span className="w-px h-4 bg-gray-600" />
          <span className="text-gray-300">{selectedVehicle.name}</span>
          <span
            className={`w-2 h-2 rounded-full ${
              simulation.isPlaying ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
            }`}
          />
        </div>
      </div>

      {!isMobile && (
        <>
          <ControlPanel />
          <InfoPanel />
          <Timeline />
        </>
      )}

      {isMobile && (
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <div className="bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 p-3">
            <div className="flex items-center justify-around mb-3">
              <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white">
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <span className="text-xs">车库</span>
              </button>
              <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white">
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <span className="text-xs">视角</span>
              </button>
              <button
                onClick={togglePlay}
                className={`flex flex-col items-center gap-1 ${
                  simulation.isPlaying ? 'text-blue-400' : 'text-green-400'
                }`}
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center ${
                    simulation.isPlaying ? 'bg-blue-600' : 'bg-green-600'
                  }`}
                >
                  {simulation.isPlaying ? (
                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </div>
                <span className="text-xs">{simulation.isPlaying ? '暂停' : '播放'}</span>
              </button>
              <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white">
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <span className="text-xs">报告</span>
              </button>
              <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white">
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <span className="text-xs">设置</span>
              </button>
            </div>
            <div className="relative">
              <input
                type="range"
                min="0"
                max="1"
                step="0.001"
                value={simulation.progress}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                onChange={(e) => useAppStore.getState().setProgress(parseFloat(e.target.value))}
              />
              <div
                className="absolute top-0 left-0 h-2 bg-gradient-to-r from-blue-500 to-blue-400 rounded-lg pointer-events-none"
                style={{ width: `${simulation.progress * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-20 left-4 z-10 hidden md:block">
        <div className="bg-black/50 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-lg space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-blue-500" />
            <span>鼠标拖拽: 旋转视角</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-green-500" />
            <span>滚轮: 缩放</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-yellow-500" />
            <span>双击: 重置视角</span>
          </div>
        </div>
      </div>
    </div>
  );
}
