import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Users, CheckCircle, XCircle, Clock } from 'lucide-react';
import FilterPanel from '@/components/filter/FilterPanel';
import StatusBadge from '@/components/common/StatusBadge';
import { useRecordStore } from '@/store/useRecordStore';
import { useFilterStore } from '@/store/useFilterStore';
import { exportToExcel, getWeeklyReportData, formatDate } from '@/utils/export';
import { STATUS_LABELS, TYPE_LABELS } from '@/types';

const WeeklyReport: React.FC = () => {
  const { records, initData, getFilteredRecords } = useRecordStore();
  const filters = useFilterStore((state) => state.getFilters());
  const [filterSnapshot, setFilterSnapshot] = useState<string>('');

  useEffect(() => {
    initData();
  }, [initData]);

  const filteredRecords = useMemo(() => {
    return getFilteredRecords(filters);
  }, [getFilteredRecords, filters]);

  const reportData = useMemo(() => {
    return getWeeklyReportData(filteredRecords);
  }, [filteredRecords]);

  const handleExport = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    exportToExcel(filteredRecords, `质检周报_${dateStr}`);
  };

  const handleSaveSnapshot = () => {
    setFilterSnapshot(JSON.stringify(filters, null, 2));
  };

  const statCards = [
    {
      label: '总记录数',
      value: reportData.total,
      icon: FileText,
      color: 'bg-blue-500',
    },
    {
      label: '已通过',
      value: reportData.statusStats.approved || 0,
      icon: CheckCircle,
      color: 'bg-green-500',
    },
    {
      label: '已驳回',
      value: reportData.statusStats.rejected || 0,
      icon: XCircle,
      color: 'bg-red-500',
    },
    {
      label: '待处理',
      value: reportData.statusStats.pending || 0,
      icon: Clock,
      color: 'bg-orange-500',
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">质检周报</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveSnapshot}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50 transition-colors"
          >
            保存筛选快照
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            导出周报
          </button>
        </div>
      </div>

      <FilterPanel />

      {filterSnapshot && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-green-700 mb-2">当前筛选条件快照（导出周报时使用）：</p>
          <pre className="text-xs text-green-600 bg-white rounded p-2 overflow-x-auto">
            {filterSnapshot}
          </pre>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {card.value}
                  </p>
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">状态分布</h3>
          <div className="space-y-3">
            {Object.entries(reportData.statusStats).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusBadge status={status as keyof typeof STATUS_LABELS} />
                  <span className="text-sm text-gray-600">
                    {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{
                        width: `${(count / reportData.total) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-12 text-right">
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">类型分布</h3>
          <div className="space-y-3">
            {Object.entries(reportData.typeStats).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {TYPE_LABELS[type as keyof typeof TYPE_LABELS]}
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{
                        width: `${(count / reportData.total) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-12 text-right">
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Users className="w-4 h-4" />
          处理人统计
        </h3>
        {Object.keys(reportData.handlerStats).length === 0 ? (
          <p className="text-sm text-gray-500">暂无处理数据</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(reportData.handlerStats).map(([name, count]) => (
              <div
                key={name}
                className="bg-gray-50 rounded-lg p-4 text-center"
              >
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-sm text-gray-500">{name}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">周报明细</h3>
          <p className="text-xs text-gray-500 mt-1">
            当前筛选条件下共 {filteredRecords.length} 条记录
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  记录ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  来源
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  内容
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  类型
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  处理人
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  更新时间
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRecords.slice(0, 20).map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">
                    {record.id}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[120px] truncate">
                    {record.source}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">
                    {record.content}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {TYPE_LABELS[record.type]}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {record.handlerName || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(record.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredRecords.length > 20 && (
          <div className="px-4 py-3 border-t border-gray-200 text-center text-sm text-gray-500">
            仅显示前 20 条，完整数据请导出查看
          </div>
        )}
      </div>
    </div>
  );
};

export default WeeklyReport;
