import React, { useState } from 'react';
import { Plus, Download, Filter } from 'lucide-react';
import { useAppStore } from '@/store';
import { FilterBar } from '@/components/FilterBar';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { FileImport } from '@/components/FileImport';
import { formatDate, exportToExcel, exportToCSV } from '@/utils';
import { PickupOrder } from '@/types';

const pickupTemplate = {
  label: '领件单导入模板',
  data: [
    { engineerId: 'E001', engineerName: '张工', partCode: 'P001', partName: '压缩机', quantity: 2, pickupDate: '2024-05-15', status: 'pending' },
    { engineerId: 'E002', engineerName: '李工', partCode: 'P002', partName: '主板', quantity: 1, pickupDate: '2024-05-14', status: 'picked' },
  ]
};

export default function PickupOrders() {
  const { pickupOrders, filterPickupOrders, batchImportPickupOrders } = useAppStore();
  const [showImport, setShowImport] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const filters = [
    { key: 'operator', label: '工程师', type: 'text' },
    { key: 'startDate', label: '开始日期', type: 'date' },
    { key: 'endDate', label: '结束日期', type: 'date' },
    {
      key: 'status',
      label: '状态',
      type: 'select',
      options: [
        { value: 'pending', label: '待处理' },
        { value: 'picked', label: '已领件' },
        { value: 'returned', label: '已返还' },
        { value: 'abnormal', label: '异常' },
      ]
    },
  ];

  const handleFilterChange = (key: string, value: string) => {
    setFilterValues(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilter = () => {
    setFilterValues({});
  };

  const filteredData = filterPickupOrders(filterValues);

  const handleExportExcel = () => {
    const exportData = filteredData.map(item => ({
      '领件单号': item.orderNo,
      '工程师ID': item.engineerId,
      '工程师姓名': item.engineerName,
      '配件编码': item.partCode,
      '配件名称': item.partName,
      '数量': item.quantity,
      '领件日期': item.pickupDate,
      '状态': item.status === 'pending' ? '待处理' : item.status === 'picked' ? '已领件' : item.status === 'returned' ? '已返还' : '异常',
      '创建人': item.createdBy,
      '创建日期': item.createdAt,
    }));
    exportToExcel(exportData, `领件单_${new Date().toLocaleDateString('zh-CN')}`, '领件单');
  };

  const handleExportCSV = () => {
    const exportData = filteredData.map(item => ({
      '领件单号': item.orderNo,
      '工程师ID': item.engineerId,
      '工程师姓名': item.engineerName,
      '配件编码': item.partCode,
      '配件名称': item.partName,
      '数量': item.quantity,
      '领件日期': item.pickupDate,
      '状态': item.status === 'pending' ? '待处理' : item.status === 'picked' ? '已领件' : item.status === 'returned' ? '已返还' : '异常',
    }));
    exportToCSV(exportData, `领件单_${new Date().toLocaleDateString('zh-CN')}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">领件管理</h2>
          <p className="text-slate-500 mt-1">管理工程师配件领取记录</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowImport(!showImport)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              showImport
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            导入数据
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            导出CSV
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            导出Excel
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />
            新增领件
          </button>
        </div>
      </div>

      {/* Import Section */}
      {showImport && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">导入领件单数据</h3>
          <FileImport
            accept=".csv"
            onImport={batchImportPickupOrders}
            template={pickupTemplate}
            description="支持CSV格式文件，点击下载模板查看格式要求"
          />
        </div>
      )}

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        values={filterValues}
        onChange={handleFilterChange}
        onClear={handleClearFilter}
      />

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">
            领件单列表
            <span className="ml-2 text-sm font-normal text-slate-500">
              共 {filteredData.length} 条记录
            </span>
          </h3>
        </div>
        <DataTable
          data={filteredData.length > 0 ? filteredData : [
            { id: '1', orderNo: 'PJ202405001', engineerName: '张工', partCode: 'P001', partName: '压缩机', quantity: 2, pickupDate: '2024-05-15', status: 'picked', createdBy: '管理员', createdAt: '2024-05-15' },
            { id: '2', orderNo: 'PJ202405002', engineerName: '李工', partCode: 'P002', partName: '主板', quantity: 1, pickupDate: '2024-05-14', status: 'returned', createdBy: '管理员', createdAt: '2024-05-14' },
            { id: '3', orderNo: 'PJ202405003', engineerName: '王工', partCode: 'P003', partName: '电机', quantity: 3, pickupDate: '2024-05-13', status: 'pending', createdBy: '管理员', createdAt: '2024-05-13' },
            { id: '4', orderNo: 'PJ202405004', engineerName: '赵工', partCode: 'P004', partName: '冷凝器', quantity: 1, pickupDate: '2024-05-12', status: 'abnormal', createdBy: '管理员', createdAt: '2024-05-12' },
          ]}
          columns={[
            { key: 'orderNo', header: '领件单号', width: '140px' },
            { key: 'engineerName', header: '工程师' },
            { key: 'partCode', header: '配件编码' },
            { key: 'partName', header: '配件名称' },
            { key: 'quantity', header: '数量' },
            { key: 'pickupDate', header: '领件日期', render: (item) => formatDate(item.pickupDate) },
            { key: 'status', header: '状态', render: (item) => <StatusBadge status={item.status} /> },
            { key: 'createdBy', header: '创建人' },
            { key: 'createdAt', header: '创建时间', render: (item) => formatDate(item.createdAt) },
          ]}
          pageSize={10}
        />
      </div>
    </div>
  );
}
