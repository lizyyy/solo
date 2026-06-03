import React, { useState } from 'react';
import { AppProvider, useAppContext } from './store/AppContext';
import { ParameterTable } from './components/ParameterTable/ParameterTable';
import { ComparisonList } from './components/ComparisonList/ComparisonList';
import { GraphVisualization } from './components/Visualization/GraphVisualization';
import { HistoryDiffModal } from './components/HistoryDiff/HistoryDiffModal';
import { WorkflowProgress } from './components/Workflow/WorkflowProgress';
import { ReviewPanel } from './components/Review/ReviewPanel';
import { ReportGenerator } from './components/Report/ReportGenerator';
import { Route, MapPin, List, FileText, GitCompare } from 'lucide-react';
import type { DisplayMode } from './types';

type TabType = 'parameters' | 'comparison' | 'visualization' | 'report';

function AppContent() {
  const { state, dispatch } = useAppContext();
  const [activeTab, setActiveTab] = useState<TabType>('parameters');
  const [showHistory, setShowHistory] = useState(false);
  const [historyRecordId, setHistoryRecordId] = useState<string | null>(null);
  const [historyFromVersion, setHistoryFromVersion] = useState<number>(1);
  const [historyToVersion, setHistoryToVersion] = useState<number>(1);

  const handleSelectRecord = (recordId: string) => {
    dispatch({ type: 'SELECT_RECORD', payload: recordId });
  };

  const handleSelectResult = (resultId: string) => {
    dispatch({ type: 'SELECT_RESULT', payload: resultId });
  };

  const handleJumpToRecord = (recordId: string) => {
    setActiveTab('parameters');
    dispatch({ type: 'SELECT_RECORD', payload: recordId });
  };

  const handleShowHistory = (recordId: string, fromVersion: number, toVersion: number) => {
    setHistoryRecordId(recordId);
    setHistoryFromVersion(fromVersion);
    setHistoryToVersion(toVersion);
    setShowHistory(true);
  };

  const handleCloseHistory = () => {
    setShowHistory(false);
    setHistoryRecordId(null);
    dispatch({ type: 'HIDE_HISTORY_DIFF' });
  };

  const handleModeChange = (mode: DisplayMode) => {
    dispatch({ type: 'SET_DISPLAY_MODE', payload: mode });
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'parameters', label: '参数调试表', icon: <List className="w-4 h-4" /> },
    { id: 'comparison', label: '绕行比较结果', icon: <GitCompare className="w-4 h-4" /> },
    { id: 'visualization', label: '可视化展示', icon: <MapPin className="w-4 h-4" /> },
    { id: 'report', label: '人性化报告', icon: <FileText className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Route className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  图最短路绕行比较
                </h1>
                <p className="text-xs text-gray-500">
                  可解释的路径分析与复核系统
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6">
        <div className="mb-6">
          <WorkflowProgress />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {activeTab === 'parameters' && (
              <ParameterTable
                onSelectRecord={handleSelectRecord}
                selectedRecordId={state.selectedRecordId}
                onShowHistory={handleShowHistory}
              />
            )}
            {activeTab === 'comparison' && (
              <ComparisonList
                onSelectResult={handleSelectResult}
                selectedResultId={state.selectedResultId}
                onJumpToRecord={handleJumpToRecord}
              />
            )}
            {activeTab === 'visualization' && (
              <GraphVisualization
                displayMode={state.displayMode}
                onModeChange={handleModeChange}
                selectedResultId={state.selectedResultId}
                onJumpToRecord={handleJumpToRecord}
              />
            )}
            {activeTab === 'report' && <ReportGenerator />}
          </div>

          <div className="space-y-6">
            <ReviewPanel selectedRecordId={state.selectedRecordId} />

            {state.parameterVersions.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-slate-700 to-slate-800">
                  <h2 className="text-lg font-bold text-white">参数版本历史</h2>
                  <p className="text-slate-300 text-sm mt-1">
                    专业计算的取舍依据
                  </p>
                </div>
                <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                  {[...state.parameterVersions].reverse().map(version => (
                    <div
                      key={version.version}
                      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                        state.currentParameterVersion === version.version
                          ? 'bg-indigo-50 border-indigo-200'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                      onClick={() =>
                        dispatch({
                          type: 'SET_CURRENT_PARAMETER_VERSION',
                          payload: version.version,
                        })
                      }
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`font-mono text-sm font-bold ${
                            state.currentParameterVersion === version.version
                              ? 'text-indigo-700'
                              : 'text-gray-700'
                          }`}
                        >
                          {version.version}
                        </span>
                        {state.currentParameterVersion === version.version && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                            当前使用
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mb-2">
                        {version.reasoning}
                      </p>
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <p>
                          <span className="font-mono bg-gray-100 px-1 rounded">
                            {version.parameters.edgeWeightFormula}
                          </span>
                        </p>
                        <p>
                          绕行阈值：{version.parameters.detourThreshold} 倍
                        </p>
                        <p>
                          流量考虑：{version.parameters.considerTraffic ? '是' : '否'}
                        </p>
                        <p>
                          创建于：{new Date(version.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {showHistory && historyRecordId && (
        <HistoryDiffModal
          recordId={historyRecordId}
          fromVersion={historyFromVersion}
          toVersion={historyToVersion}
          onClose={handleCloseHistory}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
