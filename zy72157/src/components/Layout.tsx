import React from 'react';
import { Database, GitMerge, CheckSquare, FileText, MapPin, GitCompare } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface LayoutProps {
  children: React.ReactNode;
}

const steps = [
  { key: 'import', label: '数据导入', icon: Database, description: '导入GIS点位和相关数据' },
  { key: 'merge', label: '点位归并', icon: GitMerge, description: '智能识别重复点位' },
  { key: 'diff', label: '补录差异', icon: GitCompare, description: '多来源记录对照确认' },
  { key: 'review', label: '人工复核', icon: CheckSquare, description: '人工审核决策留痕' },
  { key: 'export', label: '公示导出', icon: FileText, description: '导出公示清单' },
] as const;

export function Layout({ children }: LayoutProps) {
  const { currentStep, setCurrentStep, points } = useApp();

  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-primary-700 to-primary-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-serif font-bold">社区养老助餐配送点位管理系统</h1>
                <p className="text-sm text-primary-200">市政设计师专用 · 数据全流程留痕</p>
              </div>
            </div>
            {points.length > 0 && (
              <div className="text-right">
                <p className="text-sm text-primary-200">当前点位</p>
                <p className="text-2xl font-bold">{points.length}</p>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = step.key === currentStep;
                const isPast = index < currentIndex;
                const isClickable = index <= currentIndex + 1 || points.length > 0;

                return (
                  <button
                    key={step.key}
                    onClick={() => isClickable && setCurrentStep(step.key)}
                    disabled={!isClickable}
                    className={`relative flex items-center gap-2 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-primary-100 text-primary-700 font-medium'
                        : isPast
                        ? 'text-green-600 hover:bg-gray-100'
                        : 'text-gray-400 hover:bg-gray-100'
                    } ${!isClickable ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isActive ? 'bg-primary-600 text-white' :
                      isPast ? 'bg-green-500 text-white' : 'bg-gray-200'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">{step.label}</p>
                      <p className="text-xs opacity-70">{step.description}</p>
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-8 h-0.5 ${
                        index < currentIndex ? 'bg-green-500' : 'bg-gray-200'
                      }`} />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs">
                演示模式
              </span>
              <span>数据本地存储，刷新不丢失</span>
            </div>
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>

      <footer className="border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          <p>社区养老助餐配送点位管理系统 · 为市政设计师老曹打造 · 2024</p>
        </div>
      </footer>
    </div>
  );
}
