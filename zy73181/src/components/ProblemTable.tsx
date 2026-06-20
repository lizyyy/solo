import { useRef, useEffect } from 'react';
import { Eye, AlertCircle, FileText, Hash } from 'lucide-react';
import type { Problem, ReviewResult } from '@/types';
import { difficultyLabel, constraintTypeLabel, reviewStatusLabel, reviewResultStatusLabel, unitCheckResultLabel } from '@/services/filterService';

interface ProblemTableProps {
  problems: Problem[];
  reviewResults: ReviewResult[];
  highlightedRowId: string | null;
  onSelectProblem: (id: string) => void;
  onHighlightRow: (id: string | null) => void;
}

export default function ProblemTable({
  problems,
  reviewResults,
  highlightedRowId,
  onSelectProblem,
  onHighlightRow,
}: ProblemTableProps) {
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  useEffect(() => {
    if (highlightedRowId && rowRefs.current[highlightedRowId]) {
      rowRefs.current[highlightedRowId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      const timer = setTimeout(() => onHighlightRow(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [highlightedRowId, onHighlightRow]);

  const getRowClass = (p: Problem): string => {
    let cls = 'transition-colors duration-200';
    if (p.reviewStatus === 'abnormal') cls += ' table-row-abnormal';
    else if (p.hasUnitIssue) cls += ' table-row-unit';
    else if (p.isRemarkSupplementary) cls += ' table-row-supplementary';
    if (highlightedRowId === p.id) cls += ' animate-highlight';
    return cls;
  };

  const getStatusTag = (p: Problem, r?: ReviewResult) => {
    const status = r ? r.status : p.reviewStatus;
    switch (status) {
      case 'normal':
        return <span className="tag-normal">{reviewResultStatusLabel(status)}</span>;
      case 'abnormal':
        return <span className="tag-abnormal">{reviewResultStatusLabel(status)}</span>;
      case 'unit_issue':
        return <span className="tag-unit">{reviewResultStatusLabel(status)}</span>;
      case 'skipped':
      case 'pending':
      default:
        return <span className="tag-pending">{reviewStatusLabel(p.reviewStatus)}</span>;
    }
  };

  const getDifficultyTag = (d: string) => {
    const map: Record<string, string> = {
      easy: 'tag-easy',
      medium: 'tag-medium',
      hard: 'tag-hard',
      expert: 'tag-expert',
    };
    return <span className={map[d] || 'tag-pending'}>{difficultyLabel(d)}</span>;
  };

  return (
    <div className="card-academic overflow-hidden animate-fade-in stagger-3">
      <div className="px-5 py-4 border-b border-academic-100 flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-academic-800 flex items-center gap-2">
            <Hash className="w-4 h-4 text-academic-500" />
            题目清单
          </h3>
          <p className="text-xs text-academic-500 mt-0.5">
            共 {problems.length} 条题目 · 异常行标红 · 单位问题标紫 · 后补备注标黄
          </p>
        </div>
        <div className="flex items-center gap-2">
          {problems.some((p) => p.hasUnitIssue) && (
            <span className="text-[11px] text-status-unit flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {problems.filter((p) => p.hasUnitIssue).length} 条单位缺失
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto max-h-[520px] scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="bg-academic-50 sticky top-0 z-10">
            <tr className="text-left text-xs text-academic-600 font-semibold">
              <th className="px-4 py-3 w-16">行号</th>
              <th className="px-4 py-3 w-20">编号</th>
              <th className="px-4 py-3">题干摘要</th>
              <th className="px-4 py-3 w-28">约束类型</th>
              <th className="px-4 py-3 w-20">难度</th>
              <th className="px-4 py-3 w-24 text-right">边界值</th>
              <th className="px-4 py-3 w-24">单位</th>
              <th className="px-4 py-3 w-24">复核状态</th>
              <th className="px-4 py-3 w-20">单位校验</th>
              <th className="px-4 py-3 w-24 text-right">偏差</th>
              <th className="px-4 py-3 w-32">备注</th>
              <th className="px-4 py-3 w-20 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {problems.map((p, idx) => {
              const result = reviewResults.find((r) => r.problemId === p.id);
              return (
                <tr
                  key={p.id}
                  ref={(el) => { rowRefs.current[p.id] = el; }}
                  className={getRowClass(p)}
                  style={{ animationDelay: `${idx * 20}ms` }}
                >
                  <td className="px-4 py-3 font-mono text-xs text-academic-400">
                    {p.originalRow}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-academic-700">
                    {p.id}
                  </td>
                  <td className="px-4 py-3 text-academic-800 max-w-xs truncate">
                    {p.title}
                  </td>
                  <td className="px-4 py-3 text-xs text-academic-600">
                    {constraintTypeLabel(p.constraintType)}
                  </td>
                  <td className="px-4 py-3">{getDifficultyTag(p.difficulty)}</td>
                  <td className="px-4 py-3 text-right font-mono text-academic-800 tabular-nums">
                    {p.boundaryValue ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {p.boundaryUnit ? (
                      <span className="font-mono text-xs text-academic-700 bg-academic-50 px-2 py-0.5 rounded">
                        {p.boundaryUnit}
                      </span>
                    ) : (
                      <span className="text-xs text-status-unit font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        缺失
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{getStatusTag(p, result)}</td>
                  <td className="px-4 py-3">
                    {result ? (
                      result.unitCheckResult === 'pass' ? (
                        <span className="text-xs text-status-normal font-medium">✓ 通过</span>
                      ) : (
                        <span className="text-xs text-status-unit font-semibold">
                          {unitCheckResultLabel(result.unitCheckResult)}
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-academic-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                    {result ? (
                      result.status === 'unit_issue' ? (
                        <span className="text-status-unit">—</span>
                      ) : (
                        <span className={result.deviation > 0.05 ? 'text-status-abnormal font-semibold' : 'text-academic-700'}>
                          {(result.deviation * 100).toFixed(2)}%
                        </span>
                      )
                    ) : (
                      <span className="text-academic-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {p.remark && (
                      <div className="flex items-center gap-1">
                        <FileText className={`w-3 h-3 ${p.isRemarkSupplementary ? 'text-amber-500' : 'text-academic-400'}`} />
                        <span className={`max-w-[100px] truncate ${p.isRemarkSupplementary ? 'text-amber-700 font-medium' : 'text-academic-500'}`}>
                          {p.remark}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onSelectProblem(p.id)}
                      className="text-academic-500 hover:text-academic-700 transition-colors p-1 rounded hover:bg-academic-50"
                      title="查看复核详情"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {problems.length === 0 && (
        <div className="py-16 text-center text-academic-500 text-sm">
          暂无符合筛选条件的题目
        </div>
      )}
    </div>
  );
}
