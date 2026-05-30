import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  FileText,
  Download,
  FileSpreadsheet,
  ChevronUp,
  ChevronDown,
  Eye,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { FilterPanel } from '../components/FilterPanel';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency, formatDate, formatPercent } from '../utils/format';
import { useState } from 'react';

type SortField =
  | 'applicationNo'
  | 'supplierName'
  | 'payableAmount'
  | 'discountRate'
  | 'createdAt'
  | 'status';
type SortDirection = 'asc' | 'desc';

export function ApplicationList() {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const filters = useAppStore((state) => state.filters);
  const suppliers = useAppStore((state) => state.suppliers);
  const selectedIds = useAppStore((state) => state.selectedIds);
  const setFilters = useAppStore((state) => state.setFilters);
  const toggleSelected = useAppStore((state) => state.toggleSelected);
  const clearSelected = useAppStore((state) => state.clearSelected);
  const selectAll = useAppStore((state) => state.selectAll);
  const getFilteredApplications = useAppStore((state) => state.getFilteredApplications);
  const exportSelectedCSV = useAppStore((state) => state.exportSelectedCSV);
  const exportSelectedExcel = useAppStore((state) => state.exportSelectedExcel);

  const filteredApplications = useMemo(() => {
    const apps = getFilteredApplications();
    return [...apps].sort((a, b) => {
      let aVal: string | number = a[sortField];
      let bVal: string | number = b[sortField];
      if (sortField === 'payableAmount' || sortField === 'discountRate') {
        aVal = aVal as number;
        bVal = bVal as number;
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [getFilteredApplications, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp size={14} />
    ) : (
      <ChevronDown size={14} />
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredApplications.length && filteredApplications.length > 0) {
      clearSelected();
    } else {
      selectAll();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">折扣申请列表</h2>
          <p className="text-sm text-gray-500 mt-1">
            共 {filteredApplications.length} 条记录
            {selectedIds.length > 0 && (
              <span className="ml-2 text-primary-600">
                (已选择 {selectedIds.length} 条)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <>
              <button
                onClick={exportSelectedCSV}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                <FileText size={16} />
                导出CSV
              </button>
              <button
                onClick={exportSelectedExcel}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-success-600 text-white rounded hover:bg-success-700 transition-colors"
              >
                <FileSpreadsheet size={16} />
                导出Excel
              </button>
            </>
          )}
          <button
            onClick={() => navigate('/application/new')}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-700 text-white rounded hover:bg-primary-800 transition-colors"
          >
            <Plus size={16} />
            新建申请
          </button>
        </div>
      </div>

      <FilterPanel
        filters={filters}
        suppliers={suppliers}
        onFilterChange={setFilters}
        onClear={() => {
          setFilters({});
          clearSelected();
        }}
      />

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={
                      filteredApplications.length > 0 &&
                      selectedIds.length === filteredApplications.length
                    }
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th
                  className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('applicationNo')}
                >
                  <div className="flex items-center gap-1">
                    申请编号
                    <SortIcon field="applicationNo" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('supplierName')}
                >
                  <div className="flex items-center gap-1">
                    供应商
                    <SortIcon field="supplierName" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('payableAmount')}
                >
                  <div className="flex items-center justify-end gap-1">
                    应付金额
                    <SortIcon field="payableAmount" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">
                  折扣金额
                </th>
                <th
                  className="px-4 py-3 text-right font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('discountRate')}
                >
                  <div className="flex items-center justify-end gap-1">
                    折扣率
                    <SortIcon field="discountRate" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-center font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center justify-center gap-1">
                    状态
                    <SortIcon field="status" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-center font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center justify-center gap-1">
                    创建日期
                    <SortIcon field="createdAt" />
                  </div>
                </th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredApplications.map((app, index) => (
                <tr
                  key={app.id}
                  className={`hover:bg-primary-50 transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(app.id)}
                      onChange={() => toggleSelected(app.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-primary-700">
                    {app.applicationNo}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-gray-800">
                        {app.supplierName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {app.supplierLevel}级供应商
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(app.payableAmount)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-success-600">
                    -{formatCurrency(app.discountAmount)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatPercent(app.discountRate)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {formatDate(app.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => navigate(`/application/${app.id}`)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-primary-600 hover:bg-primary-100 rounded transition-colors"
                    >
                      <Eye size={14} />
                      详情
                    </button>
                  </td>
                </tr>
              ))}
              {filteredApplications.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <FileText size={48} className="text-gray-300" />
                      <p>暂无符合条件的申请记录</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
