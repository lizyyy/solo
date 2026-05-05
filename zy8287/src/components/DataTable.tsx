import React, { useState, useMemo } from 'react';
import type { AggregatedData } from '../types';
import { formatCurrency, formatPercent } from '../utils/exportUtils';

interface DataTableProps {
  data: AggregatedData[];
}

type SortField = 'timeSlot' | 'hallName' | 'boothName' | 'visitors' | 'orders' | 'revenue' | 'conversionRate' | 'avgOrderValue' | 'visitorGapPercent' | 'orderGapPercent' | 'revenueGapPercent';
type SortDirection = 'asc' | 'desc';

const DataTable: React.FC<DataTableProps> = ({ data }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<SortField>('revenue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(
      (item) =>
        item.timeSlot.toLowerCase().includes(term) ||
        item.hallName.toLowerCase().includes(term) ||
        item.boothName.toLowerCase().includes(term) ||
        item.exhibitor.toLowerCase().includes(term) ||
        item.industry.toLowerCase().includes(term)
    );
  }, [data, searchTerm]);

  const sortedData = useMemo(() => {
    const sorted = [...filteredData].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'timeSlot':
          comparison = a.timeSlot.localeCompare(b.timeSlot);
          break;
        case 'hallName':
          comparison = a.hallName.localeCompare(b.hallName);
          break;
        case 'boothName':
          comparison = a.boothName.localeCompare(b.boothName);
          break;
        case 'visitors':
          comparison = a.visitors - b.visitors;
          break;
        case 'orders':
          comparison = a.orders - b.orders;
          break;
        case 'revenue':
          comparison = a.revenue - b.revenue;
          break;
        case 'conversionRate':
          comparison = a.conversionRate - b.conversionRate;
          break;
        case 'avgOrderValue':
          comparison = a.avgOrderValue - b.avgOrderValue;
          break;
        case 'visitorGapPercent':
          comparison = a.visitorGapPercent - b.visitorGapPercent;
          break;
        case 'orderGapPercent':
          comparison = a.orderGapPercent - b.orderGapPercent;
          break;
        case 'revenueGapPercent':
          comparison = a.revenueGapPercent - b.revenueGapPercent;
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredData, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-300 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return (
      <svg
        className={`w-4 h-4 ml-1 text-primary ${sortDirection === 'asc' ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const getGapColor = (gapPercent: number): string => {
    if (gapPercent >= 0) return 'text-success';
    if (gapPercent >= -0.2) return 'text-warning';
    return 'text-danger';
  };

  const getGapIcon = (gapPercent: number) => {
    if (gapPercent >= 0) {
      return (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      );
    }
    return (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    );
  };

  if (data.length === 0) {
    return (
      <div className="card">
        <div className="card-header">数据明细</div>
        <div className="card-body flex items-center justify-center h-48 text-gray-400">
          暂无数据
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card-header flex items-center justify-between">
        <span>数据明细</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">共 {sortedData.length} 条记录</span>
          <div className="relative">
            <input
              type="text"
              placeholder="搜索..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="input pl-8 w-48"
            />
            <svg
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('timeSlot')}
              >
                <div className="flex items-center">
                  时段
                  <SortIcon field="timeSlot" />
                </div>
              </th>
              <th
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('hallName')}
              >
                <div className="flex items-center">
                  展馆
                  <SortIcon field="hallName" />
                </div>
              </th>
              <th
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('boothName')}
              >
                <div className="flex items-center">
                  摊位
                  <SortIcon field="boothName" />
                </div>
              </th>
              <th
                className="cursor-pointer hover:bg-gray-100 text-right"
                onClick={() => handleSort('visitors')}
              >
                <div className="flex items-center justify-end">
                  客流
                  <SortIcon field="visitors" />
                </div>
              </th>
              <th
                className="cursor-pointer hover:bg-gray-100 text-right"
                onClick={() => handleSort('orders')}
              >
                <div className="flex items-center justify-end">
                  订单
                  <SortIcon field="orders" />
                </div>
              </th>
              <th
                className="cursor-pointer hover:bg-gray-100 text-right"
                onClick={() => handleSort('revenue')}
              >
                <div className="flex items-center justify-end">
                  成交额
                  <SortIcon field="revenue" />
                </div>
              </th>
              <th
                className="cursor-pointer hover:bg-gray-100 text-right"
                onClick={() => handleSort('conversionRate')}
              >
                <div className="flex items-center justify-end">
                  转化率
                  <SortIcon field="conversionRate" />
                </div>
              </th>
              <th
                className="cursor-pointer hover:bg-gray-100 text-right"
                onClick={() => handleSort('avgOrderValue')}
              >
                <div className="flex items-center justify-end">
                  客单价
                  <SortIcon field="avgOrderValue" />
                </div>
              </th>
              <th
                className="cursor-pointer hover:bg-gray-100 text-right"
                onClick={() => handleSort('revenueGapPercent')}
              >
                <div className="flex items-center justify-end">
                  目标差距
                  <SortIcon field="revenueGapPercent" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((item, index) => (
              <tr key={`${item.timeSlot}-${item.boothId}-${index}`}>
                <td className="text-sm">{item.timeSlot}</td>
                <td className="text-sm">{item.hallName}</td>
                <td>
                  <div>
                    <div className="text-sm font-medium text-gray-800">{item.boothName}</div>
                    <div className="text-xs text-gray-500">{item.exhibitor}</div>
                  </div>
                </td>
                <td className="text-right text-sm font-medium">{item.visitors.toLocaleString()}</td>
                <td className="text-right text-sm font-medium">{item.orders.toLocaleString()}</td>
                <td className="text-right text-sm font-medium">{formatCurrency(item.revenue)}</td>
                <td className="text-right">
                  <span
                    className={`tag ${
                      item.conversionRate >= 0.2
                        ? 'tag-success'
                        : item.conversionRate >= 0.1
                        ? 'tag-primary'
                        : 'tag-warning'
                    }`}
                  >
                    {formatPercent(item.conversionRate)}
                  </span>
                </td>
                <td className="text-right text-sm">{formatCurrency(item.avgOrderValue)}</td>
                <td className="text-right">
                  <div className={`inline-flex items-center gap-1 ${getGapColor(item.revenueGapPercent)}`}>
                    {getGapIcon(item.revenueGapPercent)}
                    <span className="text-sm font-medium">
                      {formatPercent(Math.abs(item.revenueGapPercent))}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">每页显示</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="select py-1 text-sm"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-sm text-gray-500">条</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="btn btn-outline py-1 px-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm text-gray-600">
            第 {currentPage} / {totalPages || 1} 页
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="btn btn-outline py-1 px-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataTable;
