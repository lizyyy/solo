import React from 'react';
import { Activity, Database, BarChart3, FileText, History, Menu, X } from 'lucide-react';

interface HeaderProps {
  currentStep: 'import' | 'preprocess' | 'fitting' | 'report';
  onStepChange: (step: 'import' | 'preprocess' | 'fitting' | 'report') => void;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}

const steps = [
  { id: 'import' as const, label: '数据导入', icon: Database },
  { id: 'preprocess' as const, label: '预处理', icon: Activity },
  { id: 'fitting' as const, label: '拟合分析', icon: BarChart3 },
  { id: 'report' as const, label: '报告生成', icon: FileText },
];

const Header: React.FC<HeaderProps> = ({ currentStep, onStepChange, onToggleSidebar, sidebarOpen }) => {
  const getStepStatus = (stepId: string) => {
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    const stepIndex = steps.findIndex(s => s.id === stepId);
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <header className="bg-engineering-800 text-white shadow-lg sticky top-0 z-40">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-2 hover:bg-white/10 rounded-engineering transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-engineering flex items-center justify-center">
              <Activity className="w-5 h-5 text-engineering-800" />
            </div>
            <div>
              <h1 className="font-serif-cn font-bold text-lg leading-tight">材料疲劳寿命拟合系统</h1>
              <p className="text-xs text-engineering-200">Fatigue Life Fitting Analysis</p>
            </div>
          </div>
        </div>
        
        <nav className="hidden md:flex items-center gap-1">
          {steps.map((step, index) => {
            const status = getStepStatus(step.id);
            const Icon = step.icon;
            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => status !== 'pending' && onStepChange(step.id)}
                  disabled={status === 'pending'}
                  className={`flex items-center gap-2 px-4 py-2 rounded-engineering transition-all ${
                    status === 'active'
                      ? 'bg-white text-engineering-800 shadow-md'
                      : status === 'completed'
                      ? 'text-white hover:bg-white/10 cursor-pointer'
                      : 'text-engineering-400 cursor-not-allowed'
                  }`}
                >
                  <div className={`step-indicator w-6 h-6 text-xs ${
                    status === 'active' ? 'bg-engineering-800 text-white' :
                    status === 'completed' ? 'step-completed' : 'step-pending'
                  }`}>
                    {status === 'completed' ? '✓' : index + 1}
                  </div>
                  <span className="font-medium text-sm">{step.label}</span>
                </button>
                {index < steps.length - 1 && (
                  <div className={`w-8 h-0.5 mx-1 ${
                    status === 'completed' ? 'bg-success-500' : 'bg-engineering-600'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </nav>

        <button
          onClick={() => onStepChange('history' as any)}
          className="flex items-center gap-2 px-3 py-2 rounded-engineering hover:bg-white/10 transition-colors"
        >
          <History className="w-4 h-4" />
          <span className="text-sm hidden sm:inline">历史记录</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
