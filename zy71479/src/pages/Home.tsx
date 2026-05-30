import { useState } from 'react';
import Header from '../components/Header';
import TrackVisualization from '../components/TrackVisualization';
import DataTracePanel from '../components/DataTracePanel';
import HistoryTimeline from '../components/HistoryTimeline';
import CalculationSummary from '../components/CalculationSummary';
import { mockCornerData } from '../data/mockData';
import type { CornerData } from '../types';

const Home = () => {
  const [corners] = useState<CornerData[]>(mockCornerData);
  const [selectedCorner, setSelectedCorner] = useState<CornerData | null>(null);

  return (
    <div className="min-h-screen bg-slate-900">
      <Header corners={corners} />

      <main className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TrackVisualization
              corners={corners}
              selectedCorner={selectedCorner}
              onSelectCorner={setSelectedCorner}
            />

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <CalculationSummary corners={corners} />
              <HistoryTimeline corner={selectedCorner} />
            </div>
          </div>

          <div className="lg:col-span-1">
            <DataTracePanel corner={selectedCorner} />
          </div>
        </div>

        <div className="mt-6 bg-slate-800/30 rounded-xl border border-slate-700/30 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">数据样例说明</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-sm font-medium text-emerald-400">顺利流程</span>
              </div>
              <p className="text-xs text-slate-400">
                T1、T2、T3弯道：数据完整，抓地匹配良好，可作为正常参考
              </p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-sm font-medium text-amber-400">边界记录</span>
              </div>
              <p className="text-xs text-slate-400">
                T4弯道：半径经过修正，抓地利用率接近阈值，存在历史修正记录
              </p>
            </div>
            <div className="bg-slate-500/10 border border-slate-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                <span className="text-sm font-medium text-slate-400">待补资料</span>
              </div>
              <p className="text-xs text-slate-400">
                T5弯道：轮胎数据缺失，需要人工补充，展示不完整数据处理流程
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;