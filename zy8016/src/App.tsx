import React, { useState, useCallback } from 'react';
import { 
  HARFile, 
  PerformanceBudget, 
  AnalysisResult,
  ParsedRequest,
  ExportOptions,
} from '@/types';
import { parseHAR } from '@/utils/harParser';
import { analyzePerformance } from '@/utils/budgetAnalyzer';
import { exportMarkdown, exportHTML, downloadFile } from '@/utils/reportExporter';
import FileUploader from '@/components/FileUploader';
import StatsOverview from '@/components/StatsOverview';
import IssueList from '@/components/IssueList';
import WaterfallChart from '@/components/WaterfallChart';
import {
  FileText,
  Download,
  RefreshCw,
  BarChart3,
  AlertTriangle,
  Activity,
  ChevronLeft,
} from 'lucide-react';
import { clsx } from 'clsx';

type TabType = 'overview' | 'issues' | 'waterfall';

const defaultBudget: PerformanceBudget = {
  page: 'default',
  thresholds: {
    totalRequests: 100,
    totalSize: 10 * 1024 * 1024,
    resourceTypes: {
      script: { count: 30, size: 2 * 1024 * 1024 },
      image: { count: 50, size: 5 * 1024 * 1024 },
      stylesheet: { count: 20, size: 500 * 1024 },
    },
    thirdParty: {
      count: 20,
      size: 2 * 1024 * 1024,
    },
    cache: {
      missRate: 30,
    },
  },
};

function App() {
  const [harFile, setHarFile] = useState<File | null>(null);
  const [harData, setHarData] = useState<HARFile | null>(null);
  const [budgetFile, setBudgetFile] = useState<File | null>(null);
  const [budgetData, setBudgetData] = useState<PerformanceBudget>(defaultBudget);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ParsedRequest | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [harError, setHarError] = useState<string>('');
  const [budgetError, setBudgetError] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleHarFileSelect = useCallback((file: File, content: string) => {
    setHarError('');
    try {
      const data = JSON.parse(content) as HARFile;
      if (!data.log || !data.log.entries) {
        throw new Error('无效的 HAR 文件格式');
      }
      setHarFile(file);
      setHarData(data);
      setAnalysisResult(null);
    } catch (error) {
      setHarError('请选择有效的 HAR 文件');
      setHarFile(null);
      setHarData(null);
    }
  }, []);

  const handleBudgetFileSelect = useCallback((file: File, content: string) => {
    setBudgetError('');
    try {
      const data = JSON.parse(content) as PerformanceBudget;
      setBudgetFile(file);
      setBudgetData(data);
      setAnalysisResult(null);
    } catch (error) {
      setBudgetError('请选择有效的预算 JSON 文件');
      setBudgetFile(null);
    }
  }, []);

  const handleAnalyze = useCallback(() => {
    if (!harData) return;

    setIsAnalyzing(true);
    
    try {
      const { parsedRequests, warnings } = parseHAR(harData);
      const result = analyzePerformance(harData, parsedRequests, budgetData, warnings);
      setAnalysisResult(result);
    } catch (error) {
      console.error('分析失败:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [harData, budgetData]);

  const handleExport = useCallback((format: 'markdown' | 'html') => {
    if (!analysisResult) return;

    const options: ExportOptions = {
      format,
      includeDetails: true,
      includeWaterfall: false,
    };

    const timestamp = new Date().toISOString().split('T')[0];
    
    if (format === 'markdown') {
      const content = exportMarkdown(analysisResult, options);
      downloadFile(content, `performance-audit-${timestamp}.md`, 'text/markdown');
    } else {
      const content = exportHTML(analysisResult, options);
      downloadFile(content, `performance-audit-${timestamp}.html`, 'text/html');
    }
  }, [analysisResult]);

  const handleReset = useCallback(() => {
    setHarFile(null);
    setHarData(null);
    setBudgetFile(null);
    setBudgetData(defaultBudget);
    setAnalysisResult(null);
    setSelectedRequest(null);
    setActiveTab('overview');
    setHarError('');
    setBudgetError('');
  }, []);

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: '概览', icon: <BarChart3 size={18} /> },
    { id: 'issues', label: '问题', icon: <AlertTriangle size={18} /> },
    { id: 'waterfall', label: '瀑布图', icon: <Activity size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Activity className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">HAR 性能预算体检工具</h1>
                <p className="text-xs text-gray-500">前端性能分析与预算检查</p>
              </div>
            </div>

            {analysisResult && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport('markdown')}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <FileText size={16} />
                  导出 Markdown
                </button>
                <button
                  onClick={() => handleExport('html')}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download size={16} />
                  导出 HTML
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <RefreshCw size={16} />
                  重新开始
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!analysisResult ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                开始性能体检
              </h2>
              <p className="text-gray-600">
                上传 Chrome HAR 文件和性能预算 JSON，分析页面加载性能
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <FileUploader
                label="HAR 文件"
                description="从 Chrome DevTools Network 面板导出的 HAR 文件"
                accept=".har,application/json"
                selectedFile={harFile}
                error={harError}
                onFileSelect={handleHarFileSelect}
              />

              <FileUploader
                label="性能预算 JSON (可选)"
                description="定义性能阈值的 JSON 文件，使用默认预算如果未提供"
                accept=".json"
                selectedFile={budgetFile}
                error={budgetError}
                onFileSelect={handleBudgetFileSelect}
              />
            </div>

            {harData && (
              <div className="mt-8 text-center">
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className={clsx(
                    "px-8 py-3 text-white font-medium rounded-lg transition-all",
                    isAnalyzing
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl"
                  )}
                >
                  {isAnalyzing ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="animate-spin" size={20} />
                      分析中...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Activity size={20} />
                      开始分析
                    </span>
                  )}
                </button>
              </div>
            )}

            <div className="mt-12 max-w-4xl mx-auto">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                使用说明
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-700 mb-2">如何获取 HAR 文件</h4>
                  <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                    <li>打开 Chrome DevTools (F12)</li>
                    <li>切换到 Network 面板</li>
                    <li>刷新页面并等待加载完成</li>
                    <li>右键点击网络请求列表</li>
                    <li>选择 "Save all as HAR with content"</li>
                  </ol>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-700 mb-2">性能预算格式</h4>
                  <pre className="text-xs text-gray-600 bg-white p-3 rounded overflow-x-auto">
{`{
  "page": "首页",
  "thresholds": {
    "totalRequests": 100,
    "totalSize": 10485760,
    "resourceTypes": {
      "script": { "count": 30, "size": 2097152 }
    }
  }
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
          {analysisResult.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-yellow-800 mb-2">
                分析警告
              </h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                {analysisResult.warnings.map((warning, idx) => (
                  <li key={idx}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="border-b border-gray-200">
              <nav className="flex gap-1 p-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={clsx(
                      "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                      activeTab === tab.id
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                    {tab.id === 'issues' && analysisResult.issues.length > 0 && (
                      <span className={clsx(
                        "px-2 py-0.5 text-xs rounded-full",
                        analysisResult.issues.some(i => i.severity === 'error')
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      )}>
                        {analysisResult.issues.length}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'overview' && (
                <StatsOverview analysisResult={analysisResult} />
              )}

              {activeTab === 'issues' && (
                <IssueList
                  issues={analysisResult.issues}
                  onRequestSelect={setSelectedRequest}
                />
              )}

              {activeTab === 'waterfall' && (
                <div className="min-h-[600px]">
                  <WaterfallChart
                    requests={analysisResult.requests}
                    onRequestSelect={setSelectedRequest}
                    selectedRequest={selectedRequest}
                    domContentLoaded={analysisResult.timingStats.domContentLoaded}
                    onLoad={analysisResult.timingStats.onLoad}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </main>

      <footer className="border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            HAR 性能预算体检工具 - 帮助您在发布前检查前端性能问题
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
