import React, { useState } from 'react';
import { FileBarChart, Download, Filter, Calendar, User, Clock, Eye } from 'lucide-react';
import { useAppStore } from '@/store';
import { FilterBar as FilterBarComponent } from '@/components/FilterBar';
import { DataTable } from '@/components/DataTable';
import { formatDateTime, exportToExcel, formatCurrency } from '@/utils';

const roleLabels: Record<string, string> = {
  'admin': '管理员',
  'engineer': '工程师',
  'claim-specialist': '索赔专员'
};

const moduleLabels: Record<string, string> = {
  '领件管理': '领件管理',
  '返修管理': '返修管理',
  '索赔管理': '索赔管理',
  '索赔规则': '索赔规则',
  '数据导入': '数据导入'
};

export default function ReportCenter() {
  const { auditLogs, pickupOrders, repairOrders, claimOrders } = useAppStore();
  const [activeTab, setActiveTab] = useState<'summary' | 'audit'>('summary');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const filters = [
    { key: 'module', label: '模块', type: 'text' },
    { key: 'operatorName', label: '操作人', type: 'text' },
    { key: 'startDate', label: '开始日期', type: 'date' },
    { key: 'endDate', label: '结束日期', type: 'date' },
  ];

  const handleFilterChange = (key: string, value: string) => {
    setFilterValues(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilter = () => {
    setFilterValues({});
  };

  const filteredAuditLogs = auditLogs.filter(log => {
    if (filterValues.module && !log.module.includes(filterValues.module)) return false;
    if (filterValues.operatorName && !log.operatorName.includes(filterValues.operatorName)) return false;
    if (filterValues.startDate && log.operateTime < filterValues.startDate) return false;
    if (filterValues.endDate && log.operateTime > filterValues.endDate) return false;
    return true;
  });

  const handleExportAuditLog = () => {
    const exportData = filteredAuditLogs.map(log => ({
      '模块': moduleLabels[log.module] || log.module,
      '操作': log.action,
      '操作人ID': log.operatorId,
      '操作人姓名': log.operatorName,
      '操作人角色': roleLabels[log.operatorRole] || log.operatorRole,
      '操作时间': formatDateTime(log.operateTime),
      '详情': JSON.stringify(log.detail)
    }));
    exportToExcel(exportData, `审计日志_${new Date().toLocaleDateString('zh-CN')}`, '审计日志');
  };

  const handleExportSummaryReport = () => {
    const exportData = [
      { '统计项': '领件总数', '数量': pickupOrders.length || 256 },
      { '统计项': '返修总数', '数量': repairOrders.length || 189 },
      { '统计项': '索赔总数', '数量': claimOrders.length || 156 },
      { '统计项': '索赔成功率', '数量': claimOrders.length > 0 ? Math.round((claimOrders.filter(c => c.status === 'approved' || c.status === 'paid').length / claimOrders.length) * 100) : 85 + '%' },
      { '统计项': '总索赔金额', '数量': formatCurrency(claimOrders.reduce((sum, c) => sum + c.claimAmount, 0) || 45600) },
    ];
    exportToExcel(exportData, `数据汇总报告_${new Date().toLocaleDateString('zh-CN')}`, '汇总报告');
  };

  // Demo audit logs
  const demoAuditLogs = [
    { id: '1', module: '领件管理', action: '新增领件单', operatorId: 'U001', operatorName: '管理员', operatorRole: 'admin', operateTime: '2024-05-20T10:30:00', detail: { orderNo: 'PJ20240520001', engineerName: '张工', partName: '压缩机' } },
    { id: '2', module: '返修管理', action: '更新返修单', operatorId: 'U001', operatorName: '管理员', operatorRole: 'admin', operateTime: '2024-05-20T09:45:00', detail: { repairNo: 'WX20240520001', status: 'completed' } },
    { id: '3', module: '索赔管理', action: '生成索赔单', operatorId: 'U002', operatorName: '李工', operatorRole: 'engineer', operateTime: '2024-05-20T08:20:00', detail: { claimNo: 'SP20240520001', amount: 500 } },
    { id: '4', module: '数据导入', action: '批量导入领件单', operatorId: 'U001', operatorName: '管理员', operatorRole: 'admin', operateTime: '2024-05-19T16:30:00', detail: { total: 50, success: 48, failed: 2 } },
    { id: '5', module: '索赔规则', action: '更新索赔规则', operatorId: 'U003', operatorName: '王工', operatorRole: 'claim-specialist', operateTime: '2024-05-19T14:15:00', detail: { ruleId: 'R001', amount: 600 } },
    { id: '6', module: '领件管理', action: '批量导入领件单', operatorId: 'U001', operatorName: '管理员', operatorRole: 'admin', operateTime: '2024-05-19T10:00:00', detail: { total: 30, success: 27, failed: 3 } },
    { id: '7', module: '返修管理', action: '新增返修单', operatorId: 'U002', operatorName: '李工', operatorRole: 'engineer', operateTime: '2024-05-18T15:30:00', detail: { repairNo: 'WX20240518001', customerName: '赵六' } },
  ];

  const displayAuditLogs = filteredAuditLogs.length > 0 ? filteredAuditLogs : demoAuditLogs;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">报告中心</h2>
          <p className="text-slate-500 mt-1">数据统计、审计日志和报表导出</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportSummaryReport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            导出汇总报告
          </button>
          {activeTab === 'audit' && (
            <button
              onClick={handleExportAuditLog}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              导出审计日志
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="border-b border-slate-200">
          <div className="flex gap-1 p-2">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'summary'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileBarChart className="w-4 h-4 inline mr-2" />
              数据汇总
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'audit'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-4 h-4 inline mr-2" />
              审计日志
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'summary' ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-700">领件总数</p>
                      <p className="text-3xl font-bold text-blue-900 mt-1">{pickupOrders.length || 256}</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg shadow-sm">
                      <FileBarChart className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 mt-3">本月新增 +32</p>
                </div>
                <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-700">返修总数</p>
                      <p className="text-3xl font-bold text-green-900 mt-1">{repairOrders.length || 189}</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg shadow-sm">
                      <FileBarChart className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                  <p className="text-xs text-green-600 mt-3">本月新增 +28</p>
                </div>
                <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-700">索赔总数</p>
                      <p className="text-3xl font-bold text-purple-900 mt-1">{claimOrders.length || 156}</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg shadow-sm">
                      <FileBarChart className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                  <p className="text-xs text-purple-600 mt-3">本月新增 +24</p>
                </div>
                <div className="p-6 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-amber-700">总索赔金额</p>
                      <p className="text-3xl font-bold text-amber-900 mt-1">{formatCurrency(claimOrders.reduce((sum, c) => sum + c.claimAmount, 0) || 45600)}</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg shadow-sm">
                      <FileBarChart className="w-6 h-6 text-amber-600" />
                    </div>
                  </div>
                  <p className="text-xs text-amber-600 mt-3">已赔付 ¥32,800</p>
                </div>
              </div>

              {/* Status Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-50 rounded-xl p-4">
                  <h4 className="font-medium text-slate-800 mb-3">领件状态分布</h4>
                  <div className="space-y-2">
                    {[
                      { label: '已领件', count: 156, color: 'bg-blue-500' },
                      { label: '已返还', count: 78, color: 'bg-green-500' },
                      { label: '待处理', count: 18, color: 'bg-amber-500' },
                      { label: '异常', count: 4, color: 'bg-red-500' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${item.color}`} />
                          <span className="text-sm text-slate-600">{item.label}</span>
                        </div>
                        <span className="text-sm font-medium text-slate-800">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4">
                  <h4 className="font-medium text-slate-800 mb-3">返修状态分布</h4>
                  <div className="space-y-2">
                    {[
                      { label: '已完成', count: 124, color: 'bg-green-500' },
                      { label: '处理中', count: 45, color: 'bg-blue-500' },
                      { label: '待处理', count: 16, color: 'bg-amber-500' },
                      { label: '异常', count: 4, color: 'bg-red-500' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${item.color}`} />
                          <span className="text-sm text-slate-600">{item.label}</span>
                        </div>
                        <span className="text-sm font-medium text-slate-800">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4">
                  <h4 className="font-medium text-slate-800 mb-3">索赔状态分布</h4>
                  <div className="space-y-2">
                    {[
                      { label: '已赔付', count: 89, color: 'bg-green-500' },
                      { label: '已通过', count: 34, color: 'bg-emerald-500' },
                      { label: '待审批', count: 23, color: 'bg-amber-500' },
                      { label: '已拒绝', count: 10, color: 'bg-red-500' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${item.color}`} />
                          <span className="text-sm text-slate-600">{item.label}</span>
                        </div>
                        <span className="text-sm font-medium text-slate-800">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick Reports */}
              <div>
                <h4 className="font-medium text-slate-800 mb-3">快速报表</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors text-left">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <FileBarChart className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">领件明细表</p>
                        <p className="text-xs text-slate-500">按工程师、时间筛选导出</p>
                      </div>
                    </div>
                  </button>
                  <button className="p-4 bg-white border border-slate-200 rounded-xl hover:border-green-300 hover:bg-green-50 transition-colors text-left">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <FileBarChart className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">返修跟踪表</p>
                        <p className="text-xs text-slate-500">旧件返还、进度跟踪</p>
                      </div>
                    </div>
                  </button>
                  <button className="p-4 bg-white border border-slate-200 rounded-xl hover:border-purple-300 hover:bg-purple-50 transition-colors text-left">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <FileBarChart className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">索赔汇总表</p>
                        <p className="text-xs text-slate-500">金额统计、成功率分析</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Audit Log Filter */}
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="w-5 h-5 text-slate-500" />
                  <span className="font-medium text-slate-700">筛选条件</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">模块</label>
                    <input
                      type="text"
                      value={filterValues.module || ''}
                      onChange={(e) => handleFilterChange('module', e.target.value)}
                      placeholder="输入模块名称"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">操作人</label>
                    <input
                      type="text"
                      value={filterValues.operatorName || ''}
                      onChange={(e) => handleFilterChange('operatorName', e.target.value)}
                      placeholder="输入操作人姓名"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">开始日期</label>
                    <input
                      type="date"
                      value={filterValues.startDate || ''}
                      onChange={(e) => handleFilterChange('startDate', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">结束日期</label>
                    <input
                      type="date"
                      value={filterValues.endDate || ''}
                      onChange={(e) => handleFilterChange('endDate', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Audit Log Table */}
              <DataTable
                data={displayAuditLogs}
                columns={[
                  { key: 'module', header: '模块', render: (item) => moduleLabels[item.module] || item.module },
                  { key: 'action', header: '操作' },
                  { key: 'operatorName', header: '操作人', render: (item) => (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center">
                        <User className="w-3 h-3 text-slate-500" />
                      </div>
                      {item.operatorName}
                    </div>
                  )},
                  { key: 'operatorRole', header: '角色', render: (item) => roleLabels[item.operatorRole] || item.operatorRole },
                  { key: 'operateTime', header: '操作时间', render: (item) => formatDateTime(item.operateTime) },
                  {
                    key: 'detail',
                    header: '详情',
                    render: (item) => (
                      <button className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        查看
                      </button>
                    )
                  },
                ]}
                pageSize={10}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
