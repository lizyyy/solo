import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers, Box, AlertTriangle, ExternalLink } from 'lucide-react';
import { Chart2D } from '../components/visualization/Chart2D';
import { Scene3D } from '../components/visualization/Scene3D';
import { mockVisualizationData } from '../utils/mockData';
import type { VisualizationDataPoint } from '../types';

type ViewMode = '2d' | '3d';

export function Visualization() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('2d');
  const [selectedPoint, setSelectedPoint] = useState<VisualizationDataPoint | null>(null);

  const handlePointClick = (point: VisualizationDataPoint) => {
    setSelectedPoint(point);
  };

  const handleBacktrack = () => {
    if (selectedPoint) {
      if (selectedPoint.sourceType === 'negative_sample') {
        navigate(`/report/${id}/anomalies`);
      } else {
        navigate(`/report/${id}`);
      }
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link to={`/report/${id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3">
          <ArrowLeft size={14} />
          返回报告详情
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-serif">可视化分析</h1>
            <p className="text-sm text-slate-500 mt-1">点击数据点可回溯至原始数据来源</p>
          </div>
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('2d')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === '2d'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <Layers size={16} />
              2D图表
            </button>
            <button
              onClick={() => setViewMode('3d')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === '3d'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <Box size={16} />
              3D展示
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          {viewMode === '2d' ? (
            <Chart2D data={mockVisualizationData} onPointClick={handlePointClick} />
          ) : (
            <Scene3D data={mockVisualizationData} onPointClick={handlePointClick} />
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">图例说明</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-sky-500" />
                <span className="text-sm text-slate-600">主数据点（来自实验桶）</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-rose-500" />
                <span className="text-sm text-slate-600">负样本</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-amber-400" />
                <span className="text-sm text-slate-600">存在时间窗穿越问题</span>
              </div>
            </div>
          </div>

          {selectedPoint ? (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-4">选中数据点</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500">标签</p>
                  <p className="text-sm font-medium text-slate-700">{selectedPoint.label}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">置信度</p>
                  <p className="text-sm font-medium text-slate-700">
                    {(selectedPoint.confidence * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">数据来源</p>
                  <p className="text-sm font-medium text-slate-700">
                    {selectedPoint.sourceType === 'bucket' ? '线上实验桶' : '负样本列表'}
                  </p>
                </div>
                {selectedPoint.hasTimeWindowIssue && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-100">
                    <AlertTriangle size={14} className="text-amber-600" />
                    <span className="text-xs text-amber-700">存在时间窗穿越问题</span>
                  </div>
                )}
                <button
                  onClick={handleBacktrack}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium"
                >
                  <ExternalLink size={14} />
                  回溯至{selectedPoint.sourceType === 'bucket' ? '实验桶' : '负样本列表'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                <Layers size={24} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">点击图表中的数据点查看详情</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
