import React, { useState } from 'react';
import { Plus, Download, FileText, Settings } from 'lucide-react';
import { useAppStore } from '@/store';
import { FilterBar } from '@/components/FilterBar';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { FileImport } from '@/components/FileImport';
import { formatDate, formatCurrency, exportToExcel, exportToCSV } from '@/utils';

const ruleTemplate = {
  label: '索赔规则导入模板',
  data: [
    { ruleName: '压缩机损坏索赔', faultType: '不制冷', amount: 500, conditions: '压缩机故障且旧件已返还', isActive: true },
    { ruleName: '主板故障索赔', faultType: '无法启动', amount: 300, conditions: '主板损坏且旧件已返还', isActive: true },
  ]
};

export default function ClaimOrders() {
  const { claimOrders, claimRules, filterClaimOrders, batchImportClaimRules, updateClaimRule } = useAppStore();
  const [showRules, setShowRules] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const filters = [
    { key: 'startDate', label: '开始日期', type: 'date' },
    { key: 'endDate', label: '结束日期', type: 'date' },
    {
      key: 'status',
      label: '状态',
      type: 'select',
      options: [
        { value: 'draft', label: '草稿' },
        { value: 'submitted', label: '已提交' },
        { value: 'approved', label: '已通过' },
        { value: 'rejected', label: '已拒绝' },
        { value: 'paid', label: '已赔付' },
      ]
    },
  ];

  const handleFilterChange = (key: string, value: string) => {
    setFilterValues(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilter = () => {
    setFilterValues({});
  };

  const filteredData = filterClaimOrders(filterValues);

  const totalClaimAmount = filteredData.reduce((sum, item) => sum + item.claimAmount, 0);

  const handleExportExcel = () => {
    const exportData = filteredData.map(item => ({
      '索赔单号': item.claimNo,
      '关联返修单号': item.repairOrderId,
      '规则ID': item.ruleId,
      '索赔金额': item.claimAmount,
      '提交日期': item.submitDate || '-',
      '状态': item.status === 'draft' ? '草稿' : item.status === 'submitted' ? '已提交' : item.status === 'approved' ? '已通过' : item.status === 'rejected' ? '已拒绝' : '已赔付',
      '拒绝原因': item.rejectReason || '-',
      '创建人': item.createdBy,
      '创建日期': item.createdAt,
    }));
    exportToExcel(exportData, `索赔单_${new Date().toLocaleDateString('zh-CN')}`, '索赔单');
  };

  const handleExportCSV = () => {
    const exportData = filteredData.map(item => ({
      '索赔单号': item.claimNo,
      '关联返修单号': item.repairOrderId,
      '索赔金额': item.claimAmount,
      '状态': item.status === 'draft' ? '草稿' : item.status === 'submitted' ? '已提交' : item.status === 'approved' ? '已通过' : item.status === 'rejected' ? '已拒绝' : '已赔付',
    }));
    exportToCSV(exportData, `索赔单_${new Date().toLocaleDateString('zh-CN')}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">索赔管理</h2>
          <p className="text-slate-500 mt-1">管理索赔单和索赔规则配置</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowRules(!showRules)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              showRules
                ? 'bg-purple-100 text-purple-700'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            规则配置
          </button>
          <button
            onClick={() => setShowImport(!showImport)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              showImport
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            导入规则
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
            新增索赔
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">总索赔金额</p>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalClaimAmount || 45600)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">已赔付</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(filteredData.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.claimAmount, 0) || 28500)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">待审批</p>
          <p className="text-2xl font-bold text-amber-600">{filteredData.filter(c => c.status === 'submitted' || c.status === 'draft').length || 12}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">成功率</p>
          <p className="text-2xl font-bold text-blue-600">
            {filteredData.length > 0
              ? Math.round((filteredData.filter(c => c.status === 'approved' || c.status === 'paid').length / filteredData.length) * 100)
              : 85}%
          </p>
        </div>
      </div>

      {/* Import Section */}
      {showImport && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">导入索赔规则</h3>
          <FileImport
            accept=".json,.csv"
            onImport={batchImportClaimRules}
            template={ruleTemplate}
            description="支持JSON和CSV格式文件，点击下载模板查看格式要求"
          />
        </div>
      )}

      {/* Rules Section */}
      {showRules && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">索赔规则配置</h3>
          <DataTable
            data={claimRules.length > 0 ? claimRules : [
              { id: '1', ruleName: '压缩机损坏索赔', faultType: '不制冷', amount: 500, conditions: '压缩机故障且旧件已返还', isActive: true },
              { id: '2', ruleName: '主板故障索赔', faultType: '无法启动', amount: 300, conditions: '主板损坏且旧件已返还', isActive: true },
              { id: '3', ruleName: '电机故障索赔', faultType: '噪音大', amount: 200, conditions: '电机故障且旧件已返还', isActive: true },
            ]}
            columns={[
              { key: 'ruleName', header: '规则名称' },
              { key: 'faultType', header: '故障类型' },
              { key: 'amount', header: '索赔金额', render: (item) => formatCurrency(item.amount) },
              { key: 'conditions', header: '条件说明' },
              {
                key: 'isActive',
                header: '状态',
                render: (item) => (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    item.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {item.isActive ? '启用' : '停用'}
                  </span>
                )
              },
            ]}
            pageSize={5}
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
            索赔单列表
            <span className="ml-2 text-sm font-normal text-slate-500">
              共 {filteredData.length} 条记录
            </span>
          </h3>
        </div>
        <DataTable
          data={filteredData.length > 0 ? filteredData : [
            { id: '1', claimNo: 'SP202405001', repairOrderId: 'WX202405001', ruleId: 'R001', claimAmount: 500, status: 'paid', submitDate: '2024-05-15', createdBy: '管理员', createdAt: '2024-05-15' },
            { id: '2', claimNo: 'SP202405002', repairOrderId: 'WX202405002', ruleId: 'R002', claimAmount: 300, status: 'approved', submitDate: '2024-05-14', createdBy: '管理员', createdAt: '2024-05-14' },
            { id: '3', claimNo: 'SP202405003', repairOrderId: 'WX202405003', ruleId: 'R003', claimAmount: 200, status: 'submitted', submitDate: '2024-05-13', createdBy: '管理员', createdAt: '2024-05-13' },
            { id: '4', claimNo: 'SP202405004', repairOrderId: 'WX202405004', ruleId: 'R001', claimAmount: 500, status: 'rejected', submitDate: '2024-05-12', rejectReason: '旧件未返还', createdBy: '管理员', createdAt: '2024-05-12' },
            { id: '5', claimNo: 'SP202405005', repairOrderId: 'WX202405005', ruleId: 'R002', claimAmount: 300, status: 'draft', createdBy: '管理员', createdAt: '2024-05-11' },
          ]}
          columns={[
            { key: 'claimNo', header: '索赔单号', width: '140px' },
            { key: 'repairOrderId', header: '关联返修单' },
            { key: 'ruleId', header: '规则ID' },
            { key: 'claimAmount', header: '索赔金额', render: (item) => formatCurrency(item.claimAmount) },
            { key: 'submitDate', header: '提交日期', render: (item) => item.submitDate ? formatDate(item.submitDate) : '-' },
            { key: 'status', header: '状态', render: (item) => <StatusBadge status={item.status} /> },
            {
              key: 'rejectReason',
              header: '拒绝原因',
              render: (item) => item.rejectReason || '-'
            },
          ]}
          pageSize={10}
        />
      </div>
    </div>
  );
}
