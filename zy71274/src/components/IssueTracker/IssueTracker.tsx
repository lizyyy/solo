import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { formatDate } from '@/utils/physics';
import { Search, CheckCircle, Wrench, User, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/utils/cn';

export function IssueTracker() {
  const { issueTracks, updateIssueTrack } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fixerName, setFixerName] = useState<string>('');
  const [confirmerName, setConfirmerName] = useState<string>('');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'discovered':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-red-900/50 text-red-400 border border-red-800">已发现</span>;
      case 'fixed':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-amber-900/50 text-amber-400 border border-amber-800">已修正</span>;
      case 'confirmed':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-green-900/50 text-green-400 border border-green-800">已确认</span>;
      default:
        return null;
    }
  };

  const handleMarkFixed = (id: string) => {
    updateIssueTrack(id, {
      status: 'fixed',
      fixed_by: fixerName || '讲解员',
      fixed_at: new Date()
    });
  };

  const handleMarkConfirmed = (id: string) => {
    updateIssueTrack(id, {
      status: 'confirmed',
      confirmed_by: confirmerName || '审核员',
      confirmed_at: new Date()
    });
  };

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700">
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Search size={16} className="text-purple-400" />
          问题追踪
        </h3>
        <p className="text-xs text-slate-500 mt-1">发现问题 → 修正处理 → 审核确认</p>
      </div>

      <div className="p-2 max-h-80 overflow-y-auto">
        {issueTracks.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <CheckCircle size={40} className="mx-auto mb-2 text-green-500" />
            <p className="text-sm">暂无待处理问题</p>
          </div>
        ) : (
          <div className="space-y-2">
            {issueTracks.map((issue) => (
              <div
                key={issue.id}
                className={cn(
                  "rounded-lg border transition-all",
                  issue.status === 'discovered' && "border-red-800/50 bg-red-950/20",
                  issue.status === 'fixed' && "border-amber-800/50 bg-amber-950/20",
                  issue.status === 'confirmed' && "border-green-800/50 bg-green-950/20"
                )}
              >
                <div
                  className="p-3 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(issue.status)}
                      <span className="text-xs text-slate-500">#{issue.id}</span>
                    </div>
                    <ChevronDown
                      size={14}
                      className={cn(
                        "transition-transform",
                        expandedId === issue.id && "rotate-180"
                      )}
                    />
                  </div>
                  <p className="text-sm mt-2 text-slate-300">{issue.description}</p>
                </div>

                {expandedId === issue.id && (
                  <div className="px-3 pb-3 border-t border-slate-700/50 pt-3">
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Search size={12} />
                        <span>发现人: {issue.discovered_by}</span>
                        <Calendar size={12} className="ml-2" />
                        <span>{formatDate(issue.discovered_at)}</span>
                      </div>

                      {issue.status === 'discovered' && (
                        <div className="mt-3 pt-3 border-t border-slate-700/50">
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="text"
                              placeholder="修正人姓名"
                              value={fixerName}
                              onChange={(e) => setFixerName(e.target.value)}
                              className="flex-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                            />
                            <button
                              onClick={() => handleMarkFixed(issue.id)}
                              className="flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-500 rounded text-xs"
                            >
                              <Wrench size={12} />
                              标记已修正
                            </button>
                          </div>
                        </div>
                      )}

                      {issue.fixed_by && (
                        <div className="flex items-center gap-2 text-slate-400">
                          <Wrench size={12} />
                          <span>修正人: {issue.fixed_by}</span>
                          {issue.fixed_at && (
                            <>
                              <Calendar size={12} className="ml-2" />
                              <span>{formatDate(issue.fixed_at)}</span>
                            </>
                          )}
                        </div>
                      )}

                      {issue.status === 'fixed' && (
                        <div className="mt-3 pt-3 border-t border-slate-700/50">
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="text"
                              placeholder="确认人姓名"
                              value={confirmerName}
                              onChange={(e) => setConfirmerName(e.target.value)}
                              className="flex-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                            />
                            <button
                              onClick={() => handleMarkConfirmed(issue.id)}
                              className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-xs"
                            >
                              <CheckCircle size={12} />
                              确认通过
                            </button>
                          </div>
                        </div>
                      )}

                      {issue.confirmed_by && (
                        <div className="flex items-center gap-2 text-slate-400">
                          <User size={12} />
                          <span>确认人: {issue.confirmed_by}</span>
                          {issue.confirmed_at && (
                            <>
                              <Calendar size={12} className="ml-2" />
                              <span>{formatDate(issue.confirmed_at)}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
