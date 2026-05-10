import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { StepIndicator } from './components/StepIndicator';
import { StepRoomInfo } from './components/StepRoomInfo';
import { StepTileSelection } from './components/StepTileSelection';
import { StepLayoutSelection } from './components/StepLayoutSelection';
import { StepLossSettings } from './components/StepLossSettings';
import { StepResults } from './components/StepResults';
import './App.css';

const AppContent: React.FC = () => {
  const { state, setCurrentStep, calculate } = useApp();
  const { currentStep } = state;

  const handleNext = () => {
    if (currentStep < 4) {
      if (currentStep === 3) {
        calculate();
      }
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <StepRoomInfo />;
      case 1:
        return <StepTileSelection />;
      case 2:
        return <StepLayoutSelection />;
      case 3:
        return <StepLossSettings />;
      case 4:
        return <StepResults />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🧱</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  瓷砖铺贴损耗估算器
                </h1>
                <p className="text-sm text-gray-500">
                  精准计算 · 智能分析 · 透明可追溯
                </p>
              </div>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>每一步都可查询</p>
              <p>输入、输出、失败原因一目了然</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Step Indicator */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <StepIndicator />
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          {renderStepContent()}
        </div>

        {/* Navigation Buttons */}
        {currentStep < 4 && (
          <div className="mt-6 flex justify-between">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                currentStep === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
              }`}
            >
              ← 上一步
            </button>
            <button
              onClick={handleNext}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {currentStep === 3 ? '🧮 开始计算' : '下一步 →'}
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 py-8 border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">📊 核心规则</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• 铺贴方向：正铺/竖铺/斜铺</li>
                <li>• 切割损耗：按铺贴方式计算</li>
                <li>• 批次采购：颜色匹配分析</li>
                <li>• 门洞扣除：自动计算</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">🔍 透明设计</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• 每步输入可追溯</li>
                <li>• 每步输出可验证</li>
                <li>• 失败原因明确</li>
                <li>• 关键假设可解释</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">📝 数据质量</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• 脏数据不静默跳过</li>
                <li>• 问题列表保留来源</li>
                <li>• 数据清洗有记录</li>
                <li>• Reviewer友好</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-4 border-t border-gray-100 text-center text-xs text-gray-400">
            瓷砖铺贴损耗估算器 · 让装修材料预算更精准
          </div>
        </div>
      </footer>
    </div>
  );
};

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
