import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Filter,
  Check,
  X,
  Eye,
  Download,
  FileText,
  Search,
} from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { getCheckSummary, filterResults } from '../services/checkService';
import { StatusBadge } from '../components/common/StatusBadge';
import { CheckResult } from '../types';

export default function Exceptions() {
  const navigate = useNavigate();
  const { checkResults, isChecked, currentData } = useDataStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const summary = isChecked ? getCheckSummary(checkResults) : null;

  const filteredResults = useMemo(() => {
    let results = checkResults;

    if (filterType !== 'all') {
      results = filterResults(results, { type: filterType });
    }
    if (filterSeverity !== 'all') {
      results = filterResults(results, { severity: filterSeverity });
    }
    if (filterStatus !== 'all') {
      results = filterResults(results, { status: filterStatus });
    }
    if (searchTerm) {
      results = results.filter(
        (r) =>
          r.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.suggestion.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return results;
  }, [checkResults, filterType, filterSeverity, filterStatus, searchTerm]);

  const getPartName = (partId?: string) => {
    if (!partId) return '-';
    return currentData.parts.find((p) => p.id === partId)?.name || partId;
  };

  const getMusicianName = (musicianId?: string) => {
    if (!musicianId) return '-';
    return currentData.musicians.find((m) => m.id === musicianId)?.name || musicianId;
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

  const handleSelectAll = () => {
    if (selectedIds.size === filteredResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredResults.map((r) => r.id)));
    }
  };

  const handleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchResolve = () => {
    alert(`已标记 ${selectedIds.size} 个异常为已解决`);
    setSelectedIds(new Set());
  };

  const handleBatchIgnore = () => {
    alert(`已忽略 ${selectedIds.size} 个异常`);
    setSelectedIds(new Set());
  };

  if (!isChecked) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-gray-800 mb-2">尚未执行检查</h2>
        <p className="text-gray-500 mb-8">请先执行检查以查看异常列表</p>
        <button
          onClick={() => navigate('/check')}
          className="flex items-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          <FileText className="w-5 h-5" />
          <span>去执行检查</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-serif font-bold text-gray-800">异常汇总</h2>
          <p className="text-gray-500 mt-1">集中查看和处理所有异常情况</p>
        </div>
        <div className="flex gap-3">
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={handleBatchResolve}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>批量解决 ({selectedIds.size})</span>
              </button>
              <button
                onClick={handleBatchIgnore}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <X className="w-4 h-4" />
                <span>批量忽略</span>
              </button>
            </>
          )}
          <button
            onClick={() => navigate('/report')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>导出报告</span>
          </button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="text-2xl font-bold text-gray-800">{summary.total}</div>
            <div className="text-sm text-gray-500">总异常数</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="text-2xl font-bold text-red-600">{summary.errors}</div>
            <div className="text-sm text-gray-500">错误</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="text-2xl font-bold text-yellow-600">{summary.warnings}</div>
            <div className="text-sm text-gray-500">警告</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="text-2xl font-bold text-orange-600">{summary.open}</div>
            <div className="text-sm text-gray-500">待处理</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="text-2xl font-bold text-green-600">{summary.resolved}</div>
            <div className="text-sm text-gray-500">已解决</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="搜索异常描述..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">全部类型</option>
              <option value="page">页码</option>
              <option value="distribution">发放</option>
              <option value="revision">修订页</option>
            </select>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">全部级别</option>
              <option value="error">错误</option>
              <option value="warning">警告</option>
              <option value="info">信息</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">全部状态</option>
              <option value="open">待处理</option>
              <option value="resolved">已解决</option>
              <option value="ignored">已忽略</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left w-12">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredResults.length && filteredResults.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">类型</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">级别</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">声部</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">乐手</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">问题描述</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">状态</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    没有符合条件的异常记录
                  </td>
                </tr>
              ) : (
                filteredResults.map((result) => (
                  <tr key={result.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(result.id)}
                        onChange={() => handleSelect(result.id)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-700">{getTypeLabel(result.type)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={result.severity as any}>
                        {result.severity === 'error' ? '错误' : result.severity === 'warning' ? '警告' : '信息'}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700">{getPartName(result.partId)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700">{getMusicianName(result.musicianId)}</span>
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <p className="text-sm text-gray-700 truncate">{result.message}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={result.status as any} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors" title="查看详情">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-1 text-green-400 hover:text-green-600 transition-colors" title="标记已解决">
                          <Check className="w-4 h-4" />
                        </button>
                        <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors" title="忽略">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
          <span className="text-sm text-gray-500">
            显示 {filteredResults.length} 条记录，共 {checkResults.length} 条
          </span>
        </div>
      </div>
    </div>
  );
}
