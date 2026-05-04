import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { QueryResult, OperationResult, OperationStep, IndexStats } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import {
  ChevronDown,
  ChevronRight,
  Database,
  Hash,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
} from 'lucide-react';

const ResultsPanel: React.FC = () => {
  const { currentResult } = useAppStore();
  const [expandedQueries, setExpandedQueries] = useState<Set<string>>(new Set());
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null);

  const toggleQuery = (queryId: string) => {
    setExpandedQueries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(queryId)) {
        newSet.delete(queryId);
      } else {
        newSet.add(queryId);
      }
      return newSet;
    });
    setSelectedQuery(queryId);
  };

  const getWinnerIcon = (winner: 'bplus' | 'hash' | 'tie') => {
    switch (winner) {
      case 'bplus':
        return <Database className="w-5 h-5 text-primary-600" />;
      case 'hash':
        return <Hash className="w-5 h-5 text-accent-600" />;
      case 'tie':
        return <CheckCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getWinnerLabel = (winner: 'bplus' | 'hash' | 'tie') => {
    switch (winner) {
      case 'bplus':
        return 'B+ 树';
      case 'hash':
        return '哈希';
      case 'tie':
        return '平局';
    }
  };

  const getQueryTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      equality: 'bg-emerald-100 text-emerald-800',
      range: 'bg-blue-100 text-blue-800',
      prefix: 'bg-purple-100 text-purple-800',
      insert: 'bg-amber-100 text-amber-800',
      delete: 'bg-red-100 text-red-800',
      update: 'bg-orange-100 text-orange-800',
    };
    const labels: Record<string, string> = {
      equality: '等值查询',
      range: '范围查询',
      prefix: '前缀查询',
      insert: '插入操作',
      delete: '删除操作',
      update: '更新操作',
    };
    return (
      <span className={`badge ${colors[type] || 'bg-gray-100 text-gray-800'}`}>
        {labels[type] || type}
      </span>
    );
  };

  const renderStepIcon = (type: OperationStep['type']) => {
    switch (type) {
      case 'read':
        return <FileText className="w-3.5 h-3.5 text-blue-500" />;
      case 'write':
        return <FileText className="w-3.5 h-3.5 text-amber-500" />;
      case 'split':
        return <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />;
      case 'merge':
        return <AlertTriangle className="w-3.5 h-3.5 text-purple-500" />;
      case 'conflict':
        return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
      case 'resize':
        return <AlertTriangle className="w-3.5 h-3.5 text-pink-500" />;
      case 'lookup':
        return <Clock className="w-3.5 h-3.5 text-gray-500" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  const getStepTypeLabel = (type: OperationStep['type']) => {
    const labels: Record<string, string> = {
      read: '读取页',
      write: '写入页',
      split: '页分裂',
      merge: '页合并',
      rebalance: '重平衡',
      conflict: '哈希冲突',
      resize: '哈希扩容',
      lookup: '查询',
    };
    return labels[type] || type;
  };

  const renderStatsComparison = (bplusStats: IndexStats, hashStats: IndexStats) => {
    const stats = [
      { label: '页访问次数', bplus: bplusStats.pageAccesses, hash: hashStats.pageAccesses, unit: '次' },
      { label: '哈希冲突', bplus: bplusStats.bucketConflicts, hash: hashStats.bucketConflicts, unit: '次' },
      { label: '回表次数', bplus: bplusStats.tableLookups, hash: hashStats.tableLookups, unit: '次' },
      { label: '估算耗时', bplus: bplusStats.estimatedTime, hash: hashStats.estimatedTime, unit: 'ms' },
    ];

    return (
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const bplusWins = stat.bplus < stat.hash;
          const hashWins = stat.hash < stat.bplus;
          const isTie = stat.bplus === stat.hash;

          return (
            <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-2">{stat.label}</p>
              <div className="flex items-center justify-between">
                <div className={`text-sm font-medium ${
                  bplusWins ? 'text-primary-600' : isTie ? 'text-gray-600' : 'text-gray-400'
                }`}>
                  <Database className="w-3 h-3 inline mr-1" />
                  {stat.bplus}{stat.unit}
                </div>
                <div className={`text-sm font-medium ${
                  hashWins ? 'text-accent-600' : isTie ? 'text-gray-600' : 'text-gray-400'
                }`}>
                  <Hash className="w-3 h-3 inline mr-1" />
                  {stat.hash}{stat.unit}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSteps = (steps: OperationStep[], title: string, icon: React.ReactNode) => {
    if (steps.length === 0) {
      return (
        <div className="text-center py-4 text-gray-400 text-sm">
          无操作记录
        </div>
      );
    }

    return (
      <div>
        <div className="flex items-center space-x-2 mb-3">
          {icon}
          <h4 className="font-medium text-gray-700">{title}</h4>
          <span className="text-xs text-gray-400">({steps.length} 步)</span>
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="flex items-start space-x-2 py-1.5 px-2 rounded hover:bg-gray-50 text-sm"
            >
              {renderStepIcon(step.type)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-gray-500">
                    {getStepTypeLabel(step.type)}
                  </span>
                  {step.pageId !== undefined && (
                    <span className="text-xs text-blue-500">页 {step.pageId}</span>
                  )}
                  {step.bucketId !== undefined && (
                    <span className="text-xs text-accent-500">桶 {step.bucketId}</span>
                  )}
                </div>
                <p className="text-gray-600 text-xs truncate">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!currentResult) {
    return (
      <div className="card">
        <div className="card-body py-20 text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">请先运行实验以查看结果</p>
        </div>
      </div>
    );
  }

  const chartData = currentResult.queryResults.map((qr) => ({
    name: qr.queryName.length > 15 ? qr.queryName.slice(0, 15) + '...' : qr.queryName,
    'B+ 树': qr.bplusResult.stats.estimatedTime,
    哈希: qr.hashResult.stats.estimatedTime,
  }));

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">性能对比概览</h2>
        </div>
        <div className="card-body">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" label={{ value: '估算耗时 (ms)', position: 'bottom', offset: 0 }} />
                <YAxis type="category" dataKey="name" width={120} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Legend />
                <Bar dataKey="B+ 树" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                <Bar dataKey="哈希" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">查询详情</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {currentResult.queryResults.map((qr, idx) => {
            const isExpanded = expandedQueries.has(qr.queryId);

            return (
              <div key={qr.queryId}>
                <div
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => toggleQuery(qr.queryId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">{qr.queryName}</span>
                          {getQueryTypeBadge(qr.queryType)}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          B+ 树: {qr.bplusResult.stats.estimatedTime}ms · 
                          哈希: {qr.hashResult.stats.estimatedTime}ms
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getWinnerIcon(qr.winner)}
                      <span className={`text-sm font-medium ${
                        qr.winner === 'bplus' ? 'text-primary-600' :
                        qr.winner === 'hash' ? 'text-accent-600' : 'text-gray-600'
                      }`}>
                        {getWinnerLabel(qr.winner)} 胜出
                      </span>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      {renderStatsComparison(qr.bplusResult.stats, qr.hashResult.stats)}

                      <div className="mt-6 grid grid-cols-2 gap-6">
                        <div className="border border-primary-200 rounded-lg p-4 bg-primary-50">
                          {renderSteps(qr.bplusResult.steps, 'B+ 树执行步骤', <Database className="w-4 h-4 text-primary-600" />)}
                        </div>
                        <div className="border border-accent-200 rounded-lg p-4 bg-accent-50">
                          {renderSteps(qr.hashResult.steps, '哈希索引执行步骤', <Hash className="w-4 h-4 text-accent-600" />)}
                        </div>
                      </div>

                      {qr.queryType === 'range' || qr.queryType === 'prefix' ? (
                        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                          <div className="flex items-start space-x-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-sm font-medium text-amber-800">适用场景提示</h4>
                              <p className="text-sm text-amber-700 mt-1">
                                {qr.queryType === 'range' 
                                  ? '范围查询 (BETWEEN, >, <, >=, <=) 只适合 B+ 树索引。哈希索引不支持范围查询，需要全表扫描，性能极差。'
                                  : '前缀查询 (LIKE "prefix%") 只适合 B+ 树索引。哈希索引不支持部分匹配，需要全表扫描。'
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 border-t border-gray-200 pt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">执行结果</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className={`p-3 rounded-lg border ${
                            qr.bplusResult.success 
                              ? 'bg-emerald-50 border-emerald-200' 
                              : 'bg-red-50 border-red-200'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700 flex items-center">
                                <Database className="w-4 h-4 mr-1.5" />
                                B+ 树
                              </span>
                              {qr.bplusResult.success ? (
                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{qr.bplusResult.message}</p>
                          </div>
                          <div className={`p-3 rounded-lg border ${
                            qr.hashResult.success 
                              ? 'bg-emerald-50 border-emerald-200' 
                              : 'bg-red-50 border-red-200'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700 flex items-center">
                                <Hash className="w-4 h-4 mr-1.5" />
                                哈希索引
                              </span>
                              {qr.hashResult.success ? (
                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{qr.hashResult.message}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ResultsPanel;
