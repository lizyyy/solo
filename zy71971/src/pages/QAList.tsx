import { useState, useMemo, Fragment } from 'react';
import { useStore } from '@/store';
import { STATUS_LABELS, REVIEW_TYPE_LABELS } from '@/types';
import type { QAStatus, ReviewType } from '@/types';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import JudgmentDetail from '@/components/JudgmentDetail';
import { exportToCSV, exportToExcel, formatDateTime } from '@/utils/fileUtils';
import { Search, Filter, Download, ChevronDown, ChevronRight, FileDown } from 'lucide-react';

const statusOptions: { value: QAStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'normal', label: STATUS_LABELS.normal },
  { value: 'pending', label: STATUS_LABELS.pending },
  { value: 'confirmed', label: STATUS_LABELS.confirmed },
  { value: 'rejected', label: STATUS_LABELS.rejected },
  { value: 'known_issue', label: STATUS_LABELS.known_issue },
];

const issueTypeOptions: { value: 'all' | ReviewType; label: string }[] = [
  { value: 'all', label: '全部问题类型' },
  { value: 'gray_conflict', label: REVIEW_TYPE_LABELS.gray_conflict },
  { value: 'source_broken', label: REVIEW_TYPE_LABELS.source_broken },
  { value: 'sensitive_leak', label: REVIEW_TYPE_LABELS.sensitive_leak },
];

export default function QAList() {
  const qaRecords = useStore((s) => s.qaRecords);
  const clauses = useStore((s) => s.clauses);
  const filter = useStore((s) => s.filter);
  const setFilter = useStore((s) => s.setFilter);

  const filteredRecords = useMemo(() => {
    return qaRecords.filter((r) => {
      if (filter.status !== 'all' && r.status !== filter.status) return false;
      if (filter.search) {
        const s = filter.search.toLowerCase();
        if (!r.question.toLowerCase().includes(s) && !r.answer.toLowerCase().includes(s) && !r.judgmentReason.toLowerCase().includes(s)) return false;
      }
      if (filter.dateFrom && r.createdAt < filter.dateFrom) return false;
      if (filter.dateTo && r.createdAt > filter.dateTo + 'T23:59:59') return false;
      if (filter.issueType !== 'all') {
        if (filter.issueType === 'gray_conflict' && !r.isGrayConflict) return false;
        if (filter.issueType === 'source_broken' && !r.isSourceBroken) return false;
        if (filter.issueType === 'sensitive_leak' && !r.isSensitiveLeak) return false;
      }
      return true;
    });
  }, [qaRecords, filter]);

  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const clauseMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clauses) {
      map.set(c.id, c.clauseNumber);
    }
    return map;
  }, [clauses]);

  const allSelected = filteredRecords.length > 0 && filteredRecords.every((r) => selectedIds.has(r.id));

  function toggleRow(id: string) {
    setExpandedRowId((prev) => (prev === id ? null : id));
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecords.map((r) => r.id)));
    }
  }

  function handleExportCSV() {
    const records = selectedIds.size > 0
      ? filteredRecords.filter((r) => selectedIds.has(r.id))
      : filteredRecords;
    const data = records.map((r) => ({
      条款编号: clauseMap.get(r.clauseId) ?? r.clauseId,
      问题: r.question,
      答案: r.answer,
      状态: STATUS_LABELS[r.status],
      判断理由: r.judgmentReason,
      创建时间: formatDateTime(r.createdAt),
    }));
    exportToCSV(data, '合同条款问答列表');
  }

  function handleExportExcel() {
    const records = selectedIds.size > 0
      ? filteredRecords.filter((r) => selectedIds.has(r.id))
      : filteredRecords;
    const data = records.map((r) => ({
      条款编号: clauseMap.get(r.clauseId) ?? r.clauseId,
      问题: r.question,
      答案: r.answer,
      状态: STATUS_LABELS[r.status],
      判断理由: r.judgmentReason,
      创建时间: formatDateTime(r.createdAt),
    }));
    exportToExcel(data, '合同条款问答列表');
  }

  const selectLabel = selectedIds.size > 0 ? `批量导出 (${selectedIds.size})` : '批量导出';

  return (
    <div className="space-y-4">
      <PageHeader
        title="问答记录管理"
        subtitle={`共 ${filteredRecords.length} 条记录`}
      />

      <div className="sticky top-0 z-10 bg-[#0f1724] pb-3">
        <div className="flex flex-wrap items-center gap-3 p-4 bg-[#1a2332] rounded-xl border border-[#2a3548]">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filter.status}
              onChange={(e) => setFilter({ status: e.target.value as QAStatus | 'all' })}
              className="bg-[#151d2b] text-gray-300 text-sm rounded-lg border border-[#2a3548] px-3 py-1.5 focus:outline-none focus:border-blue-500"
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <select
            value={filter.issueType}
            onChange={(e) => setFilter({ issueType: e.target.value as 'all' | ReviewType })}
            className="bg-[#151d2b] text-gray-300 text-sm rounded-lg border border-[#2a3548] px-3 py-1.5 focus:outline-none focus:border-blue-500"
          >
            {issueTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="搜索问题/答案/关键词..."
              value={filter.search}
              onChange={(e) => setFilter({ search: e.target.value })}
              className="w-full bg-[#151d2b] text-gray-300 text-sm rounded-lg border border-[#2a3548] pl-9 pr-3 py-1.5 focus:outline-none focus:border-blue-500 placeholder:text-gray-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filter.dateFrom}
              onChange={(e) => setFilter({ dateFrom: e.target.value })}
              className="bg-[#151d2b] text-gray-300 text-sm rounded-lg border border-[#2a3548] px-3 py-1.5 focus:outline-none focus:border-blue-500"
            />
            <span className="text-gray-500 text-sm">至</span>
            <input
              type="date"
              value={filter.dateTo}
              onChange={(e) => setFilter({ dateTo: e.target.value })}
              className="bg-[#151d2b] text-gray-300 text-sm rounded-lg border border-[#2a3548] px-3 py-1.5 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 bg-[#151d2b] text-gray-300 text-sm px-3 py-1.5 rounded-lg border border-[#2a3548] hover:border-blue-500 hover:text-blue-400 transition-colors"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 bg-[#151d2b] text-gray-300 text-sm px-3 py-1.5 rounded-lg border border-[#2a3548] hover:border-blue-500 hover:text-blue-400 transition-colors"
            >
              <FileDown className="w-4 h-4" />
              Excel
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#2a3548] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1a2332]">
              <th className="w-10 px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-[#2a3548] bg-[#151d2b] accent-blue-500"
                />
              </th>
              <th className="w-8 px-1 py-3" />
              <th className="px-3 py-3 text-left text-gray-400 font-medium">条款编号</th>
              <th className="px-3 py-3 text-left text-gray-400 font-medium">问题</th>
              <th className="px-3 py-3 text-left text-gray-400 font-medium">状态</th>
              <th className="px-3 py-3 text-left text-gray-400 font-medium">判断理由摘要</th>
              <th className="px-3 py-3 text-left text-gray-400 font-medium">创建时间</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record, idx) => {
              const isExpanded = expandedRowId === record.id;
              const isSelected = selectedIds.has(record.id);
              const rowBg = idx % 2 === 0 ? 'bg-[#1a2332]' : 'bg-[#151d2b]';
              return (
                <Fragment key={record.id}>
                  <tr className={`${rowBg} hover:bg-[#1e2a3a] transition-colors`}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(record.id)}
                        className="rounded border-[#2a3548] bg-[#151d2b] accent-blue-500"
                      />
                    </td>
                    <td className="px-1 py-3">
                      <button
                        onClick={() => toggleRow(record.id)}
                        className="text-gray-400 hover:text-gray-200 transition-colors"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-gray-300 font-mono text-xs">
                      {clauseMap.get(record.clauseId) ?? record.clauseId}
                    </td>
                    <td className="px-3 py-3 text-gray-200 max-w-[300px] truncate">
                      {record.question}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="px-3 py-3 text-gray-400 max-w-[240px] truncate" title={record.judgmentReason}>
                      {record.judgmentReason.length > 50
                        ? record.judgmentReason.slice(0, 50) + '...'
                        : record.judgmentReason}
                    </td>
                    <td className="px-3 py-3 text-gray-400 whitespace-nowrap">
                      {formatDateTime(record.createdAt)}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-[#151d2b]">
                      <td colSpan={7} className="px-6 py-3">
                        <JudgmentDetail record={record} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filteredRecords.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-500">
                  暂无匹配的问答记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#1a2332] border border-[#2a3548] rounded-xl px-5 py-3 shadow-lg shadow-black/30">
          <span className="text-sm text-gray-400">已选 {selectedIds.size} 条</span>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            {selectLabel} (CSV)
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
          >
            <FileDown className="w-4 h-4" />
            {selectLabel} (Excel)
          </button>
        </div>
      )}
    </div>
  );
}
