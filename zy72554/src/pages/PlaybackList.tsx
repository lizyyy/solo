import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Eye,
  FileText,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  Edit3
} from 'lucide-react';
import { useAppStore } from '../store';
import { getStatusLabel, getStatusColor, getStepLabel } from '../utils';

export const PlaybackListPage = () => {
  const navigate = useNavigate();
  const { playbackRecords, anomalies } = useAppStore();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredRecords = playbackRecords.filter(record => {
    const matchSearch = record.fileName.toLowerCase().includes(searchText.toLowerCase()) ||
      record.noteId.toLowerCase().includes(searchText.toLowerCase()) ||
      record.operator.toLowerCase().includes(searchText.toLowerCase());
    const matchStatus = statusFilter === 'all' || record.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getAnomalyCount = (playbackId: string) => {
    return anomalies.filter(a => a.playbackId === playbackId && !a.reviewResult).length;
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 font-display mb-2">样本回放列表</h1>
          <p className="text-gray-500">查看所有阈值调参回放记录，支持筛选和搜索</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索文件名、笔记ID、操作人员..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all bg-white"
            >
              <option value="all">全部状态</option>
              <option value="normal">正常</option>
              <option value="pending_review">待复核</option>
              <option value="modified">已修改</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                文件名
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                笔记ID
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作人员
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                当前步骤
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                创建时间
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredRecords.map((record, index) => {
              const anomalyCount = getAnomalyCount(record.id);
              return (
                <tr
                  key={record.id}
                  className="hover:bg-gray-50 transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-primary-500 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-800">{record.fileName}</p>
                        {record.remark && (
                          <p className="text-xs text-gray-500 truncate max-w-xs">{record.remark}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-gray-600">{record.noteId}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700">{record.operator}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {getStepLabel(record.currentStep)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${getStatusColor(record.status)} ${record.status === 'pending_review' ? 'animate-pulse' : ''}`}></span>
                      <span className="text-sm font-medium text-gray-700">
                        {getStatusLabel(record.status)}
                      </span>
                      {anomalyCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                          <AlertTriangle className="w-3 h-3" />
                          {anomalyCount}项待复核
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                      <Clock className="w-4 h-4" />
                      {record.createdAt}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => navigate(`/playbacks/${record.id}`)}
                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredRecords.length === 0 && (
          <div className="py-16 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无匹配的回放记录</p>
          </div>
        )}
      </div>
    </div>
  );
};
