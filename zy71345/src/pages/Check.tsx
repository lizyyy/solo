import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlayCircle,
  FileText,
  Users,
  BookOpen,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { runAllChecks, getCheckSummary, filterResults } from '../services/checkService';
import { StatusBadge } from '../components/common/StatusBadge';
import { CheckResult } from '../types';

type CheckTab = 'all' | 'page' | 'distribution' | 'revision';

export default function Check() {
  const navigate = useNavigate();
  const { currentData, checkResults, setCheckResults, isChecked } = useDataStore();
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<CheckTab>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const hasData = currentData.parts.length > 0;

  const handleRunChecks = async () => {
    setIsRunning(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const results = runAllChecks(currentData);
    setCheckResults(results);
    setIsRunning(false);
  };

  const summary = isChecked ? getCheckSummary(checkResults) : null;

  const filteredResults =
    activeTab === 'all'
      ? checkResults
      : filterResults(checkResults, { type: activeTab });

  const tabs: { key: CheckTab; label: string; icon: any; count?: number }[] = [
    { key: 'all', label: '全部', icon: FileText, count: summary?.total },
    { key: 'page', label: '页码检查', icon: FileText, count: summary?.byType.page },
    { key: 'distribution', label: '发放检查', icon: Users, count: summary?.byType.distribution },
    { key: 'revision', label: '修订页检查', icon: BookOpen, count: summary?.byType.revision },
  ];

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'page':
        return '页码';
      case 'distribution':
        return '发放';
      case 'revision':
        return '修订页';
      default:
        return type;
    }
  };

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <FileText className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-gray-800 mb-2">暂无数据</h2>
        <p className="text-gray-500 mb-8">请先导入数据后再执行检查</p>
        <button
          onClick={() => navigate('/import')}
          className="flex items-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          <FileText className="w-5 h-5" />
          <span>去导入数据</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-serif font-bold text-gray-800">检查执行</h2>
          <p className="text-gray-500 mt-1">执行页码、发放、修订页的综合检查</p>
        </div>
        <button
          onClick={handleRunChecks}
          disabled={isRunning}
          className="flex items-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-200"
        >
          {isRunning ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <PlayCircle className="w-5 h-5" />
          )}
          <span>{isRunning ? '检查中...' : '执行检查'}</span>
        </button>
      </div>

      {!isChecked && !isRunning && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="font-semibold text-blue-800">准备执行检查</h3>
              <p className="text-sm text-blue-600">
                系统将检查以下内容：页码连续性、乐手发放记录完整性、修订页分发情况
              </p>
            </div>
          </div>
        </div>
      )}

      {isChecked && summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">总检查项</p>
                <p className="text-2xl font-bold text-gray-800">{summary.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">错误</p>
                <p className="text-2xl font-bold text-red-600">{summary.errors}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">警告</p>
                <p className="text-2xl font-bold text-yellow-600">{summary.warnings}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">已解决</p>
                <p className="text-2xl font-bold text-green-600">{summary.resolved}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isChecked && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex border-b">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary-500 text-primary-600 bg-primary-50'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      activeTab === tab.key
                        ? 'bg-primary-100 text-primary-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-4">
            {filteredResults.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-800">检查通过</p>
                <p className="text-gray-500">未发现异常</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredResults.map((result) => (
                  <div
                    key={result.id}
                    className={`border rounded-lg overflow-hidden transition-all ${
                      expandedId === result.id
                        ? 'border-primary-300 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div
                      className="flex items-center gap-4 p-4 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === result.id ? null : result.id)}
                    >
                      {getSeverityIcon(result.severity)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={result.severity as any}>
                            {result.severity === 'error' ? '错误' : result.severity === 'warning' ? '警告' : '信息'}
                          </StatusBadge>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {getTypeLabel(result.type)}
                          </span>
                          <StatusBadge status={result.status as any} />
                        </div>
                        <p className="text-gray-800 mt-1">{result.message}</p>
                      </div>
                      <ChevronRight
                        className={`w-5 h-5 text-gray-400 transition-transform ${
                          expandedId === result.id ? 'rotate-90' : ''
                        }`}
                      />
                    </div>
                    {expandedId === result.id && (
                      <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                        <div className="mt-3 p-3 bg-white rounded-lg border">
                          <p className="text-sm font-medium text-gray-700 mb-1">处理建议</p>
                          <p className="text-sm text-gray-600">{result.suggestion}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {isChecked && (
        <div className="flex justify-end gap-3">
          <button
            onClick={() => navigate('/exceptions')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>查看异常汇总</span>
          </button>
          <button
            onClick={() => navigate('/report')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>生成报告</span>
          </button>
        </div>
      )}
    </div>
  );
}
