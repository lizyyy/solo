import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { Search, Filter, Plus, ChevronRight, AlertTriangle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import AssigneeBadge from '../components/AssigneeBadge';
import DateDisplay from '../components/DateDisplay';
import { TYPE_LABELS, ComplaintType } from '../types';

export default function ComplaintList() {
  const navigate = useNavigate();
  const { complaints } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredComplaints = complaints.filter((c) => {
    const matchesSearch = c.title.includes(searchTerm) || c.code.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const needsAttentionCount = complaints.filter(
    (c) => c.status === 'pending_traffic_review' || c.status === 'pending'
  ).length;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="投诉调解记录"
        subtitle="核心业务台账，全流程追踪每一条投诉的处理状态"
        action={
          <button
            onClick={() => {}}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新建投诉
          </button>
        }
      />

      {needsAttentionCount > 0 && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0" />
          <p className="text-sm text-orange-800">
            有 <span className="font-bold">{needsAttentionCount}</span> 条记录需要您关注，
            包括待交通协管复核的坡道补录记录
          </p>
        </div>
      )}

      <div className="card p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索投诉编号、标题..."
              className="input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              className="input w-40"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">全部状态</option>
              <option value="pending">待处理</option>
              <option value="reviewing">审核中</option>
              <option value="pending_traffic_review">待交通协管复核</option>
              <option value="rectifying">整改中</option>
              <option value="completed">已完成</option>
            </select>
            <select
              className="input w-40"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">全部类型</option>
              <option value="pet_area">宠物活动区</option>
              <option value="ramp">坡道问题</option>
              <option value="other">其他</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">编号</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">标题</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">当前评分</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">负责人</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">更新时间</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredComplaints.map((complaint) => (
              <tr 
                key={complaint.id} 
                className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                  complaint.status === 'pending_traffic_review' ? 'bg-orange-50/50' : ''
                }`}
                onClick={() => navigate(`/complaints/${complaint.id}`)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-mono text-primary-700">{complaint.code}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{complaint.title}</span>
                    {complaint.previousScore === complaint.currentScore && complaint.status === 'pending_traffic_review' && (
                      <span className="badge bg-orange-100 text-orange-700">评分无变化</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-600">{TYPE_LABELS[complaint.type as ComplaintType]}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${
                      complaint.currentScore >= 80 ? 'text-green-600' :
                      complaint.currentScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {complaint.currentScore}
                    </span>
                    {complaint.previousScore !== undefined && complaint.previousScore !== complaint.currentScore && (
                      <span className="text-xs text-gray-500">
                        ({complaint.previousScore < complaint.currentScore ? '↑' : '↓'} {Math.abs(complaint.currentScore - complaint.previousScore)})
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={complaint.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <AssigneeBadge assignee={complaint.assignee} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <DateDisplay date={complaint.updatedAt} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1">
                    详情
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
