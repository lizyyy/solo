import React, { useEffect, useState } from 'react';
import { Layout, Database, Save, Play, BarChart3, Eye } from 'lucide-react';
import { useAppStore } from './store/appStore';
import { indexApi } from './services/api';
import ConfigPanel from './components/ConfigPanel';
import VisualizationPanel from './components/VisualizationPanel';
import ResultsPanel from './components/ResultsPanel';
import ComparisonPanel from './components/ComparisonPanel';
import SavedExperiments from './components/SavedExperiments';
import LoadingSpinner from './components/LoadingSpinner';

const App: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    currentExperiment,
    setCurrentExperiment,
    isLoading,
    setIsLoading,
    error,
    setError,
  } = useAppStore();

  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);

  useEffect(() => {
    checkBackendConnection();
  }, []);

  const checkBackendConnection = async () => {
    try {
      await indexApi.healthCheck();
      setBackendConnected(true);
    } catch (err) {
      setBackendConnected(false);
      setError('无法连接到后端服务，请确保后端服务已启动（npm run dev 在 backend 目录下）');
    }
  };

  const tabs = [
    { id: 'config', label: '实验配置', icon: Database },
    { id: 'visualization', label: '索引可视化', icon: Eye },
    { id: 'results', label: '查询结果', icon: BarChart3 },
    { id: 'comparison', label: '对比分析', icon: Layout },
  ] as const;

  const renderContent = () => {
    switch (activeTab) {
      case 'config':
        return <ConfigPanel />;
      case 'visualization':
        return <VisualizationPanel />;
      case 'results':
        return <ResultsPanel />;
      case 'comparison':
        return <ComparisonPanel />;
      default:
        return <ConfigPanel />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-primary-600 p-2 rounded-lg">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">数据库索引实验台</h1>
                <p className="text-xs text-gray-500">B+ 树索引 vs 哈希索引对比分析</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm ${
                backendConnected === true 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : backendConnected === false 
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-gray-100 text-gray-600'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  backendConnected === true 
                    ? 'bg-emerald-500' 
                    : backendConnected === false 
                      ? 'bg-red-500' 
                      : 'bg-gray-400 animate-pulse'
                }`} />
                <span>{backendConnected === true ? '后端已连接' : backendConnected === false ? '后端未连接' : '连接中...'}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="w-5 h-5 text-red-400 mr-2">⚠️</div>
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-6">
          <div className="w-72 flex-shrink-0">
            <SavedExperiments />
          </div>

          <div className="flex-1">
            <nav className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-xl">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const isDisabled = (tab.id === 'visualization' || tab.id === 'results' || tab.id === 'comparison') && !currentExperiment;

                return (
                  <button
                    key={tab.id}
                    onClick={() => !isDisabled && setActiveTab(tab.id)}
                    disabled={isDisabled}
                    className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
                      isActive
                        ? 'bg-white text-primary-600 shadow-sm'
                        : isDisabled
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            <main>
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <LoadingSpinner size="large" />
                </div>
              ) : (
                renderContent()
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
