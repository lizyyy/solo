import { useState } from 'react';
import { useStore } from '../store/useStore';
import { jsPDF } from 'jspdf';

export function InfoPanel() {
  const [expandedSection, setExpandedSection] = useState<string | null>('stats');
  
  const coverageStats = useStore(state => state.coverageStats);
  const blindSpots = useStore(state => state.blindSpots);
  const selectedBlindSpot = useStore(state => state.selectedBlindSpot);
  const selectedWatchtower = useStore(state => state.selectedWatchtower);
  const selectedRoute = useStore(state => state.selectedRoute);
  const watchtowers = useStore(state => state.watchtowers);
  const routes = useStore(state => state.routes);
  const season = useStore(state => state.season);
  
  const selectBlindSpot = useStore(state => state.selectBlindSpot);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const selectedTower = watchtowers.find(t => t.id === selectedWatchtower);
  const selectedRouteData = routes.find(r => r.id === selectedRoute);
  const selectedBlindSpotData = blindSpots.find(b => b.id === selectedBlindSpot);

  const exportReport = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(34, 139, 34);
    doc.text('森林瞭望覆盖分析报告', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, 20, 35);
    doc.text(`当前季节: ${season.name}`, 20, 45);
    doc.text(`树高系数: ${Math.round(season.treeHeightFactor * 100)}%`, 20, 55);
    
    doc.setFontSize(14);
    doc.setTextColor(34, 139, 34);
    doc.text('覆盖统计', 20, 70);
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`总区域面积: ${coverageStats.totalArea.toFixed(2)} ㎡`, 25, 80);
    doc.text(`已覆盖面积: ${coverageStats.coveredArea.toFixed(2)} ㎡`, 25, 90);
    doc.text(`覆盖率: ${(coverageStats.coverageRate * 100).toFixed(1)}%`, 25, 100);
    doc.text(`盲区数量: ${coverageStats.blindSpotCount} 个`, 25, 110);
    doc.text(`盲区总面积: ${coverageStats.blindSpotArea.toFixed(2)} ㎡`, 25, 120);
    
    doc.setFontSize(14);
    doc.setTextColor(34, 139, 34);
    doc.text('盲区详情', 20, 140);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const highSeverity = blindSpots.filter(b => b.severity === 'high');
    const mediumSeverity = blindSpots.filter(b => b.severity === 'medium');
    const lowSeverity = blindSpots.filter(b => b.severity === 'low');
    
    doc.text(`高优先级盲区: ${highSeverity.length} 个`, 25, 150);
    doc.text(`中优先级盲区: ${mediumSeverity.length} 个`, 25, 160);
    doc.text(`低优先级盲区: ${lowSeverity.length} 个`, 25, 170);
    
    doc.setFontSize(14);
    doc.setTextColor(34, 139, 34);
    doc.text('巡护建议', 20, 190);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const recommendations = [
      '1. 建议优先巡查高优先级盲区区域',
      '2. 夏季树木茂盛，注意树冠遮挡视线',
      '3. 重点关注山脊背面的地形盲区',
      '4. 建议在盲区增设临时观察点',
      '5. 定期更新巡护路线以覆盖新盲区'
    ];
    
    recommendations.forEach((rec, i) => {
      doc.text(rec, 25, 200 + i * 8);
    });
    
    doc.save('森林瞭望覆盖分析报告.pdf');
  };

  const exportJSON = () => {
    const data = {
      generatedAt: new Date().toISOString(),
      season,
      coverageStats,
      blindSpots,
      watchtowers: watchtowers.filter(t => t.enabled),
      routes: routes.filter(r => r.enabled)
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'forest-coverage-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getReasonText = (reason: string) => {
    switch (reason) {
      case 'terrain': return '地形遮挡';
      case 'trees': return '树木遮挡';
      case 'distance': return '距离过远';
      default: return reason;
    }
  };

  const getSeverityText = (severity: string) => {
    switch (severity) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return severity;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="w-72 bg-gray-900 bg-opacity-95 text-white h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold text-forest-400">📊 信息面板</h2>
      </div>

      <div className="p-4 border-b border-gray-700">
        <button
          onClick={exportReport}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors mb-2"
        >
          📄 导出PDF报告
        </button>
        <button
          onClick={exportJSON}
          className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium transition-colors"
        >
          💾 导出JSON数据
        </button>
      </div>

      <div className="border-b border-gray-700">
        <button
          onClick={() => toggleSection('stats')}
          className="w-full p-4 flex justify-between items-center hover:bg-gray-800 transition-colors"
        >
          <span className="font-medium">📈 覆盖统计</span>
          <span className="text-gray-400">{expandedSection === 'stats' ? '▼' : '▶'}</span>
        </button>
        {expandedSection === 'stats' && (
          <div className="p-4 pt-0 space-y-3">
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-gray-400 text-xs">覆盖率</div>
              <div className="text-2xl font-bold text-forest-400">
                {(coverageStats.coverageRate * 100).toFixed(1)}%
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                <div
                  className="bg-forest-500 h-2 rounded-full transition-all"
                  style={{ width: `${coverageStats.coverageRate * 100}%` }}
                ></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-gray-400 text-xs">已覆盖面积</div>
                <div className="text-lg font-bold text-blue-400">
                  {coverageStats.coveredArea.toFixed(0)}㎡
                </div>
              </div>
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-gray-400 text-xs">盲区数量</div>
                <div className="text-lg font-bold text-red-400">
                  {coverageStats.blindSpotCount}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {(selectedTower || selectedRouteData || selectedBlindSpotData) && (
        <div className="border-b border-gray-700">
          <div className="p-4 bg-forest-900 bg-opacity-50">
            <span className="font-medium text-forest-400">📍 选中详情</span>
          </div>
          <div className="p-4 space-y-2 text-sm">
            {selectedTower && (
              <>
                <div><span className="text-gray-400">类型:</span> 瞭望塔</div>
                <div><span className="text-gray-400">名称:</span> {selectedTower.name}</div>
                <div><span className="text-gray-400">塔高:</span> {selectedTower.height}m</div>
                <div><span className="text-gray-400">视距:</span> {selectedTower.viewDistance}m</div>
                <div><span className="text-gray-400">位置:</span> ({selectedTower.position.x.toFixed(1)}, {selectedTower.position.z.toFixed(1)})</div>
              </>
            )}
            {selectedRouteData && (
              <>
                <div><span className="text-gray-400">类型:</span> 巡护路线</div>
                <div><span className="text-gray-400">名称:</span> {selectedRouteData.name}</div>
                <div><span className="text-gray-400">点数:</span> {selectedRouteData.points.length}</div>
                <div><span className="text-gray-400">覆盖评分:</span> {selectedRouteData.coverageScore}%</div>
              </>
            )}
            {selectedBlindSpotData && (
              <>
                <div><span className="text-gray-400">类型:</span> 盲区</div>
                <div><span className="text-gray-400">优先级:</span> <span className={getSeverityColor(selectedBlindSpotData.severity)}>{getSeverityText(selectedBlindSpotData.severity)}</span></div>
                <div><span className="text-gray-400">原因:</span> {getReasonText(selectedBlindSpotData.reason)}</div>
                <div><span className="text-gray-400">面积:</span> {selectedBlindSpotData.area}㎡</div>
              </>
            )}
          </div>
        </div>
      )}

      <div>
        <button
          onClick={() => toggleSection('blindspots')}
          className="w-full p-4 flex justify-between items-center hover:bg-gray-800 transition-colors"
        >
          <span className="font-medium">🚩 盲区列表 ({blindSpots.length})</span>
          <span className="text-gray-400">{expandedSection === 'blindspots' ? '▼' : '▶'}</span>
        </button>
        {expandedSection === 'blindspots' && (
          <div className="p-4 pt-0 space-y-2 max-h-64 overflow-y-auto">
            {blindSpots.map(spot => (
              <div
                key={spot.id}
                className={`p-2 rounded cursor-pointer transition-colors text-sm ${
                  selectedBlindSpot === spot.id
                    ? 'bg-forest-700'
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
                onClick={() => selectBlindSpot(spot.id)}
              >
                <div className="flex items-center justify-between">
                  <span className={getSeverityColor(spot.severity)}>
                    ● {getSeverityText(spot.severity)}优先级
                  </span>
                  <span className="text-xs text-gray-400">{getReasonText(spot.reason)}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  面积: {spot.area}㎡
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
