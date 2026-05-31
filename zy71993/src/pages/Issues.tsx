import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { SEVERITY_LABEL, ISSUE_TYPE_LABEL, SEVERITY_COLORS, SEVERITY_BG } from '@/types';
import type { Severity, VerificationIssue } from '@/types';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

const SEVERITY_ORDER: Severity[] = ['dev_required', 'needs_backup', 'ignorable'];

function IssueCard({ issue, expanded, onToggle }: { issue: VerificationIssue; expanded: boolean; onToggle: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const severityBorder: Record<Severity, string> = {
    dev_required: 'border-l-accent-purple',
    needs_backup: 'border-l-accent-red',
    ignorable: 'border-l-accent-amber',
  };

  return (
    <div className={`bg-navy-800/80 rounded-lg border border-navy-500/30 border-l-4 ${severityBorder[issue.severity]} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-navy-700/30 transition-colors"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />}
        <span className="text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0" style={{}} >
          <span className={`${SEVERITY_COLORS[issue.severity]}`}>
            {SEVERITY_LABEL[issue.severity]}
          </span>
        </span>
        <span className="text-xs px-2 py-0.5 rounded bg-navy-600/50 text-slate-300 flex-shrink-0">
          {ISSUE_TYPE_LABEL[issue.type]}
        </span>
        <span className="text-sm text-slate-300 truncate flex-1">{issue.description}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-navy-500/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">原始路径</p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-accent-cyan bg-navy-900 px-2 py-1 rounded break-all">
                  {issue.path}
                </code>
                <button
                  onClick={() => handleCopy(issue.path)}
                  className="text-slate-500 hover:text-accent-cyan transition-colors flex-shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {(issue.detail.expectedChecksum || issue.detail.actualChecksum) && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">校验值</p>
                <div className="space-y-1">
                  {issue.detail.expectedChecksum && (
                    <p className="text-xs font-mono text-slate-400">
                      期望: <span className="text-accent-green">{issue.detail.expectedChecksum}</span>
                    </p>
                  )}
                  {issue.detail.actualChecksum && (
                    <p className="text-xs font-mono text-slate-400">
                      实际: <span className="text-accent-red">{issue.detail.actualChecksum}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
            {issue.detail.duplicateTimestamps && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">重复时间点</p>
                <div className="space-y-1">
                  {issue.detail.duplicateTimestamps.map((ts, i) => (
                    <p key={i} className="text-xs font-mono text-slate-400">{new Date(ts).toLocaleString('zh-CN')}</p>
                  ))}
                </div>
              </div>
            )}
            {issue.detail.rollbackTimestamp && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">回滚时间</p>
                <p className="text-xs font-mono text-slate-400">{new Date(issue.detail.rollbackTimestamp).toLocaleString('zh-CN')}</p>
              </div>
            )}
          </div>

          {issue.relatedLogSnippet && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">相关日志</p>
                <button
                  onClick={() => handleCopy(issue.relatedLogSnippet!)}
                  className="text-slate-500 hover:text-accent-cyan transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <pre className="text-xs font-mono text-slate-400 bg-navy-900 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                {issue.relatedLogSnippet}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Issues() {
  const { result, expandedIssueId, setExpandedIssueId } = useStore();
  const [activeTab, setActiveTab] = useState<Severity | 'all'>('all');

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <p className="text-sm">尚未执行核验，请先在工作台加载数据并核验</p>
      </div>
    );
  }

  const filteredIssues = activeTab === 'all'
    ? result.issues
    : result.issues.filter((i) => i.severity === activeTab);

  const countBySeverity = (s: Severity) => result.issues.filter((i) => i.severity === s).length;

  const tabConfig: { key: Severity | 'all'; label: string; count: number; activeClass: string }[] = [
    { key: 'all', label: '全部', count: result.issues.length, activeClass: 'text-white bg-navy-600' },
    ...SEVERITY_ORDER.map((s) => ({
      key: s,
      label: SEVERITY_LABEL[s],
      count: countBySeverity(s),
      activeClass: SEVERITY_BG[s] + ' ' + SEVERITY_COLORS[s],
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">问题清单</h2>
        <p className="text-sm text-slate-500 mt-1">按严重程度分类的异常条目，点击展开查看追溯详情</p>
      </div>

      <div className="flex items-center gap-2">
        {tabConfig.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              activeTab === tab.key
                ? `${tab.activeClass} border-transparent`
                : 'text-slate-400 bg-navy-800 border-navy-500/30 hover:border-slate-500'
            }`}
          >
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              activeTab === tab.key ? 'bg-white/20' : 'bg-navy-600'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredIssues.length === 0 ? (
          <div className="bg-navy-800/80 rounded-xl border border-navy-500/30 p-8 text-center">
            <p className="text-slate-500 text-sm">该分类下无异常条目</p>
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              expanded={expandedIssueId === issue.id}
              onToggle={() => setExpandedIssueId(expandedIssueId === issue.id ? null : issue.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
