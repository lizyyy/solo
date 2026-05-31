import { useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import StatCard from '../components/StatCard';
import DataTable from '../components/DataTable';
import { Layers, FileDown, Filter, X } from 'lucide-react';

export default function Dashboard() {
  const {
    inspections,
    selectedStatusFilter,
    selectedInspectionIds,
    loading,
    error,
    fetchInspections,
    setStatusFilter,
    toggleInspectionSelection,
    clearSelection,
    selectAll,
    createBatchTask,
  } = useStore();

  useEffect(() => {
    fetchInspections();
  }, [fetchInspections]);

  const stats = useMemo(() => {
    return {
      pending: inspections.filter((i) => i.status === 'pending').length,
      approved: inspections.filter((i) => i.status === 'approved').length,
      exception: inspections.filter((i) => i.status === 'exception').length,
      material_only: inspections.filter((i) => i.status === 'material_only').length,
    };
  }, [inspections]);

  const filteredInspections = useMemo(() => {
    if (!selectedStatusFilter) return inspections;
    return inspections.filter((i) => i.status === selectedStatusFilter);
  }, [inspections, selectedStatusFilter]);

  const handleCreateBatch = async () => {
    if (selectedInspectionIds.length === 0) return;
    const taskName = `批量检查 ${new Date().toLocaleDateString('zh-CN')}`;
    await createBatchTask(selectedInspectionIds, taskName);
    clearSelection();
  };

  const handleBatchExport = () => {
    if (selectedInspectionIds.length === 0) return;
    sessionStorage.setItem('exportSelectedIds', JSON.stringify(selectedInspectionIds));
    window.location.href = '/export';
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">检查工作台</h1>
        <p className="text-slate-600 mt-1">查看和管理所有停车楼坡道检查记录</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="待确认"
          value={stats.pending}
          color="#F59E0B"
          onClick={() => setStatusFilter(selectedStatusFilter === 'pending' ? null : 'pending')}
          selected={selectedStatusFilter === 'pending'}
        />
        <StatCard
          title="已通过"
          value={stats.approved}
          color="#10B981"
          onClick={() => setStatusFilter(selectedStatusFilter === 'approved' ? null : 'approved')}
          selected={selectedStatusFilter === 'approved'}
        />
        <StatCard
          title="有异常"
          value={stats.exception}
          color="#EF4444"
          onClick={() => setStatusFilter(selectedStatusFilter === 'exception' ? null : 'exception')}
          selected={selectedStatusFilter === 'exception'}
        />
        <StatCard
          title="仅补材料"
          value={stats.material_only}
          color="#6B7280"
          onClick={() => setStatusFilter(selectedStatusFilter === 'material_only' ? null : 'material_only')}
          selected={selectedStatusFilter === 'material_only'}
        />
      </div>

      {selectedStatusFilter && (
        <div className="mb-4 flex items-center gap-2 bg-amber-50 border-2 border-amber-200 rounded-lg px-4 py-2">
          <Filter size={16} className="text-amber-600" />
          <span className="text-sm text-amber-800">
            当前筛选：{selectedStatusFilter === 'pending' ? '待确认' : selectedStatusFilter === 'approved' ? '已通过' : selectedStatusFilter === 'exception' ? '有异常' : '仅补材料'}
          </span>
          <button
            onClick={() => setStatusFilter(null)}
            className="ml-auto text-amber-600 hover:text-amber-800"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {selectedInspectionIds.length > 0 && (
        <div className="mb-4 bg-primary-50 border-2 border-primary-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm text-primary-800">
            已选择 <strong>{selectedInspectionIds.length}</strong> 条记录
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCreateBatch}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded border-2 border-primary-700 hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Layers size={16} />
              创建批量任务
            </button>
            <button
              onClick={handleBatchExport}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-primary-700 rounded border-2 border-primary-300 hover:bg-primary-50 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <FileDown size={16} />
              批量导出
            </button>
            <button
              onClick={clearSelection}
              className="inline-flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium"
            >
              取消选择
            </button>
          </div>
        </div>
      )}

      <DataTable
        inspections={filteredInspections}
        selectedIds={selectedInspectionIds}
        onToggleSelect={toggleInspectionSelection}
        onSelectAll={selectAll}
      />

      <div className="mt-6 bg-slate-50 border-2 border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">展厅项目经理操作指南</h3>
        <ul className="text-xs text-slate-600 space-y-1">
          <li>• <strong>放讲解路线样例：</strong>前往「系统配置」页面，在「讲解路线样例」板块上传标准路线</li>
          <li>• <strong>看坐标轴翻转：</strong>点击记录「查看」按钮，在「翻转对比」面板查看翻转前后数据偏差</li>
          <li>• <strong>导出前复核：</strong>选择记录后点击「批量导出」，在导出页执行一致性校验后再下载</li>
        </ul>
      </div>
    </div>
  );
}
