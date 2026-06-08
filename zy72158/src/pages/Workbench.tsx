import { useState } from 'react';
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  History,
  Search,
  Filter,
  RefreshCw,
  Eye
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { OutdoorStall, ApprovalStatus } from '@/types';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import StallDetailModal from '@/components/StallDetailModal';
import { formatDate } from '@/utils/timeUtils';

const statusFilters: { value: ApprovalStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待审批' },
  { value: 'need_confirm', label: '需人工确认' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: 'legacy', label: '历史遗留' },
];

export default function Workbench() {
  const stalls = useStore(state => state.stalls);
  const getStatusCount = useStore(state => state.getStatusCount);
  const resetToSampleData = useStore(state => state.resetToSampleData);
  const [filter, setFilter] = useState<ApprovalStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStall, setSelectedStall] = useState<OutdoorStall | null>(null);

  const filteredStalls = stalls.filter(stall => {
    const matchStatus = filter === 'all' || stall.status === filter;
    const matchSearch = stall.name.includes(searchTerm) || stall.location.includes(searchTerm);
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          title="待审批" 
          value={getStatusCount('pending')} 
          icon={Clock} 
          color="blue" 
        />
        <StatCard 
          title="需人工确认" 
          value={getStatusCount('need_confirm')} 
          icon={AlertTriangle} 
          color="yellow" 
        />
        <StatCard 
          title="审批通过" 
          value={getStatusCount('approved')} 
          icon={CheckCircle} 
          color="green" 
        />
        <StatCard 
          title="审批驳回" 
          value={getStatusCount('rejected')} 
          icon={XCircle} 
          color="red" 
        />
        <StatCard 
          title="历史遗留" 
          value={getStatusCount('legacy')} 
          icon={History} 
          color="gray" 
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900">审批列表</h2>
            <button
              onClick={() => resetToSampleData()}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-primary-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              重置样例
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="搜索商户名称或位置..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm w-64"
              />
            </div>
            <div className="flex items-center gap-1">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as ApprovalStatus | 'all')}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {statusFilters.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">商户名称</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">位置</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">面积</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">经营时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">更新时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStalls.map((stall) => (
                <tr key={stall.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{stall.name}</div>
                    <div className="text-xs text-gray-500">{stall.contact}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{stall.location}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{stall.area}㎡</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{stall.timePeriod}</td>
                  <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={stall.status} /></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(stall.updatedAt)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => setSelectedStall(stall)}
                      className="text-primary-600 hover:text-primary-800 transition-colors flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      查看
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredStalls.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>暂无符合条件的审批记录</p>
          </div>
        )}
      </div>

      {selectedStall && (
        <StallDetailModal 
          stall={selectedStall} 
          onClose={() => setSelectedStall(null)} 
        />
      )}
    </div>
  );
}
