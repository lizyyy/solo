import { useEffect } from 'react';
import { Sun, BookOpen } from 'lucide-react';
import { useStore } from '../store/useStore';
import { ConfigPanel } from '../components/ConfigPanel';
import { PVArrayVisualizer } from '../components/PVArrayVisualizer';
import { PowerCharts } from '../components/PowerCharts';
import { DataRecords } from '../components/DataRecords';
import { ReportToolbar } from '../components/ReportToolbar';

export default function Home() {
  const { initializeMockData, calculateResults } = useStore();

  useEffect(() => {
    initializeMockData();
    setTimeout(() => calculateResults(), 100);
  }, [initializeMockData, calculateResults]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Sun className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">光伏阴影损失估算系统</h1>
                <p className="text-sm text-white/80">
                  新能源教学演示平台
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                <BookOpen className="w-4 h-4" />
                <span className="text-sm">使用说明</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3 space-y-4">
            <ConfigPanel />
            <ReportToolbar />
          </div>

          <div className="col-span-6 space-y-4">
            <PVArrayVisualizer />
            <div id="report-content">
              <PowerCharts />
            </div>
          </div>

          <div className="col-span-3 space-y-4">
            <div className="card">
              <div className="card-header">教学说明</div>
              <div className="card-body space-y-3 text-sm text-neutral-600">
                <div className="p-3 bg-primary-50 rounded-lg border border-primary-100">
                  <div className="font-medium text-primary-700 mb-1">
                    💡 实验步骤
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-primary-600">
                    <li>调整阵列配置和太阳角度</li>
                    <li>添加遮挡物并拖动位置</li>
                    <li>观察功率变化和旁路二极管效果</li>
                    <li>提交记录并筛选数据</li>
                  </ol>
                </div>
                <div className="p-3 bg-warning-50 rounded-lg border border-warning-100">
                  <div className="font-medium text-warning-700 mb-1">
                    ⚠️ 异常检测
                  </div>
                  <ul className="space-y-1 text-warning-600">
                    <li>• 阴影时间错误</li>
                    <li>• 串并联配置混淆</li>
                    <li>• 功率重复扣减</li>
                    <li>• 重复提交检测</li>
                  </ul>
                </div>
                <div className="p-3 bg-solar-50 rounded-lg border border-solar-100">
                  <div className="font-medium text-solar-700 mb-1">
                    📊 记录状态
                  </div>
                  <ul className="space-y-1 text-solar-600">
                    <li>• 正常提交</li>
                    <li>• 补录（晚补记录）</li>
                    <li>• 撤回（标记撤回）</li>
                    <li>• 重复（重复提交）</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <DataRecords />
        </div>
      </main>

      <footer className="bg-white border-t border-neutral-200 mt-8">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between text-sm text-neutral-500">
            <span>光伏阴影损失估算系统 - 新能源教学演示</span>
            <span>© 2025 新能源教学工具</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
