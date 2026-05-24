import { useState } from 'react';
import { useStore } from '../store/useStore';
import { SEASONS } from '../data/seasons';

export function ControlPanel() {
  const [expandedSection, setExpandedSection] = useState<string | null>('watchtowers');
  
  const watchtowers = useStore(state => state.watchtowers);
  const routes = useStore(state => state.routes);
  const season = useStore(state => state.season);
  const showCoverage = useStore(state => state.showCoverage);
  const showBlindSpots = useStore(state => state.showBlindSpots);
  const showRoutes = useStore(state => state.showRoutes);
  const showTrees = useStore(state => state.showTrees);
  const showFirePoints = useStore(state => state.showFirePoints);
  const selectedWatchtower = useStore(state => state.selectedWatchtower);
  const selectedRoute = useStore(state => state.selectedRoute);
  
  const toggleWatchtower = useStore(state => state.toggleWatchtower);
  const toggleRoute = useStore(state => state.toggleRoute);
  const selectWatchtower = useStore(state => state.selectWatchtower);
  const selectRoute = useStore(state => state.selectRoute);
  const setSeason = useStore(state => state.setSeason);
  const setShowCoverage = useStore(state => state.setShowCoverage);
  const setShowBlindSpots = useStore(state => state.setShowBlindSpots);
  const setShowRoutes = useStore(state => state.setShowRoutes);
  const setShowTrees = useStore(state => state.setShowTrees);
  const setShowFirePoints = useStore(state => state.setShowFirePoints);
  const resetState = useStore(state => state.resetState);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target?.result as string);
            console.log('Imported data:', data);
            alert('数据导入成功！');
          } catch {
            alert('数据格式错误！');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div className="w-72 bg-gray-900 bg-opacity-95 text-white h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold text-forest-400">🌲 森林瞭望覆盖图</h2>
        <p className="text-xs text-gray-400 mt-1">巡护路线分析系统</p>
      </div>

      <div className="p-4 border-b border-gray-700">
        <button
          onClick={handleImportData}
          className="w-full py-2 px-4 bg-forest-600 hover:bg-forest-500 rounded text-sm font-medium transition-colors"
        >
          📁 导入样例数据
        </button>
        <button
          onClick={resetState}
          className="w-full mt-2 py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium transition-colors"
        >
          🔄 重置状态
        </button>
      </div>

      <div className="border-b border-gray-700">
        <button
          onClick={() => toggleSection('season')}
          className="w-full p-4 flex justify-between items-center hover:bg-gray-800 transition-colors"
        >
          <span className="font-medium">🌸 季节设置</span>
          <span className="text-gray-400">{expandedSection === 'season' ? '▼' : '▶'}</span>
        </button>
        {expandedSection === 'season' && (
          <div className="p-4 pt-0 space-y-2">
            {SEASONS.map(s => (
              <button
                key={s.id}
                onClick={() => setSeason(s)}
                className={`w-full py-2 px-3 rounded text-left text-sm transition-colors ${
                  season.id === s.id
                    ? 'bg-forest-600 text-white'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                }`}
              >
                <span style={{ color: s.color }}>●</span> {s.name}
                <span className="text-xs text-gray-400 ml-2">
                  树高: {Math.round(s.treeHeightFactor * 100)}%
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-b border-gray-700">
        <button
          onClick={() => toggleSection('watchtowers')}
          className="w-full p-4 flex justify-between items-center hover:bg-gray-800 transition-colors"
        >
          <span className="font-medium">🗼 瞭望塔 ({watchtowers.filter(t => t.enabled).length})</span>
          <span className="text-gray-400">{expandedSection === 'watchtowers' ? '▼' : '▶'}</span>
        </button>
        {expandedSection === 'watchtowers' && (
          <div className="p-4 pt-0 space-y-2">
            {watchtowers.map(tower => (
              <div
                key={tower.id}
                className={`p-3 rounded cursor-pointer transition-colors ${
                  selectedWatchtower === tower.id
                    ? 'bg-forest-700'
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
                onClick={() => selectWatchtower(tower.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{tower.name}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tower.enabled}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleWatchtower(tower.id);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-forest-500"></div>
                  </label>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  视距: {tower.viewDistance}m | 塔高: {tower.height}m
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-b border-gray-700">
        <button
          onClick={() => toggleSection('routes')}
          className="w-full p-4 flex justify-between items-center hover:bg-gray-800 transition-colors"
        >
          <span className="font-medium">🛤️ 巡护路线 ({routes.filter(r => r.enabled).length})</span>
          <span className="text-gray-400">{expandedSection === 'routes' ? '▼' : '▶'}</span>
        </button>
        {expandedSection === 'routes' && (
          <div className="p-4 pt-0 space-y-2">
            {routes.map(route => (
              <div
                key={route.id}
                className={`p-3 rounded cursor-pointer transition-colors ${
                  selectedRoute === route.id
                    ? 'bg-forest-700'
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
                onClick={() => selectRoute(route.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: route.color }}
                    ></span>
                    <span className="text-sm font-medium">{route.name}</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={route.enabled}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleRoute(route.id);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-forest-500"></div>
                  </label>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  覆盖评分: {route.coverageScore}%
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <button
          onClick={() => toggleSection('display')}
          className="w-full p-4 flex justify-between items-center hover:bg-gray-800 transition-colors"
        >
          <span className="font-medium">👁️ 显示选项</span>
          <span className="text-gray-400">{expandedSection === 'display' ? '▼' : '▶'}</span>
        </button>
        {expandedSection === 'display' && (
          <div className="p-4 pt-0 space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">覆盖范围</span>
              <input
                type="checkbox"
                checked={showCoverage}
                onChange={(e) => setShowCoverage(e.target.checked)}
                className="w-4 h-4 accent-forest-500"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">盲区标注</span>
              <input
                type="checkbox"
                checked={showBlindSpots}
                onChange={(e) => setShowBlindSpots(e.target.checked)}
                className="w-4 h-4 accent-forest-500"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">巡护路线</span>
              <input
                type="checkbox"
                checked={showRoutes}
                onChange={(e) => setShowRoutes(e.target.checked)}
                className="w-4 h-4 accent-forest-500"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">树木</span>
              <input
                type="checkbox"
                checked={showTrees}
                onChange={(e) => setShowTrees(e.target.checked)}
                className="w-4 h-4 accent-forest-500"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">火点样例</span>
              <input
                type="checkbox"
                checked={showFirePoints}
                onChange={(e) => setShowFirePoints(e.target.checked)}
                className="w-4 h-4 accent-forest-500"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
