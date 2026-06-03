import { useState, useRef } from 'react';
import { useAppContext } from '../../store/AppContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { getNodeById } from '../../utils/graphAlgorithms';
import { getStakeholderName } from '../../utils/dataUtils';
import { Map, BarChart3, Box, AlertTriangle, ArrowLeft, Eye } from 'lucide-react';
import type { DisplayMode } from '../../types';

interface GraphVisualizationProps {
  displayMode: DisplayMode;
  onModeChange: (mode: DisplayMode) => void;
  selectedResultId: string | null;
  onJumpToRecord: (recordId: string) => void;
}

export function GraphVisualization({
  displayMode,
  onModeChange,
  selectedResultId,
  onJumpToRecord,
}: GraphVisualizationProps) {
  const { state } = useAppContext();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);

  const selectedResult = state.comparisonResults.find(
    r => r.id === selectedResultId
  );

  const chartData = state.comparisonResults.map(result => {
    const record = state.parameterRecords.find(
      r => r.id === result.parameterRecordId
    );
    return {
      name: `${record?.sourceNode}→${record?.targetNode}`,
      最短路: result.shortestPath.totalWeight,
      备选路径: result.alternativePath.totalWeight,
      绕行比例: result.detourRatio || 0,
      阈值: result.thresholdUsed,
      isZeroDenom: result.status === 'zero_denominator',
      isSignificant: result.isSignificantDetour,
      recordId: result.parameterRecordId,
      resultId: result.id,
    };
  });

  const render2DGraph = () => {
    const width = 600;
    const height = 500;

    const highlightEdges = new Set<string>();
    const highlightNodes = new Set<string>();

    if (selectedResult) {
      selectedResult.shortestPath.edges.forEach(e => highlightEdges.add(e));
      selectedResult.alternativePath.edges.forEach(e => highlightEdges.add(e));
      selectedResult.shortestPath.nodes.forEach(n => highlightNodes.add(n));
      selectedResult.alternativePath.nodes.forEach(n => highlightNodes.add(n));
    }

    return (
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
          </marker>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {state.graph.edges.map(edge => {
          const sourceNode = getNodeById(state.graph.nodes, edge.source);
          const targetNode = getNodeById(state.graph.nodes, edge.target);
          if (!sourceNode || !targetNode) return null;

          const isHighlighted = highlightEdges.has(edge.id);
          const isShortestPath = selectedResult?.shortestPath.edges.includes(edge.id);
          const isAlternativePath = selectedResult?.alternativePath.edges.includes(edge.id);

          let strokeColor = '#cbd5e1';
          let strokeWidth = 2;
          let opacity = 0.6;

          if (isHighlighted) {
            opacity = 1;
            strokeWidth = 4;
            if (isShortestPath) {
              strokeColor = '#10b981';
            } else if (isAlternativePath) {
              strokeColor = '#f59e0b';
            }
          }

          const midX = (sourceNode.x + targetNode.x) / 2;
          const midY = (sourceNode.y + targetNode.y) / 2;

          return (
            <g key={edge.id}>
              <line
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                opacity={opacity}
                className="transition-all duration-300"
                onMouseEnter={() => setHoveredEdge(edge.id)}
                onMouseLeave={() => setHoveredEdge(null)}
                filter={isHighlighted ? 'url(#glow)' : undefined}
              />
              {hoveredEdge === edge.id && (
                <g>
                  <rect
                    x={midX - 30}
                    y={midY - 20}
                    width="60"
                    height="24"
                    fill="white"
                    stroke="#e2e8f0"
                    rx="4"
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
                  />
                  <text
                    x={midX}
                    y={midY - 4}
                    textAnchor="middle"
                    className="text-xs fill-gray-700 font-mono"
                  >
                    w={edge.weight}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {state.graph.nodes.map(node => {
          const isHighlighted = highlightNodes.has(node.id);
          const isSource = selectedResult && node.id === selectedResult.shortestPath.nodes[0];
          const isTarget = selectedResult && node.id === selectedResult.shortestPath.nodes[selectedResult.shortestPath.nodes.length - 1];

          let fillColor = '#6366f1';
          let radius = 20;

          if (isSource) {
            fillColor = '#10b981';
            radius = 25;
          } else if (isTarget) {
            fillColor = '#ef4444';
            radius = 25;
          } else if (isHighlighted) {
            fillColor = '#8b5cf6';
            radius = 22;
          }

          return (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={fillColor}
                className="transition-all duration-300"
                filter={isHighlighted ? 'url(#glow)' : undefined}
              />
              <text
                x={node.x}
                y={node.y + 5}
                textAnchor="middle"
                fill="white"
                fontSize="14"
                fontWeight="bold"
              >
                {node.id}
              </text>
              <text
                x={node.x}
                y={node.y + 40}
                textAnchor="middle"
                fill="#64748b"
                fontSize="11"
              >
                {node.label}
              </text>
            </g>
          );
        })}

        {selectedResult && (
          <g>
            <rect x="10" y="10" width="280" height="80" fill="white" stroke="#e2e8f0" rx="8" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))" />
            <circle cx="30" cy="35" r="6" fill="#10b981" />
            <text x="45" y="39" fontSize="12" fill="#374151">最短路（绿色）</text>
            <circle cx="30" cy="55" r="6" fill="#f59e0b" />
            <text x="45" y="59" fontSize="12" fill="#374151">备选路径（橙色）</text>
            <circle cx="30" cy="75" r="6" fill="#ef4444" />
            <text x="45" y="79" fontSize="12" fill="#374151">起点/终点</text>
          </g>
        )}
      </svg>
    );
  };

  const renderChart = () => (
    <div className="w-full h-full p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 11 }}
          />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                    <p className="font-semibold text-gray-800 mb-2">{data.name}</p>
                    {payload.map((entry, idx) => {
                      const value = entry.value;
                      const displayValue = typeof value === 'number' ? value.toFixed(2) : String(value ?? '');
                      return (
                        <p key={idx} className="text-sm" style={{ color: entry.color }}>
                          {entry.name}: {displayValue}
                        </p>
                      );
                    })}
                    {data.isZeroDenom && (
                      <p className="text-sm text-amber-600 mt-1">⚠️ 分母为0</p>
                    )}
                    {data.isSignificant && (
                      <p className="text-sm text-red-600 mt-1">🚨 显著绕行</p>
                    )}
                    <button
                      onClick={() => onJumpToRecord(data.recordId)}
                      className="mt-2 w-full px-3 py-1 bg-indigo-100 text-indigo-700 rounded text-xs hover:bg-indigo-200 transition-colors flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      查看参数
                    </button>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend />
          <ReferenceLine y={1.25} stroke="#ef4444" strokeDasharray="5 5" label="绕行阈值" />
          <Bar dataKey="最短路" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="备选路径" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const render3DView = () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8">
      <div className="text-center">
        <Box className="w-16 h-16 mx-auto mb-4 text-indigo-400" />
        <h3 className="text-xl font-bold mb-2">3D 拓扑视图</h3>
        <p className="text-gray-400 mb-6 max-w-md">
          3D 视图模式将节点和路径以三维形式展示。点击下方按钮可切换回 2D 视图或图表模式。
        </p>

        {selectedResult && (
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 mb-6 text-left max-w-md">
            {selectedResult.status === 'zero_denominator' && (
              <div className="mb-4 p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-amber-300 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-semibold">分母为0异常</span>
                </div>
                <p className="text-sm text-gray-300">
                  该记录分母为0，已留空显示。请返回参数调试表查看详细信息，或点击下方按钮跳转到参数记录。
                </p>
                <button
                  onClick={() => onJumpToRecord(selectedResult.parameterRecordId)}
                  className="mt-3 flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  返回参数调试表
                </button>
              </div>
            )}
            <h4 className="font-semibold mb-2">路径信息</h4>
            <p className="text-sm text-gray-300 mb-2">
              <span className="text-green-400">最短路：</span>
              {selectedResult.shortestPath.nodes.join(' → ')}
              <span className="text-gray-500 ml-2">({selectedResult.shortestPath.totalWeight.toFixed(2)})</span>
            </p>
            <p className="text-sm text-gray-300 mb-2">
              <span className="text-amber-400">备选路：</span>
              {selectedResult.alternativePath.nodes.join(' → ')}
              <span className="text-gray-500 ml-2">({selectedResult.alternativePath.totalWeight.toFixed(2)})</span>
            </p>
            <p className="text-sm text-gray-300">
              <span className="text-purple-400">绕行比例：</span>
              {selectedResult.detourRatio !== null
                ? `${selectedResult.detourRatio.toFixed(2)} 倍`
                : '无法计算'}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => onModeChange('list')}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm"
          >
            列表模式
          </button>
          <button
            onClick={() => onModeChange('chart')}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm"
          >
            图表模式
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden h-full">
      <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-cyan-600">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">可视化展示</h2>
            <p className="text-blue-100 text-sm mt-1">
              拓扑图与绕行比较可视化
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onModeChange('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                displayMode === 'list'
                  ? 'bg-white text-blue-600 shadow-lg'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <Map className="w-4 h-4" />
              2D 拓扑
            </button>
            <button
              onClick={() => onModeChange('chart')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                displayMode === 'chart'
                  ? 'bg-white text-blue-600 shadow-lg'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              图表
            </button>
            <button
              onClick={() => onModeChange('3d')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                displayMode === '3d'
                  ? 'bg-white text-blue-600 shadow-lg'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <Box className="w-4 h-4" />
              3D
            </button>
          </div>
        </div>
      </div>

      <div className="h-[500px]">
        {displayMode === 'list' && render2DGraph()}
        {displayMode === 'chart' && renderChart()}
        {displayMode === '3d' && render3DView()}
      </div>

      {selectedResult && displayMode !== '3d' && selectedResult.status === 'zero_denominator' && (
        <div className="px-6 py-3 bg-amber-50 border-t border-amber-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-amber-700">
                该记录分母为0，已标记为异常。
                负责人：{getStakeholderName(selectedResult.explanation.nextStakeholder)}
              </span>
            </div>
            <button
              onClick={() => onJumpToRecord(selectedResult.parameterRecordId)}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              跳转至参数表
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
