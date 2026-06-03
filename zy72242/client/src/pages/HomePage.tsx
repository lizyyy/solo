import { useState } from 'react';
import { useApp } from '../context/AppContext';
import RecordCard from '../components/RecordCard';
import { STATUS_CONFIG } from '../types';
import { FunnelIcon, MagnifyingGlassIcon, ExclamationTriangleIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function HomePage() {
  const { state } = useApp();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFund, setFilterFund] = useState<string>('');
  const [showOnlyModifications, setShowOnlyModifications] = useState(false);

  const filteredRecords = state.records.filter(record => {
    if (filterStatus !== 'all' && record.status !== filterStatus) return false;
    if (filterFund && !record.fundCode.toLowerCase().includes(filterFund.toLowerCase())) return false;
    if (showOnlyModifications && !record.hasManualModification) return false;
    return true;
  });

  const stats = {
    total: state.records.length,
    reviewing: state.records.filter(r => r.status === 'reviewing').length,
    modifications: state.records.filter(r => r.hasManualModification).length,
    approved: state.records.filter(r => r.status === 'approved').length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif-sc text-gray-900">对账核查主页</h2>
          <p className="text-sm text-gray-500 mt-1">期货交割仓单核查 — 自动标记T+1→T+2修改，生成对账说明</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="card flex items-center space-x-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <DocumentTextIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">总记录数</div>
          </div>
        </div>
        <div className="card flex items-center space-x-4 border-l-4 border-l-amber-400">
          <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
            <ExclamationTriangleIcon className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-600">{stats.reviewing}</div>
            <div className="text-sm text-gray-500">待基金经理复核</div>
          </div>
        </div>
        <div className="card flex items-center space-x-4 border-l-4 border-l-red-400">
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
            <ClockIcon className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{stats.modifications}</div>
            <div className="text-sm text-gray-500">T+1→T+2修改</div>
          </div>
        </div>
        <div className="card flex items-center space-x-4 border-l-4 border-l-green-400">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <CheckCircleIcon className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <div className="text-sm text-gray-500">已通过复核</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex items-center space-x-2">
            <FunnelIcon className="w-5 h-5 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input w-40"
            >
              <option value="all">全部状态</option>
              <option value="pending">待处理</option>
              <option value="reviewing">待基金经理复核</option>
              <option value="approved">已通过</option>
              <option value="rejected">已驳回</option>
            </select>
          </div>
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索基金代码..."
              value={filterFund}
              onChange={(e) => setFilterFund(e.target.value)}
              className="input pl-9"
            />
          </div>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyModifications}
              onChange={(e) => setShowOnlyModifications(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-finance-600 focus:ring-finance-500"
            />
            <span className="text-sm text-gray-700">只看T+1→T+2修改</span>
          </label>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <DocumentTextIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">暂无对账记录</p>
            <p className="text-sm mt-1">请先导入交割数据或初始化演示数据</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRecords.map((record) => (
              <RecordCard key={record.id} record={record} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}
