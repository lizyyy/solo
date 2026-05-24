import { useEffect } from 'react';
import { CampusScene } from '../components/scene/CampusScene';
import { ControlPanel } from '../components/control/ControlPanel';
import { InfoPanel } from '../components/info/InfoPanel';
import { useAppStore } from '../store/useAppStore';
import { useRoutePlanning } from '../hooks/useRoutePlanning';

export default function Home() {
  const { campusData, loadSampleData, isLoading } = useAppStore();
  useRoutePlanning();

  useEffect(() => {
    if (!campusData) {
      loadSampleData();
    }
  }, [campusData, loadSampleData]);

  return (
    <div className="relative w-full h-screen bg-gray-900 overflow-hidden">
      <div className="absolute inset-0">
        <CampusScene campusData={campusData} />
      </div>

      <ControlPanel />
      <InfoPanel />

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
        <div className="px-6 py-3 bg-gray-900/90 backdrop-blur-md rounded-2xl border border-gray-700/50 shadow-2xl">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-gray-300">
                {campusData ? campusData.name : '加载中...'}
              </span>
            </div>
            <div className="w-px h-4 bg-gray-700" />
            <span className="text-gray-500">
              {campusData ? `v${campusData.version}` : ''}
            </span>
            {isLoading && (
              <>
                <div className="w-px h-4 bg-gray-700" />
                <span className="text-blue-400">规划路线中...</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <h1 className="text-2xl font-bold text-white drop-shadow-lg flex items-center gap-2">
          <span className="text-3xl">♿</span>
          校园无障碍路线规划系统
        </h1>
      </div>
    </div>
  );
}
