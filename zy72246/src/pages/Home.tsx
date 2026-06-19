import { useState, useCallback, Fragment } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Filter,
  History,
  ChevronDown,
  ChevronUp,
  Eye,
  AlertTriangle,
  Download,
} from 'lucide-react';
import { ProcessingStatus, ProcessStep, TaxNote } from '@/types';
import { useAppStore, useFilteredTaxNotes } from '@/store';
import { StatusBadge } from '@/components/StatusBadge';
import { ProcessStepIndicator } from '@/components/ProcessStepIndicator';
import { TaxNoteDetailModal } from '@/components/TaxNoteDetailModal';
import { Layout } from '@/components/Layout';
import { getStatusDisplayName, getStepDisplayName } from '@/utils/stateMachine';

export default function Home() {
  const filteredNotes = useFilteredTaxNotes();
  const { filter, dispatch, currentUser } = useAppStore();
  const [selectedNote, setSelectedNote] = useState<TaxNote | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const stats = {
    total: filteredNotes.length,
    pending: filteredNotes.filter(n => n.processingStatus === ProcessingStatus.PENDING).length,
    reversal: filteredNotes.filter(n => n.processingStatus === ProcessingStatus.REVERSAL_PENDING_REVIEW).length,
    completed: filteredNotes.filter(n => n.processingStatus === ProcessingStatus.COMPLETED).length,
  };

  const handleExport = useCallback(() => {
    const headers = ['记录ID', '原始行号', '交易日期', '证券代码', '证券名称', '流水号', '原始金额', '当前金额', '原始备注', '当前备注', '柜台流水尾号', '摘要', '处理状态', '流程阶段', '版本', '创建人', '创建时间', '更新人', '更新时间'];
    const rows = filteredNotes.map(n => [
      n.id, n.originalLineNumber, n.tradeDate, n.stockCode, n.stockName, n.serialNumber,
      n.originalAmount.toFixed(2), n.currentAmount.toFixed(2),
      `"${n.originalRemark.replace(/"/g, '""')}"`,
      `"${n.currentRemark.replace(/"/g, '""')}"`,
      n.counterTailNumber || '',
      `"${n.summary.replace(/"/g, '""')}"`,
      getStatusDisplayName(n.processingStatus),
      getStepDisplayName(n.currentStep),
      n.version, n.createdBy, n.createdAt, n.updatedBy, n.updatedAt,
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `税费率备注复盘_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredNotes]);

  return (
    <Layout>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800" style={{ fontFamily: "'Noto Serif SC', serif" }}>
            税费率备注复盘
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            共 {stats.total} 条记录，当前用户: {currentUser}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors flex items-center space-x-2 text-sm"
          >
            <Download className="w-4 h-4" />
            <span>导出CSV</span>
          </button>
          <Link
            to="/import"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <span>导入新数据</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500">总记录数</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500">待处理</p>
          <p className="text-3xl font-bold text-gray-600 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-orange-200 shadow-sm bg-orange-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-orange-700">待风控复核</p>
            {stats.reversal > 0 && <AlertTriangle className="w-4 h-4 text-orange-500" />}
          </div>
          <p className="text-3xl font-bold text-orange-600 mt-1">{stats.reversal}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500">已完成</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{stats.completed}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="搜索代码、名称、备注、流水号..."
                value={filter.keyword || ''}
                onChange={(e) => dispatch({ type: 'SET_FILTER', payload: { keyword: e.target.value } })}
                className="pl-10 pr-4 py-2 w-80 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center space-x-2 px-3 py-2 border rounded-lg transition-colors ${
                showFilters ? 'bg-blue-50 border-blue-300 text-blue-600' : 'border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span className="text-sm">筛选</span>
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <label className="text-sm text-slate-600">处理状态:</label>
              <select
                value={filter.status || ''}
                onChange={(e) => dispatch({
                  type: 'SET_FILTER',
                  payload: { status: e.target.value as ProcessingStatus || undefined }
                })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">全部</option>
                {Object.values(ProcessingStatus).map(status => (
                  <option key={status} value={status}>
                    {getStatusDisplayName(status)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm text-slate-600">流程阶段:</label>
              <select
                value={filter.step || ''}
                onChange={(e) => dispatch({
                  type: 'SET_FILTER',
                  payload: { step: e.target.value as ProcessStep || undefined }
                })}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">全部</option>
                {Object.values(ProcessStep).map(step => (
                  <option key={step} value={step}>
                    {getStepDisplayName(step)}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => dispatch({ type: 'SET_FILTER', payload: { status: undefined, step: undefined, keyword: '' } })}
              className="px-3 py-2 text-sm text-blue-600 hover:text-blue-700"
            >
              清除筛选
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-10"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">原始行号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">交易日期</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">证券代码</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">证券名称</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">税费金额</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">当前备注</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">柜台流水尾号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">流程</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">版本</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredNotes.map((note) => {
                const isExpanded = expandedRows.has(note.id);
                const isReversal = note.processingStatus === ProcessingStatus.REVERSAL_PENDING_REVIEW;

                return (
                  <Fragment key={note.id}>
                    <tr
                      className={`hover:bg-slate-50 transition-colors ${
                        isReversal ? 'bg-orange-50/50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleExpand(note.id)}
                          className="p-1 hover:bg-slate-200 rounded"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-800">
                        <span className="bg-slate-100 px-2 py-1 rounded">{note.originalLineNumber}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-800">{note.tradeDate}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-800">{note.stockCode}</td>
                      <td className="px-4 py-3 text-sm text-slate-800">{note.stockName}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-800">
                        HK$ {note.currentAmount.toFixed(2)}
                        {note.originalAmount !== note.currentAmount && (
                          <span className="text-xs text-amber-600 ml-1">
                            (原: {note.originalAmount.toFixed(2)})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-800 max-w-xs truncate" title={note.currentRemark}>
                        {note.currentRemark}
                        {note.currentRemark !== note.originalRemark && (
                          <span className="inline-block w-2 h-2 ml-1 bg-blue-500 rounded-full" title="已修改" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-800">
                        {note.counterTailNumber || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={note.processingStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <ProcessStepIndicator currentStep={note.currentStep} />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        <span className="font-mono">v{note.version}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setSelectedNote(note)}
                            className="p-1.5 hover:bg-blue-100 text-blue-600 rounded transition-colors"
                            title="查看详情"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <Link
                            to={`/history/${note.id}`}
                            className="p-1.5 hover:bg-purple-100 text-purple-600 rounded transition-colors"
                            title="历史变更"
                          >
                            <History className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${note.id}-detail`} className="bg-slate-50">
                        <td colSpan={12} className="px-6 py-4">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-slate-500 mb-1 font-medium">原始备注</p>
                              <p className="text-slate-700 bg-white p-2 rounded border border-slate-200 text-xs font-mono">
                                {note.originalRemark}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-blue-600 mb-1 font-medium">当前备注</p>
                              <p className="text-slate-700 bg-white p-2 rounded border border-blue-200 text-xs font-mono">
                                {note.currentRemark}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 mb-1 font-medium">摘要</p>
                              <p className="text-slate-700 bg-white p-2 rounded border border-slate-200 text-xs">
                                {note.summary || '（未填写）'}
                              </p>
                            </div>
                          </div>
                          {note.counterTailNumber && (
                            <div className="mt-2 text-xs text-slate-500">
                              柜台流水尾号: <span className="font-mono text-slate-700">{note.counterTailNumber}</span>
                            </div>
                          )}
                          <div className="mt-2 text-xs text-slate-400">
                            创建: {note.createdBy} · {formatDate(note.createdAt)} | 更新: {note.updatedBy} · {formatDate(note.updatedAt)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}

              {filteredNotes.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-slate-500">
                    暂无符合条件的记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedNote && (
        <TaxNoteDetailModal
          taxNote={selectedNote}
          onClose={() => setSelectedNote(null)}
        />
      )}
      </div>
    </Layout>
  );
}
