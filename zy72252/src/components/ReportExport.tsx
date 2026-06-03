import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Download, FileText, User, AlertTriangle, CheckCircle2, Clock, MapPin } from 'lucide-react';
import type { Project, DetectionIssue, Route, ObstacleNote, FloorSketch } from '../types';
import { RouteDetectionEngine } from '../services/RouteDetectionEngine';
import { cn } from '../lib/utils';

interface ReportExportProps {
  project: Project;
  issues: DetectionIssue[];
  routes: Route[];
  obstacles: ObstacleNote[];
  sketches: FloorSketch[];
}

export function ReportExport({ project, issues, routes, obstacles, sketches }: ReportExportProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [customNotes, setCustomNotes] = useState('');

  const openIssues = issues.filter(i => i.status !== 'resolved');
  const resolvedIssues = issues.filter(i => i.status === 'resolved');

  const getRouteForIssue = (issue: DetectionIssue) => {
    return routes.find(r => r.id === issue.routeId);
  };

  const getObstaclesForIssue = (issue: DetectionIssue) => {
    return obstacles.filter(o => o.routeId === issue.routeId);
  };

  const getSketchesForIssue = (issue: DetectionIssue) => {
    return sketches.filter(s => s.relatedRouteIds.includes(issue.routeId));
  };

  const generateSummary = () => {
    if (openIssues.length === 0) {
      return `项目"${project.name}"所有路线已通过检测，长度计算完整，无待处理问题。`;
    }
    return `项目"${project.name}"检测到 ${openIssues.length} 个待处理问题，主要为补录路线未重新计算长度，需要展陈客户复核确认。`;
  };

  const generateNextSteps = () => {
    const steps: string[] = [];
    
    openIssues.forEach(issue => {
      if (issue.status === 'open') {
        steps.push(`【${issue.description}】→ 联系设计师阿景补录楼层剖面草图`);
      } else if (issue.status === 'supplemented') {
        steps.push(`【${issue.description}】→ 请展陈客户复核确认，确认后标记为已解决`);
      }
    });

    if (steps.length === 0) {
      steps.push('所有问题已解决，可安排现场施工');
    }

    return steps;
  };

  const handleExport = async () => {
    if (!reportRef.current) return;

    setIsExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });

      const link = document.createElement('a');
      link.download = `${project.name}-安全检测报告-${new Date().toLocaleDateString('zh-CN')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-industrial-100 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-industrial-600">智能报告导出</h2>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {isExporting ? '导出中...' : '导出报告截图'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div
          ref={reportRef}
          className="bg-white rounded-xl shadow-lg overflow-hidden"
          style={{ minWidth: '800px' }}
        >
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">舞台吊点安全检测报告</h1>
                <p className="text-primary-100 mt-1">{project.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-primary-100">报告编号</p>
                <p className="font-mono font-bold">SS-{project.id.toUpperCase().slice(0, 8)}</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-industrial-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-industrial-500 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                报告摘要
              </h3>
              <p className="text-industrial-600">{generateSummary()}</p>
              {customNotes && (
                <div className="mt-3 pt-3 border-t border-industrial-200">
                  <p className="text-xs text-industrial-400 mb-1">补充说明</p>
                  <p className="text-sm text-industrial-600">{customNotes}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-primary-50 rounded-lg">
                <p className="text-3xl font-bold text-primary-600">{routes.length}</p>
                <p className="text-xs text-industrial-400 mt-1">路线总数</p>
              </div>
              <div className="text-center p-4 bg-warning-50 rounded-lg">
                <p className="text-3xl font-bold text-warning-600">{routes.filter(r => r.isSupplementary).length}</p>
                <p className="text-xs text-industrial-400 mt-1">补录路线</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-3xl font-bold text-error-500">{openIssues.length}</p>
                <p className="text-xs text-industrial-400 mt-1">待处理问题</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-success-500">{resolvedIssues.length}</p>
                <p className="text-xs text-industrial-400 mt-1">已解决</p>
              </div>
            </div>

            {issues.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-industrial-500 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning-500" />
                  问题详情
                </h3>
                <div className="space-y-3">
                  {issues.map((issue) => {
                    const route = getRouteForIssue(issue);
                    const issueObstacles = getObstaclesForIssue(issue);
                    const issueSketches = getSketchesForIssue(issue);
                    const statusColor = RouteDetectionEngine.getStatusColor(issue.status);

                    return (
                      <div key={issue.id} className="border border-industrial-200 rounded-lg overflow-hidden">
                        <div className={cn('px-4 py-3 flex items-center justify-between', issue.status === 'resolved' ? 'bg-green-50' : 'bg-red-50')}>
                          <div className="flex items-center gap-3">
                            {issue.status === 'resolved' ? (
                              <CheckCircle2 className="w-5 h-5 text-success-500" />
                            ) : (
                              <AlertTriangle className="w-5 h-5 text-error-500" />
                            )}
                            <div>
                              <p className="font-medium text-industrial-600">{issue.description}</p>
                              <p className="text-xs text-industrial-400 mt-0.5 flex items-center gap-2">
                                <Clock className="w-3 h-3" />
                                {new Date(issue.createdAt).toLocaleString('zh-CN')}
                              </p>
                            </div>
                          </div>
                          <span className={cn('text-xs px-2 py-1 rounded-full font-medium', statusColor)}>
                            {RouteDetectionEngine.getStatusLabel(issue.status)}
                          </span>
                        </div>

                        <div className="px-4 py-3 bg-white space-y-3">
                          {route && (
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-industrial-400">路线名称:</span>
                                <span className="ml-2 text-industrial-600 font-medium">{route.name}</span>
                              </div>
                              <div>
                                <span className="text-industrial-400">记录长度:</span>
                                <span className="ml-2 font-mono text-primary-600">{route.length}m</span>
                              </div>
                              {route.calculatedLength && (
                                <div>
                                  <span className="text-industrial-400">实测长度:</span>
                                  <span className="ml-2 font-mono text-warning-500">{route.calculatedLength}m</span>
                                </div>
                              )}
                            </div>
                          )}

                          {issue.missingMaterials.length > 0 && (
                            <div>
                              <p className="text-xs text-industrial-400 mb-2">缺失材料:</p>
                              <div className="flex flex-wrap gap-2">
                                {issue.missingMaterials.map((m, idx) => (
                                  <span key={idx} className="text-xs px-2 py-1 bg-red-50 text-error-500 rounded">
                                    {m}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {issueObstacles.length > 0 && (
                            <div className="bg-warning-50 p-3 rounded-lg">
                              <p className="text-xs font-medium text-warning-600 mb-1">障碍物备注</p>
                              {issueObstacles.map((obs, idx) => (
                                <p key={idx} className="text-sm text-industrial-600">{obs.content}</p>
                              ))}
                            </div>
                          )}

                          {issueSketches.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-industrial-400 mb-2 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                关联楼层剖面草图
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                {issueSketches.map((sketch, idx) => (
                                  <div key={idx} className="relative rounded-lg overflow-hidden">
                                    <img src={sketch.imageUrl} alt="" className="w-full h-20 object-cover" />
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 p-1">
                                      <p className="text-xs text-white">{sketch.description}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="bg-primary-50 p-3 rounded-lg">
                            <p className="text-xs font-medium text-primary-600 mb-1">为什么这条被留下?</p>
                            <p className="text-sm text-primary-700">
                              该路线为补录路线，未重新计算长度，可能存在安全隐患。需确认实际路线长度与设计值一致后才能放行。
                            </p>
                          </div>

                          <div className="bg-warning-50 p-3 rounded-lg">
                            <p className="text-xs font-medium text-warning-600 mb-1">下一步该找谁?</p>
                            <p className="text-sm text-warning-700 flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {RouteDetectionEngine.getNextActionLabel(issue.nextAction)}
                            </p>
                          </div>

                          {issue.reviewNotes && (
                            <div className="bg-green-50 p-3 rounded-lg">
                              <p className="text-xs font-medium text-success-500 mb-1">复核意见</p>
                              <p className="text-sm text-industrial-600">{issue.reviewNotes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-primary-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-primary-600 mb-2">后续行动清单</h3>
              <ol className="space-y-2">
                {generateNextSteps().map((step, idx) => (
                  <li key={idx} className="text-sm text-primary-700 flex items-start gap-2">
                    <span className="w-5 h-5 bg-primary-500 text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">
                      {idx + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <div className="text-right pt-4 border-t border-industrial-100">
              <p className="text-xs text-industrial-400">
                报告生成时间: {new Date().toLocaleString('zh-CN')}
              </p>
              <p className="text-xs text-industrial-400">
                生成人: 舞台吊点安全演示系统
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-industrial-500 mb-2">添加报告备注 (可选)</label>
          <textarea
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
            placeholder="输入需要在报告中显示的补充说明..."
            className="w-full px-3 py-2 border border-industrial-200 rounded-lg focus:outline-none focus:border-primary-500 resize-none"
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}
