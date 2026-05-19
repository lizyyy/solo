import React, { useState } from 'react';
import { Plus, Download, FileJson, Eye } from 'lucide-react';
import { useAppStore } from '@/store';
import { FilterBar } from '@/components/FilterBar';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { FileImport } from '@/components/FileImport';
import { formatDate, exportToExcel, exportToCSV } from '@/utils';

const repairTemplate = {
  label: '返修单导入模板',
  data: [
    { repairNo: 'WX202405001', pickupOrderId: 'PJ202405001', customerName: '张三', customerPhone: '13800138000', faultType: '不制冷', faultDescription: '制冷效果差', repairDate: '2024-05-15', engineerId: 'E001', engineerName: '张工', oldPartReturned: 'yes', status: 'completed' },
    { repairNo: 'WX202405002', pickupOrderId: '', customerName: '李四', customerPhone: '13900139000', faultType: '噪音大', faultDescription: '运行时有异响', repairDate: '2024-05-14', engineerId: 'E002', engineerName: '李工', oldPartReturned: 'partial', status: 'processing' },
  ]
};

export default function RepairOrders() {
  const { repairOrders, filterRepairOrders, batchImportRepairOrders, generateClaimFromRepair } = useAppStore();
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
        { value: 'processing', label: '处理中' },
        { value: 'completed', label: '已完成' },
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

  const filteredData = filterRepairOrders(filterValues);

  const handleGenerateClaim = (repairId: string) => {
    generateClaimFromRepair(repairId);
  };

  const handleExportExcel = () => {
    const exportData = filteredData.map(item => ({
      '返修单号': item.repairNo,
      '关联领件单号': item.pickupOrderId || '-',
      '客户姓名': item.customerName,
      '联系电话': item.customerPhone || '-',
      '故障类型': item.faultType,
      '故障描述': item.faultDescription || '-',
      '维修日期': item.repairDate,
      '工程师ID': item.engineerId,
      '工程师姓名': item.engineerName,
      '旧件返还': item.oldPartReturned === 'yes' ? '已返还' : item.oldPartReturned === 'partial' ? '部分返还' : '未返还',
      '状态': item.status === 'pending' ? '待处理' : item.status === 'processing' ? '处理中' : item.status === 'completed' ? '已完成' : '异常',
      '创建人': item.createdBy,
      '创建日期': item.createdAt,
    }));
    exportToExcel(exportData, `返修单_${new Date().toLocaleDateString('zh-CN')}`, '返修单');
  };

  const handleExportCSV = () => {
    const exportData = filteredData.map(item => ({
      '返修单号': item.repairNo,
      '客户姓名': item.customerName,
      '故障类型': item.faultType,
      '维修日期': item.repairDate,
      '工程师姓名': item.engineerName,
      '旧件返还': item.oldPartReturned === 'yes' ? '已返还' : item.oldPartReturned === 'partial' ? '部分返还' : '未返还',
      '状态': item.status === 'pending' ? '待处理' : item.status === 'processing' ? '处理中' : item.status === 'completed' ? '已完成' : '异常',
    }));
    exportToCSV(exportData, `返修单_${new Date().toLocaleDateString('zh-CN')}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">返修管理</h2>
          <p className="text-slate-500 mt-1">管理维修工单和旧件返还记录</p>
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
            <FileJson className="w-4 h-4" />
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
            新增返修
          </button>
        </div>
      </div>

      {/* Import Section */}
      {showImport && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">导入返修单数据</h3>
          <FileImport
            accept=".json,.csv"
            onImport={batchImportRepairOrders}
            template={repairTemplate}
            description="支持JSON和CSV格式文件，点击下载模板查看格式要求"
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
            返修单列表
            <span className="ml-2 text-sm font-normal text-slate-500">
              共 {filteredData.length} 条记录
            </span>
          </h3>
        </div>
        <DataTable
          data={filteredData.length > 0 ? filteredData : [
            { id: '1', repairNo: 'WX202405001', pickupOrderId: 'PJ202405001', customerName: '张三', faultType: '不制冷', repairDate: '2024-05-15', engineerName: '张工', oldPartReturned: 'yes', status: 'completed', createdBy: '管理员', createdAt: '2024-05-15' },
            { id: '2', repairNo: 'WX202405002', pickupOrderId: '', customerName: '李四', faultType: '噪音大', repairDate: '2024-05-14', engineerName: '李工', oldPartReturned: 'partial', status: 'processing', createdBy: '管理员', createdAt: '2024-05-14' },
            { id: '3', repairNo: 'WX202405003', pickupOrderId: 'PJ202405003', customerName: '王五', faultType: '漏水', repairDate: '2024-05-13', engineerName: '王工', oldPartReturned: 'no', status: 'pending', createdBy: '管理员', createdAt: '2024-05-13' },
            { id: '4', repairNo: 'WX202405004', pickupOrderId: 'PJ202405004', customerName: '赵六', faultType: '无法启动', repairDate: '2024-05-12', engineerName: '赵工', oldPartReturned: 'yes', status: 'abnormal', createdBy: '管理员', createdAt: '2024-05-12' },
          ]}
          columns={[
            { key: 'repairNo', header: '返修单号', width: '140px' },
            { key: 'customerName', header: '客户姓名' },
            { key: 'faultType', header: '故障类型' },
            { key: 'repairDate', header: '维修日期', render: (item) => formatDate(item.repairDate) },
            { key: 'engineerName', header: '工程师' },
            { key: 'oldPartReturned', header: '旧件返还', render: (item) => <StatusBadge status={item.oldPartReturned} /> },
            { key: 'status', header: '状态', render: (item) => <StatusBadge status={item.status} /> },
            {
              key: 'actions',
              header: '操作',
              render: (item) => (
                <div className="flex items-center gap-2">
                  <button className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    详情
                  </button>
                  <button
                    onClick={() => handleGenerateClaim(item.id)}
                    className="text-purple-600 hover:text-purple-700 text-sm"
                  >
                    生成索赔
                  </button>
                </div>
              )
            },
          ]}
          pageSize={10}
        />
      </div>
    </div>
  );
}
