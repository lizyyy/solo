import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Check,
  Clock,
  AlertTriangle,
  Edit3,
  Plus,
  Eye,
  Download,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { StatusBadge } from '../components/ui/StatusBadge';
import { SourceTag } from '../components/ui/SourceTag';
import { FriendlyErrorList } from '../components/ui/FriendlyErrorMessage';
import { RecordStatus, DataSource, BeatRecord } from '../types';
import { useToast } from '../components/ui/Toast';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function RecordList() {
  const {
    records,
    students,
    sections,
    filters,
    setFilters,
    getFilteredRecords,
    selectedRecordIds,
    toggleSelectRecord,
    selectAllRecords,
    clearSelection,
    updateRecordStatus,
    batchUpdateStatus,
    mismatchRecords,
  } = useStore();

  const { success, warning, error: toastError } = useToast();
  const [sortField, setSortField] = useState<string>('rehearsalDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(true);

  const filteredRecords = useMemo(() => {
    let result = getFilteredRecords();
    
    result = [...result].sort((a, b) => {
      let aVal: any = a[sortField as keyof BeatRecord];
      let bVal: any = b[sortField as keyof BeatRecord];
      
      if (sortField === 'rehearsalDate') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    return result;
  }, [getFilteredRecords, sortField, sortOrder]);

  const duplicateWarnings = useMemo(() => {
    const warnings: any[] = [];
    filteredRecords.forEach((r) => {
      if (r.isDuplicate) {
        warnings.push({
          id: `dup-${r.id}`,
          level: 'warning' as const,
          message: `⚠️ ${r.studentName} 的这条记录和另一条记录有重叠`,
          suggestion: '点击"查看详情"确认是否需要合并，或在备注中说明差异',
          relatedRecordId: r.duplicateOfId,
        });
      }
    });
    return warnings;
  }, [filteredRecords]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedRecordIds.length === filteredRecords.length) {
      clearSelection();
    } else {
      selectAllRecords(filteredRecords.map((r) => r.id));
    }
  };

  const handleBatchConfirm = () => {
    if (selectedRecordIds.length === 0) {
      warning('请先选择要操作的记录');
      return;
    }
    batchUpdateStatus(selectedRecordIds, RecordStatus.CONFIRMED);
    success(`已确认 ${selectedRecordIds.length} 条记录`);
    clearSelection();
  };

  const handleBatchToFill = () => {
    if (selectedRecordIds.length === 0) {
      warning('请先选择要操作的记录');
      return;
    }
    batchUpdateStatus(selectedRecordIds, RecordStatus.TO_FILL);
    success(`已将 ${selectedRecordIds.length} 条记录标记为待补`);
    clearSelection();
  };

  const getRecordMismatches = (recordId: string) => {
    return mismatchRecords.filter((m) => m.recordId === recordId && m.status === 'pending');
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ChevronDown className="w-4 h-4 opacity-30" />;
    return sortOrder === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-primary-600" />
      : <ChevronDown className="w-4 h-4 text-primary-600" />;
  };

  const uniqueDates = [...new Set(records.map((r) => r.rehearsalDate))].sort();

  const stats = useMemo(() => {
    return {
      total: records.length,
      confirmed: records.filter((r) => r.status === RecordStatus.CONFIRMED).length,
      toFill: records.filter((r) => r.status === RecordStatus.TO_FILL).length,
      manual: records.filter((r) => r.status === RecordStatus.MANUAL_EDITED).length,
    };
  }, [records]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">节拍记录</h2>
          <p className="text-sm text-gray-500 mt-1">管理所有排练的节拍记录，支持多维度筛选和批量操作</p>
        </div>
        <Link to="/records/new" className="btn btn-primary">
          <Plus className="w-4 h-4" />
          新增记录
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
              <span className="text-primary-700 font-bold">{stats.total}</span>
            </div>
            <div>
              <p className="text-xs text-gray-500">总记录数</p>
              <p className="font-medium text-gray-900">条</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success-100 flex items-center justify-center">
              <Check className="w-5 h-5 text-success-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">已确认</p>
              <p className="font-medium text-success-700">{stats.confirmed} 条</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">待补</p>
              <p className="font-medium text-warning-700">{stats.toFill} 条</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-accent-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">人工修改</p>
              <p className="font-medium text-accent-700">{stats.manual} 条</p>
            </div>
          </div>
        </div>
      </div>

      {duplicateWarnings.length > 0 && (
        <FriendlyErrorList errors={duplicateWarnings} />
      )}

      <div className="card">
        <div className="p-4 border-b border-gray-100">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors"
          >
            <Filter className="w-4 h-4" />
            筛选条件
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">搜索</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="搜索学生、声部..."
                    className="input-field pl-9"
                    value={filters.search || ''}
                    onChange={(e) => setFilters({ search: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">声部</label>
                <select
                  className="input-field"
                  value={filters.sectionId || ''}
                  onChange={(e) => setFilters({ sectionId: e.target.value || undefined })}
                >
                  <option value="">全部声部</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                <select
                  className="input-field"
                  value={filters.status || ''}
                  onChange={(e) => setFilters({ status: (e.target.value as RecordStatus) || undefined })}
                >
                  <option value="">全部状态</option>
                  <option value={RecordStatus.CONFIRMED}>已确认</option>
                  <option value={RecordStatus.PENDING}>待确认</option>
                  <option value={RecordStatus.TO_FILL}>待补</option>
                  <option value={RecordStatus.MANUAL_EDITED}>人工修改</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                <select
                  className="input-field"
                  value={filters.date || ''}
                  onChange={(e) => setFilters({ date: e.target.value || undefined })}
                >
                  <option value="">全部日期</option>
                  {uniqueDates.map((d) => (
                    <option key={d} value={d}>
                      {format(new Date(d), 'yyyy年MM月dd日 EEEE', { locale: zhCN })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">学生</label>
                <select
                  className="input-field"
                  value={filters.studentId || ''}
                  onChange={(e) => setFilters({ studentId: e.target.value || undefined })}
                >
                  <option value="">全部学生</option>
                  {students
                    .filter((s) => !filters.sectionId || s.sectionId === filters.sectionId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.name} - {s.instrument}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">来源</label>
                <select
                  className="input-field"
                  value={filters.source || ''}
                  onChange={(e) => setFilters({ source: (e.target.value as DataSource) || undefined })}
                >
                  <option value="">全部来源</option>
                  <option value={DataSource.METRONOME}>节拍器</option>
                  <option value={DataSource.MUSIC_SHEET}>选曲表</option>
                  <option value={DataSource.MANUAL}>手工录入</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {selectedRecordIds.length > 0 && (
          <div className="px-4 py-3 bg-primary-50 border-b border-primary-100 flex items-center justify-between">
            <span className="text-sm text-primary-700">
              已选择 <strong>{selectedRecordIds.length}</strong> 条记录
            </span>
            <div className="flex items-center gap-2">
              <button onClick={handleBatchConfirm} className="btn btn-success text-sm py-1.5 px-3">
                <Check className="w-4 h-4" />
                批量确认
              </button>
              <button onClick={handleBatchToFill} className="btn btn-warning text-sm py-1.5 px-3">
                <AlertTriangle className="w-4 h-4" />
                标记待补
              </button>
              <button onClick={clearSelection} className="btn btn-ghost text-sm py-1.5 px-3">
                取消选择
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedRecordIds.length === filteredRecords.length && filteredRecords.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('studentName')}
                >
                  <div className="flex items-center gap-1">
                    学生
                    <SortIcon field="studentName" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('sectionName')}
                >
                  <div className="flex items-center gap-1">
                    声部
                    <SortIcon field="sectionName" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('measureStart')}
                >
                  <div className="flex items-center gap-1">
                    小节范围
                    <SortIcon field="measureStart" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  速度
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  来源
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    状态
                    <SortIcon field="status" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('rehearsalDate')}
                >
                  <div className="flex items-center gap-1">
                    日期
                    <SortIcon field="rehearsalDate" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords.map((record, index) => {
                const mismatches = getRecordMismatches(record.id);
                return (
                  <tr
                    key={record.id}
                    className={`table-row-hover ${record.isDuplicate ? 'bg-warning-50/50' : ''} ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedRecordIds.includes(record.id)}
                        onChange={() => toggleSelectRecord(record.id)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{record.studentName}</span>
                        {record.isDuplicate && (
                          <AlertCircle className="w-4 h-4 text-warning-500 animate-pulse-soft" />
                        )}
                        {mismatches.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                            <AlertTriangle className="w-3 h-3" />
                            错位
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{record.sectionName}</td>
                    <td className="px-4 py-3">
                      <span className={`font-mono text-sm ${record.measureStart > record.measureEnd ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                        {record.measureStart} - {record.measureEnd}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-mono text-sm ${record.tempo < 40 || record.tempo > 200 ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                        ♩ = {record.tempo}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <SourceTag source={record.source} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {format(new Date(record.rehearsalDate), 'MM/dd')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          to={`/records/${record.id}`}
                          className="p-1.5 rounded-md text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredRecords.length === 0 && (
          <div className="py-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">没有找到符合条件的记录</p>
            <button
              onClick={() => {
                setFilters({});
                clearSelection();
              }}
              className="mt-3 text-sm text-primary-600 hover:text-primary-700"
            >
              清除筛选条件
            </button>
          </div>
        )}

        {filteredRecords.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              共 <strong>{filteredRecords.length}</strong> 条记录
            </p>
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost text-sm py-1.5 px-3">
                <Download className="w-4 h-4" />
                导出
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
