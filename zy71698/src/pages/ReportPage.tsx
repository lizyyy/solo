import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  FileText,
  Download,
  FileJson,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { useAppStore } from '@/store';
import {
  generateReport,
  exportAsText,
  exportAsJson,
  exportAsExcel,
  exportAsPDF,
  printReport,
} from '@/services/reportService';
import { formatDate } from '@/utils/helpers';
import { formatTimecodeFromSeconds } from '@/utils/timecode';
import { MATERIAL_TYPE_LABELS } from '@/types';
import { cn } from '@/lib/utils';

export const ReportPage: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const {
    projects,
    getProjectMaterials,
    getProjectSnapshots,
    getSnapshotIssues,
    getSnapshotAlignments,
    currentSnapshotId,
    setCurrentProject,
    setCurrentSnapshot,
  } = useAppStore();

  const [showExportOptions, setShowExportOptions] = useState(false);

  React.useEffect(() => {
    if (projectId) {
      setCurrentProject(projectId);
    }
  }, [projectId, setCurrentProject]);

  const project = projects.find(p => p.id === projectId);
  const materials = projectId ? getProjectMaterials(projectId) : [];
  const snapshots = projectId ? getProjectSnapshots(projectId) : [];
  const activeSnapshotId = currentSnapshotId || snapshots[0]?.id;
  const activeSnapshot = snapshots.find(s => s.id === activeSnapshotId);
  const issues = activeSnapshotId ? getSnapshotIssues(activeSnapshotId) : [];
  const alignments = activeSnapshotId ? getSnapshotAlignments(activeSnapshotId) : [];

  const reportContent = useMemo(() => {
    if (!project || !activeSnapshot) return '';
    return generateReport(project, activeSnapshot, issues, alignments, materials);
  }, [project, activeSnapshot, issues, alignments, materials]);

  const handleExportText = () => {
    if (!project || !activeSnapshot) return;
    exportAsText(reportContent, project.name, activeSnapshot.versionNumber);
    setShowExportOptions(false);
  };

  const handleExportJson = () => {
    if (!project || !activeSnapshot) return;
    exportAsJson(project, activeSnapshot, issues, alignments, materials);
    setShowExportOptions(false);
  };

  const handleExportExcel = () => {
    if (!project || !activeSnapshot) return;
    exportAsExcel(project, activeSnapshot, issues, alignments);
    setShowExportOptions(false);
  };

  const handleExportPDF = () => {
    if (!project || !activeSnapshot) return;
    exportAsPDF(project, activeSnapshot, issues, alignments, reportContent);
    setShowExportOptions(false);
  };

  const handlePrint = () => {
    printReport(reportContent);
    setShowExportOptions(false);
  };

  const sortedIssues = [...issues].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
    return (a.timecode || 0) - (b.timecode || 0);
  });

  if (!project) {
    return (
      <div className="min-h-full p-6 flex items-center justify-center">
        <div className="card text-center">
          <AlertCircle className="mx-auto text-accent-warning mb-4" size={48} />
          <p>项目不存在</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">报告导出</h2>
            <p className="text-text-muted">
              生成并导出核对报告，支持多种格式
            </p>
          </div>

          <div className="flex gap-3">
            {snapshots.length > 1 && (
              <select
                value={activeSnapshotId || ''}
                onChange={e => setCurrentSnapshot(e.target.value || null)}
                className="input-field w-auto"
              >
                {snapshots.map(s => (
                  <option key={s.id} value={s.id}>
                    v{s.versionNumber} · {formatDate(s.createdAt)}
                  </option>
                ))}
              </select>
            )}

            <div className="relative">
              <button
                onClick={() => setShowExportOptions(!showExportOptions)}
                className="btn-primary flex items-center gap-2"
                disabled={!activeSnapshot}
              >
                <Download size={16} />
                导出报告
                {showExportOptions ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>

              {showExportOptions && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-bg-secondary border border-bg-tertiary rounded-lg shadow-xl z-10 overflow-hidden animate-slide-in">
                  <button
                    onClick={handleExportText}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-bg-tertiary transition-colors text-left"
                  >
                    <FileText size={18} className="text-text-muted" />
                    <div>
                      <p className="text-sm font-medium">纯文本 (TXT)</p>
                      <p className="text-xs text-text-muted">适合快速查看</p>
                    </div>
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-bg-tertiary transition-colors text-left"
                  >
                    <FileSpreadsheet size={18} className="text-accent-success" />
                    <div>
                      <p className="text-sm font-medium">Excel (XLSX)</p>
                      <p className="text-xs text-text-muted">适合数据处理</p>
                    </div>
                  </button>
                  <button
                    onClick={handleExportJson}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-bg-tertiary transition-colors text-left"
                  >
                    <FileJson size={18} className="text-track-dialog" />
                    <div>
                      <p className="text-sm font-medium">JSON</p>
                      <p className="text-xs text-text-muted">适合程序读取</p>
                    </div>
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-bg-tertiary transition-colors text-left"
                  >
                    <FileText size={18} className="text-accent-error" />
                    <div>
                      <p className="text-sm font-medium">PDF文档</p>
                      <p className="text-xs text-text-muted">适合正式交付</p>
                    </div>
                  </button>
                  <div className="border-t border-bg-tertiary">
                    <button
                      onClick={handlePrint}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-bg-tertiary transition-colors text-left"
                    >
                      <Printer size={18} className="text-text-muted" />
                      <div>
                        <p className="text-sm font-medium">打印</p>
                        <p className="text-xs text-text-muted">直接打印报告</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {activeSnapshot ? (
          <div className="bg-white rounded-lg overflow-hidden shadow-xl">
            <div className="bg-bg-secondary p-6 border-b border-bg-tertiary">
              <h1 className="text-2xl font-bold text-text-primary mb-2">
                电影配乐Cue点核对报告
              </h1>
              <div className="flex flex-wrap gap-6 text-sm text-text-secondary">
                <div className="flex items-center gap-2">
                  <span className="text-text-muted">项目：</span>
                  <span className="font-medium">{project.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-text-muted">版本：</span>
                  <span className="font-medium timecode">v{activeSnapshot.versionNumber}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-text-muted" />
                  <span>{formatDate(activeSnapshot.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-accent-success/10 border border-accent-success/20 rounded-lg p-4 text-center">
                  <CheckCircle2 className="mx-auto text-accent-success mb-2" size={24} />
                  <p className="text-2xl font-bold text-accent-success">{activeSnapshot.alignmentPassRate}%</p>
                  <p className="text-xs text-text-muted">对齐通过率</p>
                </div>
                <div className="bg-bg-tertiary rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">{alignments.length}</p>
                  <p className="text-xs text-text-muted">总对齐点数</p>
                </div>
                <div className={cn(
                  'rounded-lg p-4 text-center',
                  activeSnapshot.errorCount > 0 ? 'bg-accent-error/10 border border-accent-error/20' : 'bg-bg-tertiary'
                )}>
                  <AlertCircle className={cn('mx-auto mb-2', activeSnapshot.errorCount > 0 ? 'text-accent-error' : 'text-text-muted')} size={24} />
                  <p className={cn('text-2xl font-bold', activeSnapshot.errorCount > 0 && 'text-accent-error')}>
                    {activeSnapshot.errorCount}
                  </p>
                  <p className="text-xs text-text-muted">错误</p>
                </div>
                <div className={cn(
                  'rounded-lg p-4 text-center',
                  activeSnapshot.warningCount > 0 ? 'bg-accent-warning/10 border border-accent-warning/20' : 'bg-bg-tertiary'
                )}>
                  <AlertTriangle className={cn('mx-auto mb-2', activeSnapshot.warningCount > 0 ? 'text-accent-warning' : 'text-text-muted')} size={24} />
                  <p className={cn('text-2xl font-bold', activeSnapshot.warningCount > 0 && 'text-accent-warning')}>
                    {activeSnapshot.warningCount}
                  </p>
                  <p className="text-xs text-text-muted">警告</p>
                </div>
              </div>

              <div className="mb-8">
                <h2 className="text-lg font-bold mb-4 text-text-primary">核对结论</h2>
                <p className="text-text-primary">{activeSnapshot.summary}</p>
              </div>

              <div className="mb-8">
                <h2 className="text-lg font-bold mb-4 text-text-primary">使用材料</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {activeSnapshot.materials.map(mat => {
                    const actualMaterial = materials.find(m => m.id === mat.materialId);
                    return (
                      <div key={mat.materialId} className="bg-bg-tertiary/50 rounded p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {MATERIAL_TYPE_LABELS[mat.type]}
                          </p>
                          <p className="text-xs text-text-muted">{mat.fileName}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono text-text-muted">
                            {mat.fingerprint.substring(0, 8)}
                          </span>
                          {actualMaterial?.parsedData?.cuePoints && (
                            <p className="text-xs text-text-muted mt-1">
                              {actualMaterial.parsedData.cuePoints.length} 个Cue
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {sortedIssues.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-bold mb-4 text-text-primary">问题列表</h2>
                  <div className="space-y-3">
                    {sortedIssues.map((issue, idx) => (
                      <div
                        key={issue.id}
                        className={cn(
                          'rounded-lg p-4 border',
                          issue.severity === 'error'
                            ? 'bg-accent-error/5 border-accent-error/20'
                            : 'bg-accent-warning/5 border-accent-warning/20'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span className={cn(
                            'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                            issue.severity === 'error' ? 'bg-accent-error/20 text-accent-error' : 'bg-accent-warning/20 text-accent-warning'
                          )}>
                            {idx + 1}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={cn(
                                'text-xs px-2 py-0.5 rounded',
                                issue.severity === 'error' ? 'bg-accent-error/20 text-accent-error' : 'bg-accent-warning/20 text-accent-warning'
                              )}>
                                {issue.severity === 'error' ? '错误' : '警告'}
                              </span>
                              <span className="text-xs text-text-muted">{issue.detectionStep}</span>
                              {issue.timecode !== undefined && (
                                <span className="text-xs font-mono text-text-muted timecode">
                                  {formatTimecodeFromSeconds(issue.timecode)}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-text-primary mb-1">{issue.description}</p>
                            <p className="text-xs text-text-muted">位置：{issue.location}</p>
                            <p className="text-xs text-text-muted mt-1">
                              <span className="text-accent-success">建议：</span>{issue.suggestion}
                            </p>
                          </div>
                          {issue.resolved && (
                            <CheckCircle2 className="text-accent-success flex-shrink-0" size={18} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-lg font-bold mb-4 text-text-primary">时间轴对齐详情</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-bg-tertiary">
                        <th className="text-left py-2 px-3 text-text-muted font-medium">时间码</th>
                        <th className="text-left py-2 px-3 text-text-muted font-medium">状态</th>
                        <th className="text-left py-2 px-3 text-text-muted font-medium">备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alignments.map(alignment => (
                        <tr key={alignment.id} className="border-b border-bg-tertiary/50">
                          <td className="py-2 px-3 font-mono timecode text-text-primary">
                            {formatTimecodeFromSeconds(alignment.timecode)}
                          </td>
                          <td className="py-2 px-3">
                            {alignment.isAligned ? (
                              <span className="text-accent-success flex items-center gap-1">
                                <CheckCircle2 size={14} />
                                对齐
                              </span>
                            ) : (
                              <span className="text-accent-error flex items-center gap-1">
                                <AlertCircle size={14} />
                                错位
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-text-muted">
                            {alignment.issues.join('； ') || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-bg-tertiary text-center text-xs text-text-muted">
                <p>本报告由电影配乐Cue点核对工具自动生成，数据来源与处理页面一致</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="card text-center py-16">
            <FileText className="mx-auto text-text-muted mb-4" size={48} />
            <h3 className="text-lg font-medium mb-2">暂无核对报告</h3>
            <p className="text-text-muted mb-6">请先执行核对以生成报告</p>
          </div>
        )}
      </div>
    </div>
  );
};
