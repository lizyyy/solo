import React from 'react';
import type { GuaranteeRecord } from '../types';
import { getStatusLabel, getSourceLabel, STATUS_COLORS } from '../types';

interface RecordListProps {
  records: GuaranteeRecord[];
  selectedId: number | null;
  onSelect: (record: GuaranteeRecord) => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export const RecordList: React.FC<RecordListProps> = ({ records, selectedId, onSelect }) => {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin" style={{ maxHeight: 'calc(100vh - 320px)'}}>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">保证函编号</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">客户名称</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">金额</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">来源</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">处理人</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {records.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                  暂无数据
                </td>
              </tr>
            ) : (
                records.map((record) => (
                <tr
                  key={record.id}
                  className={`cursor-pointer hover:bg-gray-50 transition-colors ${selectedId === record.id ? 'bg-blue-50' : ''}`}
                  onClick={() => onSelect(record)}
                >
                  <td className="px-3 py-2 text-sm text-gray-900">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">#</span>
                      {record.id}
                      {record.isDuplicate && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 ml-1">
                          重复
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm font-medium text-gray-900 font-mono">
                    {record.guaranteeNo}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900">
                    {record.customerName}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900">
                    <span className="font-mono">
                      {record.currency} {record.amount?.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-500">
                    {getSourceLabel(record.source)}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[record.status] || 'bg-gray-100 text-gray-800'}`}>
                      {getStatusLabel(record.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-500">
                    {record.currentOperator}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-500">
                    {formatDate(record.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <button
                      className="text-blue-600 hover:text-blue-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(record);
                      }}
                    >
                      查看
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
