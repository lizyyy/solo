import { Music2 } from 'lucide-react';
import { ParamPanel } from '@/components/ParamPanel';
import { AnomalyStats } from '@/components/AnomalyStats';
import { SceneVisualization } from '@/components/SceneVisualization';
import { PointList } from '@/components/PointList';
import { ReportPanel } from '@/components/ReportPanel';
import { RemarkPanel } from '@/components/RemarkPanel';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-md">
                <Music2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-primary-800 font-serif">
                  交响乐团站位声场管理系统
                </h1>
                <p className="text-xs text-gray-500">
                  Symphony Orchestra Position Sound Field Management
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-700">数据分析员</div>
                <div className="text-xs text-primary-600">阿乔</div>
              </div>
              <div className="w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-medium text-sm shadow">
                乔
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3 space-y-6">
            <div className="card">
              <ParamPanel />
            </div>
            <div className="card">
              <AnomalyStats />
            </div>
          </div>

          <div className="col-span-6 space-y-6">
            <div className="card">
              <SceneVisualization />
            </div>
            <div className="card">
              <PointList />
            </div>
          </div>

          <div className="col-span-3 space-y-6">
            <div className="card">
              <ReportPanel />
            </div>
            <div className="card">
              <RemarkPanel />
            </div>
          </div>
        </div>

        <div className="mt-6 card">
          <div className="text-sm text-gray-600">
            <div className="font-medium text-gray-700 mb-2">使用说明</div>
            <ul className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                <span>调整左侧参数面板，场景、明细、报告会实时同步更新</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                <span>点击场景图中的点位查看详情，坐标系不一致的点位已分区显示</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                <span>在明细列表中对异常点位进行人工确认，状态会同步到报告</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded flex items-center justify-center flex-shrink-0 text-xs font-bold">4</span>
                <span>选中点位后可补录备注，导出数据包含完整判断过程和差异历史</span>
              </li>
            </ul>
          </div>
        </div>

        <footer className="mt-6 text-center text-xs text-gray-400">
          <p>交响乐团站位声场管理系统 · 确保数据一致性、可追溯性、异常可识别性</p>
          <p className="mt-1">样例数据包含：1条顺利记录、1条待确认记录、2条GIS旧口径记录</p>
        </footer>
      </main>
    </div>
  );
}