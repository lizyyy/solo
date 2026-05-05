import React, { useEffect } from 'react';
import { useAppStore } from './store/appStore';
import { apiService } from './services/api';
import { ConfigPanel } from './components/ConfigPanel';
import { VisualizationPanel } from './components/VisualizationPanel';
import { MetricsPanel } from './components/MetricsPanel';
import { ExportPanel } from './components/ExportPanel';
import { Header } from './components/Header';
import './App.css';

const App: React.FC = () => {
  const { activeTab, setActiveTab, setExamples, result, isLoading, error, setIsLoading, setError, setResult, config } = useAppStore();

  useEffect(() => {
    const fetchExamples = async () => {
      try {
        const examples = await apiService.getExamples();
        setExamples(examples);
      } catch (err) {
        console.error('Failed to fetch examples:', err);
      }
    };
    fetchExamples();
  }, [setExamples]);

  const runSimulation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await apiService.runSimulation(config);
      setResult(result);
      setActiveTab('visualization');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const runABADemo = async (mode: 'cas' | 'queue' | 'version-tagged') => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await apiService.runABADemo(mode);
      setResult(result);
      setActiveTab('visualization');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ABA demo failed');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'config', label: '配置' },
    { id: 'visualization', label: '可视化' },
    { id: 'metrics', label: '指标' },
    { id: 'export', label: '导出' },
  ];

  return (
    <div className="app">
      <Header />

      <main className="main-content">
        <div className="tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id as 'config' | 'visualization' | 'metrics' | 'export')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p>模拟运行中...</p>
          </div>
        )}

        <div className="tab-content">
          {activeTab === 'config' && (
            <ConfigPanel onRunSimulation={runSimulation} onRunABADemo={runABADemo} />
          )}

          {activeTab === 'visualization' && (
            <VisualizationPanel result={result} />
          )}

          {activeTab === 'metrics' && (
            <MetricsPanel result={result} />
          )}

          {activeTab === 'export' && (
            <ExportPanel result={result} />
          )}
        </div>
      </main>

      <footer className="footer">
        <p>并发原语可视化实验台 - 用于教学展示 mutex、读写锁、自旋锁、CAS、无锁队列和 ABA 问题</p>
      </footer>
    </div>
  );
};

export default App;
