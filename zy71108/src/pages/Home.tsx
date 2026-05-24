import { useEffect } from 'react';
import Scene from '../components/three/Scene';
import TopToolbar from '../components/ui/TopToolbar';
import LeftPanel from '../components/ui/LeftPanel';
import RightPanel from '../components/ui/RightPanel';
import Timeline from '../components/ui/Timeline';
import { useSceneStore } from '../store/useSceneStore';

export function Home() {
  const { isDataLoaded } = useSceneStore();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.export-menu')) {
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="w-full h-screen bg-gray-900 relative overflow-hidden">
      <div className="absolute inset-0">
        <Scene />
      </div>

      <TopToolbar />
      <LeftPanel />
      <RightPanel />
      <Timeline />

      {!isDataLoaded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="mb-6">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-blue-600/20 flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">滑雪道风险路线回放系统</h1>
              <p className="text-gray-400 text-lg">交互式 3D 可视化分析平台</p>
            </div>
            <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl p-6 max-w-md mx-auto border border-gray-700/50 pointer-events-auto">
              <h2 className="text-white font-semibold mb-4">开始使用</h2>
              <p className="text-gray-300 text-sm mb-4">
                点击顶部工具栏的「加载样例」按钮，即可查看演示数据。
                您也可以导入自定义 JSON 数据文件。
              </p>
              <div className="grid grid-cols-2 gap-3 text-left text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <span className="w-2 h-2 bg-blue-500 rounded-full" />
                  3D 地形可视化
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  轨迹动态回放
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <span className="w-2 h-2 bg-orange-500 rounded-full" />
                  风险区域分层
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <span className="w-2 h-2 bg-red-500 rounded-full" />
                  救援路线规划
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
