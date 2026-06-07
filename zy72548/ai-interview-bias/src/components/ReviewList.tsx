import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { getStatusName } from '../utils/storage';
import ReviewDetail from './ReviewDetail';
import type { RecordStatus } from '../types';

const ReviewList: React.FC = () => {
  const { state } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RecordStatus | 'all'>('all');
  const [searchText, setSearchText] = useState('');

  const filteredRecords = state.reviewRecords.filter(r => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchSearch = !searchText || 
      r.sampleId.toLowerCase().includes(searchText.toLowerCase()) ||
      r.interview.candidateName.toLowerCase().includes(searchText.toLowerCase());
    return matchStatus && matchSearch;
  });

  const selectedRecord = selectedId 
    ? state.reviewRecords.find(r => r.sampleId === selectedId) 
    : null;

  if (selectedRecord) {
    return <ReviewDetail record={selectedRecord} onBack={() => setSelectedId(null)} />;
  }

  const statusCounts = state.reviewRecords.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getStatusBadgeColor = (status: RecordStatus) => {
    switch (status) {
      case 'conflict_detected': return 'bg-red-100 text-red-700 border-red-200';
      case 'pm_confirmed': return 'bg-green-100 text-green-700 border-green-200';
      case 'pm_rejected': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'pending_operation': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'operation_approved': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'operation_rejected': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'finalized': return 'bg-gray-200 text-gray-800 border-gray-300';
      default: return 'bg-blue-50 text-blue-700 border-blue-100';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">审核列表</h2>

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="搜索样本编号/候选人"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="px-3 py-2 border rounded w-64"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as RecordStatus | 'all')}
          className="px-3 py-2 border rounded"
        >
          <option value="all">全部状态 ({state.reviewRecords.length})</option>
          {Object.entries(statusCounts).map(([status, count]) => (
            <option key={status} value={status}>
              {getStatusName(status as RecordStatus)} ({count})
            </option>
          ))}
        </select>
      </div>

      {state.reviewRecords.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">暂无审核记录</p>
          <p className="text-sm mt-2">请先在「数据导入」页导入面试数据和人工改判表</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">样本编号</th>
                <th className="px-4 py-3 text-left font-medium">候选人</th>
                <th className="px-4 py-3 text-left font-medium">岗位</th>
                <th className="px-4 py-3 text-center font-medium">模型版本</th>
                <th className="px-4 py-3 text-right font-medium">AI评分</th>
                <th className="px-4 py-3 text-right font-medium">人工评分</th>
                <th className="px-4 py-3 text-center font-medium">提示词版本</th>
                <th className="px-4 py-3 text-center font-medium">状态</th>
                <th className="px-4 py-3 text-center font-medium">冲突</th>
                <th className="px-4 py-3 text-center font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRecords.map(record => {
                const unresolvedCount = record.conflicts.filter(c => !c.resolved).length;
                return (
                  <tr key={record.sampleId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono">{record.sampleId}</td>
                    <td className="px-4 py-3">{record.interview.candidateName}</td>
                    <td className="px-4 py-3 text-gray-600">{record.interview.position}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                        {record.interview.modelVersion}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${record.interview.aiScore >= 60 ? 'text-green-600' : 'text-red-600'}`}>
                      {record.interview.aiScore}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${record.correction ? (record.correction.humanScore >= 60 ? 'text-green-600' : 'text-red-600') : 'text-gray-400'}`}>
                      {record.correction ? record.correction.humanScore : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {record.promptVersion ? (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                          {record.promptVersion.versionNumber}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">未补录</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs border ${getStatusBadgeColor(record.status)}`}>
                        {getStatusName(record.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {unresolvedCount > 0 ? (
                        <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs font-medium">
                          {unresolvedCount}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">无</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedId(record.sampleId)}
                        className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredRecords.length === 0 && (
            <p className="text-center py-8 text-gray-500">没有符合条件的记录</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ReviewList;
