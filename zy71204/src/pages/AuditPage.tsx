import { useState, useMemo } from 'react';
import { FileSpreadsheet, FileText, Search, Calendar, ClipboardList } from 'lucide-react';
import useBillStore from '@/store/useBillStore';
import { 
  exportToExcel, 
  exportToCSV, 
  downloadFile, 
  generateExportFileName,
  ExportOptions 
} from '@/services/auditExport';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function AuditPage() {
  const bills = useBillStore(state => state.bills);
  const auditLogs = useBillStore(state => state.auditLogs);
  
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeDirtyData: false,
    includeExceptions: true,
    includeStatusHistory: true,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const filteredLogs = useMemo(() => {
    return auditLogs
      .filter(log => {
        if (actionFilter !== 'all' && log.action !== actionFilter) return false;
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          return (
            log.action.toLowerCase().includes(term) ||
            (log.billNo && log.billNo.toLowerCase().includes(term)) ||
            log.details.toLowerCase().includes(term)
          );
        }
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [auditLogs, searchTerm, actionFilter]);

  const handleExportExcel = () => {
    const blob = exportToExcel(bills, auditLogs, exportOptions);
    downloadFile(blob, generateExportFileName('票据池数据', 'xlsx'));
  };

  const handleExportCSV = () => {
    const blob = exportToCSV(bills, exportOptions);
    downloadFile(blob, generateExportFileName('票据池数据', 'csv'));
  };

  const actionTypes = useMemo(() => {
    const types = new Set(auditLogs.map(l => l.action));
    return Array.from(types);
  }, [auditLogs]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return {
      totalLogs: auditLogs.length,
      todayLogs: auditLogs.filter(l => new Date(l.timestamp) >= today).length,
      importCount: auditLogs.filter(l => l.action.includes('导入')).length,
      updateCount: auditLogs.filter(l => l.action.includes('更新') || l.action.includes('状态变更')).length,
    };
  }, [auditLogs]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">审计记录总数</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{stats.totalLogs}</p>
              </div>
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                <ClipboardList className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">今日操作</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.todayLogs}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">数据导入</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{stats.importCount}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">数据更新</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{stats.updateCount}</p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-800">数据导出</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-slate-700 mb-3">导出选项</h4>
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeDirtyData}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeDirtyData: e.target.checked }))}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-sm text-slate-700">包含脏数据</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeExceptions}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeExceptions: e.target.checked }))}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-sm text-slate-700">包含异常记录 (仅Excel)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeStatusHistory}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeStatusHistory: e.target.checked }))}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-sm text-slate-700">包含状态历史 (仅Excel)</span>
                </label>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-slate-700 mb-3">导出格式</h4>
              <div className="flex gap-3">
                <button
                  onClick={handleExportExcel}
                  className="flex-1 btn btn-primary"
                >
                  <FileSpreadsheet className="w-5 h-5 mr-2" />
                  导出 Excel
                </button>
                <button
                  onClick={handleExportCSV}
                  className="flex-1 btn btn-secondary"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  导出 CSV
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Excel 格式包含完整的多工作表数据，CSV 仅包含票据列表。
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">操作审计日志</h3>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索操作..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10 w-64"
                />
              </div>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="input w-40"
              >
                <option value="all">全部操作</option>
                {actionTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作</th>
                <th>操作人</th>
                <th>关联票据</th>
                <th>详细信息</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap text-slate-500">
                    {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                  </td>
                  <td>
                    <span className="badge bg-primary-100 text-primary-700">
                      {log.action}
                    </span>
                  </td>
                  <td>{log.operator}</td>
                  <td>
                    {log.billNo ? (
                      <span className="font-mono text-slate-700">{log.billNo}</span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="max-w-md truncate text-slate-600" title={log.details}>
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredLogs.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Search className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>暂无审计记录</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
