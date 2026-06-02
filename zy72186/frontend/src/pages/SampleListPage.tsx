import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { Sample, ReviewStatus } from '../types';
import { sampleApi, adminApi } from '../api/client';
import { formatDateShort, formatConfidence } from '../utils/format';
import StatusBadge from '../components/StatusBadge';
import IssueBadge from '../components/IssueBadge';

type FilterStatus = ReviewStatus | 'all';
type FilterIssue = 'all' | 'duplicate' | 'missing_ref' | 'manual_override' | 'conflict' | 'low_confidence';

export default function SampleListPage() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [issueFilter, setIssueFilter] = useState<FilterIssue>('all');
  const [includeDuplicates, setIncludeDuplicates] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadSamples = useCallback(async () => {
    setLoading(true);
    try {
      const data = await sampleApi.getSamples(
        statusFilter === 'all' ? undefined : statusFilter,
        includeDuplicates
      );
      setSamples(data);
    } catch (error) {
      console.error('Failed to load samples:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, includeDuplicates]);

  useEffect(() => {
    loadSamples();
  }, [loadSamples]);

  const handleReset = async () => {
    setResetting(true);
    try {
      await adminApi.resetDatabase();
      await loadSamples();
      setShowResetConfirm(false);
    } catch (error) {
      console.error('Failed to reset:', error);
    } finally {
      setResetting(false);
    }
  };

  const handleResolveDuplicate = async (sampleId: string, keepOriginal: boolean) => {
    try {
      await sampleApi.resolveDuplicate(sampleId, keepOriginal);
      await loadSamples();
    } catch (error) {
      console.error('Failed to resolve duplicate:', error);
    }
  };

  const filteredSamples = samples.filter(sample => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const match = 
        sample.contractId.toLowerCase().includes(term) ||
        sample.contractName.toLowerCase().includes(term) ||
        sample.clauseType.toLowerCase().includes(term) ||
        sample.clauseContent.toLowerCase().includes(term);
      if (!match) return false;
    }

    if (issueFilter === 'all') return true;
    if (issueFilter === 'duplicate') return sample.isDuplicate;
    if (issueFilter === 'missing_ref') return sample.isMissingRef;
    if (issueFilter === 'manual_override') return sample.hasManualOverride;
    if (issueFilter === 'conflict') return sample.hasModelImportConflict;
    if (issueFilter === 'low_confidence') {
      return sample.modelConfidence !== null && 
             sample.modelThreshold !== null && 
             sample.modelConfidence < sample.modelThreshold;
    }
    return true;
  });

  const stats = {
    total: samples.length,
    pending: samples.filter(s => s.status === 'pending').length,
    approved: samples.filter(s => s.status === 'approved').length,
    rejected: samples.filter(s => s.status === 'rejected').length,
    conflict: samples.filter(s => s.status === 'conflict').length,
    needReview: samples.filter(s => s.status === 'need_review').length,
    duplicates: samples.filter(s => s.isDuplicate).length,
  };

  const statusOptions: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'pending', label: '待复核' },
    { value: 'approved', label: '已通过' },
    { value: 'rejected', label: '已驳回' },
    { value: 'conflict', label: '存在冲突' },
    { value: 'need_review', label: '需人工复核' },
  ];

  const issueOptions: { value: FilterIssue; label: string }[] = [
    { value: 'all', label: '全部问题' },
    { value: 'duplicate', label: '重复样本' },
    { value: 'missing_ref', label: '缺少引用' },
    { value: 'manual_override', label: '人工改判' },
    { value: 'conflict', label: '模型与导入冲突' },
    { value: 'low_confidence', label: '低置信度' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">样本列表</h2>
          <p className="text-gray-600 mt-1">共 {filteredSamples.length} 条样本待处理</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="btn-secondary"
          >
            重置数据
          </button>
          <Link to="/report" className="btn-primary">
            查看报告
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-600">总计</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-blue-600">待复核</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{stats.pending}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-green-600">已通过</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{stats.approved}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-red-600">已驳回</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{stats.rejected}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-orange-600">存在冲突</p>
          <p className="text-2xl font-bold text-orange-700 mt-1">{stats.conflict}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-yellow-600">需人工复核</p>
          <p className="text-2xl font-bold text-yellow-700 mt-1">{stats.needReview}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-purple-600">重复样本</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{stats.duplicates}</p>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="搜索合同编号、名称、条款内容..."
              className="input"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-700">状态:</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as FilterStatus)}
              className="select w-auto"
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-700">问题:</label>
            <select
              value={issueFilter}
              onChange={e => setIssueFilter(e.target.value as FilterIssue)}
              className="select w-auto"
            >
              {issueOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeDuplicates}
              onChange={e => setIncludeDuplicates(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <span className="text-sm text-gray-700">显示重复样本</span>
          </label>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  合同信息
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  条款内容
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  模型输出
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  导入数据
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  问题标记
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  更新时间
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSamples.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    暂无符合条件的样本
                  </td>
                </tr>
              ) : (
                filteredSamples.map(sample => (
                  <tr key={sample.id} className={sample.isDuplicate ? 'bg-purple-50' : ''}>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-gray-900">{sample.contractId}</div>
                      <div className="text-sm text-gray-500">{sample.contractName}</div>
                      <div className="text-xs text-gray-400 mt-1">{sample.clauseType}</div>
                    </td>
                    <td className="px-4 py-4 max-w-xs">
                      <div className="text-sm text-gray-700 line-clamp-2" title={sample.clauseContent}>
                        {sample.clauseContent}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-mono text-gray-900">
                        {sample.modelExtraction ?? <span className="text-gray-400">-</span>}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatConfidence(sample.modelConfidence)} · {sample.modelVersion || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-mono text-green-700">
                        {sample.importedLabel ?? <span className="text-gray-400">-</span>}
                      </div>
                      {sample.manualLabel && (
                        <div className="text-xs text-red-600 mt-1">
                          人工: {sample.manualLabel}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={sample.status} />
                    </td>
                    <td className="px-4 py-4">
                      <IssueBadge sample={sample} />
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {formatDateShort(sample.updatedAt)}
                    </td>
                    <td className="px-4 py-4 text-right space-y-1">
                      {sample.isDuplicate && (
                        <div className="flex justify-end space-x-2 mb-2">
                          <button
                            onClick={() => handleResolveDuplicate(sample.id, true)}
                            className="text-xs text-purple-600 hover:text-purple-800"
                            title="保留原始，删除此重复"
                          >
                            删重复
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => handleResolveDuplicate(sample.id, false)}
                            className="text-xs text-purple-600 hover:text-purple-800"
                            title="保留此条，合并历史"
                          >
                            留此条
                          </button>
                        </div>
                      )}
                      <Link
                        to={`/sample/${sample.id}`}
                        className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                      >
                        复核 →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">确认重置数据？</h3>
            <p className="text-gray-600 mb-6">
              此操作将重置所有样本和复核记录到初始状态，已有的复核操作将丢失。
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="btn-secondary"
                disabled={resetting}
              >
                取消
              </button>
              <button
                onClick={handleReset}
                className="btn-danger"
                disabled={resetting}
              >
                {resetting ? '重置中...' : '确认重置'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
