import { useMemo } from 'react';
import type { ComicPage, Bubble, BubbleVersion, Issue, ReportRow } from '../../types';
import { STATUS_LABELS, ISSUE_TYPE_LABELS } from '../../types';
import { IssueTag } from '../common/IssueTag';
import { StatusBadge } from '../common/StatusBadge';
import { exportToCSV, exportToJSON } from '../../utils/export';
import { getPositionString, formatDateTime, estimateCapacity } from '../../utils/helpers';
import { FileSpreadsheet, FileJson, Download, AlertTriangle, XCircle, ArrowUpDown, CheckCircle2, Clock } from 'lucide-react';

interface ReportPanelProps {
  page: ComicPage;
  bubbles: Bubble[];
  getCurrentVersion: (bubbleId: string) => BubbleVersion | undefined;
  getBubbleIssues: (bubbleId: string) => Issue[];
  onClose: () => void;
  onLocateBubble: (bubbleId: string) => void;
}

export function ReportPanel({
  page,
  bubbles,
  getCurrentVersion,
  getBubbleIssues,
  onClose,
  onLocateBubble,
}: ReportPanelProps) {
  const sortedBubbles = useMemo(
    () => [...bubbles].sort((a, b) => a.sequenceNumber - b.sequenceNumber),
    [bubbles]
  );

  const stats = useMemo(() => {
    const issues = sortedBubbles.flatMap(b => getBubbleIssues(b.id));
    const overlapCount = issues.filter(i => i.type === 'OVERLAP').length;
    const spillCount = issues.filter(i => i.type === 'SPILL').length;
    const sequenceCount = issues.filter(i => i.type === 'SEQUENCE').length;
    const withIssues = sortedBubbles.filter(b => getBubbleIssues(b.id).length > 0).length;
    const conflicts = sortedBubbles.filter(b => b.hasConflict).length;
    const confirmed = sortedBubbles.filter(b => b.status === 'CONFIRMED').length;
    const pending = sortedBubbles.filter(b => b.status === 'PENDING').length;
    const hasIssue = sortedBubbles.filter(b => b.status === 'HAS_ISSUE').length;

    return {
      total: sortedBubbles.length,
      withIssues,
      conflicts,
      confirmed,
      pending,
      hasIssue,
      overlapCount,
      spillCount,
      sequenceCount,
    };
  }, [sortedBubbles, getBubbleIssues]);

  const reportRows = useMemo((): ReportRow[] => {
    return sortedBubbles.map((bubble) => {
      const version = getCurrentVersion(bubble.id);
      const issues = getBubbleIssues(bubble.id);
      return {
        pageNumber: page.pageNumber,
        sequenceNumber: bubble.sequenceNumber,
        bubbleId: bubble.id,
        version: version?.version || 0,
        text: version?.text || '',
        textLength: version?.text.length || 0,
        position: version ? getPositionString(version.x, version.y, version.width, version.height) : '',
        issues: issues.map(i => ISSUE_TYPE_LABELS[i.type]),
        status: STATUS_LABELS[bubble.status],
        remark: version?.remark || '',
        lastModified: version ? formatDateTime(version.createdAt) : '',
      };
    });
  }, [sortedBubbles, getCurrentVersion, getBubbleIssues, page.pageNumber]);

  const handleExportCSV = () => {
    exportToCSV(reportRows, `第${page.pageNumber}页_校对报告.csv`);
  };

  const handleExportJSON = () => {
    exportToJSON(reportRows, `第${page.pageNumber}页_校对报告.json`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-800">校对报告 · 第 {page.pageNumber} 页</h2>
            <p className="text-sm text-stone-500">{page.title}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
            >
              <FileSpreadsheet size={16} />
              导出 CSV
            </button>
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-2 rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
            >
              <FileJson size={16} />
              导出 JSON
            </button>
            <button
              onClick={onClose}
              className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
            >
              关闭
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <CheckCircle2 size={16} className="text-emerald-500" />
                总计气泡
              </div>
              <div className="mt-1 text-2xl font-bold text-stone-800">{stats.total}</div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 text-sm text-red-600">
                <XCircle size={16} />
                气泡重叠
              </div>
              <div className="mt-1 text-2xl font-bold text-red-700">{stats.overlapCount}</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertTriangle size={16} />
                台词溢出
              </div>
              <div className="mt-1 text-2xl font-bold text-amber-700">{stats.spillCount}</div>
            </div>
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-center gap-2 text-sm text-orange-600">
                <ArrowUpDown size={16} />
                顺序错误
              </div>
              <div className="mt-1 text-2xl font-bold text-orange-700">{stats.sequenceCount}</div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-500">存在问题</span>
                <span className="text-lg font-bold text-red-600">{stats.withIssues}</span>
              </div>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-500">版本冲突</span>
                <span className="text-lg font-bold text-red-600">{stats.conflicts}</span>
              </div>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-500">已确认</span>
                <span className="text-lg font-bold text-emerald-600">{stats.confirmed}</span>
              </div>
            </div>
          </div>

          <h3 className="mb-3 text-sm font-semibold text-stone-700">问题明细</h3>
          <div className="overflow-hidden rounded-lg border border-stone-200">
            <table className="w-full text-sm">
              <thead className="bg-stone-100">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-stone-500">序号</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-stone-500">台词</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-stone-500">字数</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-stone-500">位置</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-stone-500">问题</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-stone-500">状态</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-stone-500">版本</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-stone-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 bg-white">
                {reportRows.map((row, idx) => {
                  const bubble = sortedBubbles[idx];
                  const issues = getBubbleIssues(bubble.id);
                  const version = getCurrentVersion(bubble.id);
                  const capacity = version ? estimateCapacity(version.width, version.height) : 0;
                  return (
                    <tr
                      key={row.bubbleId}
                      className={`hover:bg-stone-50 ${issues.length > 0 ? 'bg-red-50/30' : ''}`}
                    >
                      <td className="px-3 py-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-stone-800 text-xs font-bold text-white">
                          {row.sequenceNumber}
                        </span>
                      </td>
                      <td className="px-3 py-2 max-w-[200px] truncate" title={row.text}>
                        {row.text || '(空)'}
                      </td>
                      <td className="px-3 py-2">
                        <span className={row.textLength > capacity ? 'text-red-600 font-medium' : 'text-stone-600'}>
                          {row.textLength}/{capacity}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-stone-500">{row.position}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {issues.length > 0 ? (
                            issues.map((issue) => (
                              <IssueTag key={issue.id} type={issue.type} />
                            ))
                          ) : (
                            <span className="text-xs text-emerald-600">无</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={bubble.status} size="sm" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-stone-600">v{row.version}</span>
                          {bubble.hasConflict && (
                            <span className="text-xs text-red-600">⚠</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => onLocateBubble(bubble.id)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          定位
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-4">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-stone-700">
              <Clock size={14} />
              导出信息
            </h4>
            <div className="text-xs text-stone-500 space-y-1">
              <p>报告生成时间: {formatDateTime(new Date().toISOString())}</p>
              <p>检测引擎版本: engine-v1.0</p>
              <p>检测规则: 重叠阈值 10%，台词容量按 16px 字号估算</p>
              <p>备注: 所有坐标基于原图尺寸 ({page.width} × {page.height})</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
