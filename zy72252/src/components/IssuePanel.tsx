import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, FileText, User, MapPin, Clock, CheckCircle2, Circle } from 'lucide-react';
import type { DetectionIssue, Route, ObstacleNote, FloorSketch } from '../types';
import { RouteDetectionEngine } from '../services/RouteDetectionEngine';
import { cn } from '../lib/utils';

interface IssuePanelProps {
  issues: DetectionIssue[];
  routes: Route[];
  obstacles: ObstacleNote[];
  sketches: FloorSketch[];
  selectedIssueId: string | null;
  onSelectIssue: (issueId: string | null) => void;
  onSupplementSketch: (issueId: string, sketchId: string) => void;
  onResolveIssue: (issueId: string, notes: string) => void;
  onAddSketch: () => void;
}

export function IssuePanel({
  issues,
  routes,
  obstacles,
  sketches,
  selectedIssueId,
  onSelectIssue,
  onSupplementSketch,
  onResolveIssue,
  onAddSketch,
}: IssuePanelProps) {
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');

  const openIssues = issues.filter(i => i.status !== 'resolved');
  const resolvedIssues = issues.filter(i => i.status === 'resolved');

  const toggleExpand = (issueId: string) => {
    setExpandedIssueId(expandedIssueId === issueId ? null : issueId);
  };

  const handleSelectIssue = (issueId: string) => {
    onSelectIssue(issueId);
    setExpandedIssueId(issueId);
  };

  const getRouteForIssue = (issue: DetectionIssue) => {
    return routes.find(r => r.id === issue.routeId);
  };

  const getObstaclesForIssue = (issue: DetectionIssue) => {
    return obstacles.filter(o => o.routeId === issue.routeId);
  };

  const getRelatedSketches = (issue: DetectionIssue) => {
    return sketches.filter(s => s.relatedRouteIds.includes(issue.routeId));
  };

  const IssueCard = ({ issue }: { issue: DetectionIssue }) => {
    const isExpanded = expandedIssueId === issue.id;
    const isSelected = selectedIssueId === issue.id;
    const route = getRouteForIssue(issue);
    const issueObstacles = getObstaclesForIssue(issue);
    const relatedSketches = getRelatedSketches(issue);
    const statusColor = RouteDetectionEngine.getStatusColor(issue.status);
    const severityColor = RouteDetectionEngine.getSeverityColor(issue.severity);

    return (
      <div
        className={cn(
          'rounded-lg border-2 transition-all duration-200 mb-3 overflow-hidden',
          isSelected ? 'border-primary-500 bg-primary-50' : 'border-industrial-100 bg-white hover:border-primary-200'
        )}
      >
        <div
          className="p-4 cursor-pointer"
          onClick={() => handleSelectIssue(issue.id)}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                issue.status === 'open' ? 'bg-red-100' : 'bg-warning-100'
              )}>
                <AlertTriangle className={cn(
                  'w-4 h-4',
                  issue.status === 'open' ? 'text-error-500' : 'text-warning-500'
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-industrial-600 truncate">
                  {issue.description}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', statusColor)}>
                    {RouteDetectionEngine.getStatusLabel(issue.status)}
                  </span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', severityColor)}>
                    {issue.severity === 'warning' ? '警告' : '错误'}
                  </span>
                  <span className="text-xs text-industrial-300 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(issue.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpand(issue.id); }}
              className="p-1 hover:bg-industrial-50 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 text-industrial-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-industrial-400" />
              )}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 border-t border-industrial-100 pt-4">
            {route && (
              <div className="bg-industrial-50 p-3 rounded-lg mb-3">
                <p className="text-xs font-medium text-industrial-500 mb-2">路线信息</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-industrial-400">路线名称:</span>
                    <span className="ml-2 text-industrial-600 font-medium">{route.name}</span>
                  </div>
                  <div>
                    <span className="text-industrial-400">记录长度:</span>
                    <span className="ml-2 font-mono text-primary-600">{route.length}m</span>
                  </div>
                  {route.calculatedLength && (
                    <div className="col-span-2">
                      <span className="text-industrial-400">实测长度:</span>
                      <span className="ml-2 font-mono text-warning-500">{route.calculatedLength}m</span>
                      <span className="ml-2 text-xs text-error-500">(差异: {(route.calculatedLength - route.length).toFixed(2)}m)</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {issueObstacles.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-industrial-500 mb-2 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  障碍物备注
                </p>
                {issueObstacles.map(obstacle => (
                  <div key={obstacle.id} className="bg-warning-50 p-3 rounded-lg mb-2">
                    <p className="text-sm text-industrial-600">{obstacle.content}</p>
                    <p className="text-xs text-industrial-400 mt-1 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {obstacle.createdBy === 'designer' ? '设计师阿景' : '展陈客户'}
                      <span className="mx-1">·</span>
                      {new Date(obstacle.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {relatedSketches.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-industrial-500 mb-2 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  关联楼层剖面草图
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {relatedSketches.map(sketch => (
                    <div key={sketch.id} className="relative rounded-lg overflow-hidden border border-industrial-200">
                      <img src={sketch.imageUrl} alt={sketch.description} className="w-full h-24 object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <p className="text-xs text-white">{sketch.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-3">
              <p className="text-xs font-medium text-industrial-500 mb-2">缺失材料</p>
              <div className="flex flex-wrap gap-2">
                {issue.missingMaterials.map((material, idx) => (
                  <span key={idx} className="text-xs px-2 py-1 bg-red-50 text-error-500 rounded flex items-center gap-1">
                    <Circle className="w-2 h-2 fill-current" />
                    {material}
                  </span>
                ))}
                {issue.missingMaterials.length === 0 && (
                  <span className="text-xs px-2 py-1 bg-green-50 text-success-500 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    材料齐全
                  </span>
                )}
              </div>
            </div>

            <div className="bg-primary-50 p-3 rounded-lg mb-3">
              <p className="text-xs font-medium text-primary-600 mb-1">下一步行动</p>
              <p className="text-sm text-primary-700">
                {RouteDetectionEngine.getNextActionLabel(issue.nextAction)}
              </p>
            </div>

            <div className="flex gap-2">
              {issue.status === 'open' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAddSketch(); }}
                  className="flex-1 py-2 px-3 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
                >
                  补录楼层剖面草图
                </button>
              )}

              {issue.status === 'supplemented' && (
                <>
                  <div className="flex-1 flex flex-col gap-2">
                    <textarea
                      value={resolveNotes}
                      onChange={(e) => setResolveNotes(e.target.value)}
                      placeholder="输入复核意见..."
                      className="w-full px-3 py-2 text-sm border border-industrial-200 rounded-lg focus:outline-none focus:border-primary-500 resize-none"
                      rows={2}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (resolveNotes.trim()) {
                            onResolveIssue(issue.id, resolveNotes);
                            setResolveNotes('');
                          }
                        }}
                        className="flex-1 py-2 px-3 bg-success-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
                      >
                        客户复核确认解决
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onAddSketch(); }}
                        className="py-2 px-3 bg-industrial-100 text-industrial-600 text-sm font-medium rounded-lg hover:bg-industrial-200 transition-colors"
                      >
                        继续补充材料
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-industrial-100">
      <h2 className="text-lg font-semibold text-industrial-600">问题检测面板</h2>
      <div className="flex items-center gap-4 mt-2">
        <span className="text-sm px-3 py-1 bg-red-50 text-error-500 rounded-full">
          {openIssues.length} 个待处理
        </span>
        <span className="text-sm px-3 py-1 bg-green-50 text-success-500 rounded-full">
          {resolvedIssues.length} 个已解决
        </span>
      </div>
    </div>

    <div className="flex-1 overflow-y-auto p-4">
      {issues.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle2 className="w-12 h-12 text-success-500 mx-auto mb-3" />
          <p className="text-industrial-400">未检测到问题</p>
        </div>
      ) : (
        <>
          {openIssues.length > 0 && (
            <div>
              <p className="text-xs font-medium text-industrial-400 uppercase tracking-wider mb-3">待处理问题</p>
              {openIssues.map(issue => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          )}

          {resolvedIssues.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-medium text-industrial-400 uppercase tracking-wider mb-3">已解决问题</p>
              {resolvedIssues.map(issue => (
                <div key={issue.id} className="opacity-60">
                  <IssueCard issue={issue} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
    </div>
  );
}
