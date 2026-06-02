import { ReactNode } from 'react';
import {
  Upload,
  Merge,
  ClipboardCheck,
  FileSpreadsheet,
  MapPin,
} from 'lucide-react';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: ReactNode;
}

const steps = [
  { id: 'import', label: '数据导入', icon: Upload, description: '导入多源数据' },
  { id: 'merge', label: '点位归并', icon: Merge, description: '智能匹配相同点位' },
  { id: 'review', label: '人工复核', icon: ClipboardCheck, description: '审核并标记状态' },
  { id: 'export', label: '导出公示', icon: FileSpreadsheet, description: '分类导出清单' },
];

export function Layout({ children }: LayoutProps) {
  const { currentStep, setCurrentStep, points, importStats } = useAppStore();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">15分钟生活圈</h1>
              <p className="text-xs text-gray-500">缺口图数据处理</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const canClick = index === 0 || points.length > 0;

              return (
                <li key={step.id}>
                  <button
                    onClick={() => canClick && setCurrentStep(step.id as any)}
                    disabled={!canClick}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left',
                      isActive
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : canClick
                        ? 'text-gray-600 hover:bg-gray-100'
                        : 'text-gray-300 cursor-not-allowed'
                    )}
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                        isActive
                          ? 'bg-blue-600 text-white'
                          : canClick
                          ? 'bg-gray-200 text-gray-600'
                          : 'bg-gray-100 text-gray-300'
                      )}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {step.label}
                      </p>
                      <p className="text-xs opacity-70">{step.description}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">数据统计</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-gray-500">总点位</div>
              <div className="text-right font-medium text-gray-900">{importStats.total}</div>
              <div className="text-blue-600">GIS</div>
              <div className="text-right font-medium text-blue-600">{importStats.gis}</div>
              <div className="text-purple-600">居民反馈</div>
              <div className="text-right font-medium text-purple-600">{importStats.resident}</div>
              <div className="text-teal-600">巡检</div>
              <div className="text-right font-medium text-teal-600">{importStats.inspection}</div>
              <div className="text-amber-600">街道备注</div>
              <div className="text-right font-medium text-amber-600">{importStats.street}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
