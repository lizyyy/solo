import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import MapView from '../components/MapView';
import PointList from '../components/PointList';
import PointDetail from '../components/PointDetail';
import { SignalPoint } from '../types';

export default function HomePage() {
  const { data } = useAppContext();
  const [selectedPoint, setSelectedPoint] = useState<SignalPoint | null>(null);

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <header className="bg-municipal-800 text-white px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">公交优先信号复核系统</h1>
            <p className="text-sm text-blue-200 mt-1">点位追踪 · 版本管理 · 报告生成</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-blue-200">
              共 {data.points.length} 个点位
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 flex-shrink-0 border-r border-slate-200 bg-white overflow-hidden">
          <PointList
            points={data.points}
            selectedPointId={selectedPoint?.id}
            onPointSelect={setSelectedPoint}
          />
        </div>

        <div className="flex-1 p-4">
          <div className="h-full">
            <MapView
              points={data.points}
              selectedPointId={selectedPoint?.id}
              onPointClick={setSelectedPoint}
            />
          </div>
        </div>

        {selectedPoint && (
          <div className="w-96 flex-shrink-0 border-l border-slate-200 bg-white overflow-hidden">
            <PointDetail
              point={selectedPoint}
              onClose={() => setSelectedPoint(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
