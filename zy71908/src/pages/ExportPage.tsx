import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useArchiveStore } from '../store/archiveStore';
import { UrlStateSync } from '../services/UrlStateSync';
import { HumanErrorHandler } from '../services/HumanErrorHandler';
import { SourceBadge, ChangeTypeBadge, StatusBadge } from '../components/Badges';
import { ErrorDisplay } from '../components/ErrorToast';
import { TranspositionValidator } from '../services/TranspositionValidator';
import { format } from 'date-fns';
import { KEY_NAMES } from '../types';
import type { ArchiveRecord } from '../types';
import {
  ArrowLeft, Download, FileCheck, AlertTriangle,
  CheckCircle, Music, User, Clock,
} from 'lucide-react';

export default function ExportPage() {
  const navigate = useNavigate();
  const { getFilteredRecords, filterState, students, error, clearError } = useArchiveStore();
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportComplete, setExportComplete] = React.useState(false);
  const [scopeWarning, setScopeWarning] = React.useState<string | null>(null);

  const filteredRecords = getFilteredRecords();
  const student = filterState.studentId
    ? students.find(s => s.id === filterState.studentId)
    : undefined;

  const rangeDescription = UrlStateSync.getRangeDescription(
    filterState,
    filteredRecords.length,
    student?.name
  );

  const mismatchCount = filteredRecords.filter(r => r.status === 'transposition_mismatch').length;
  const duplicateCount = filteredRecords.filter(r => r.status === 'duplicate').length;

  React.useEffect(() => {
    if (mismatchCount > 0 || duplicateCount > 0) {
      const warnings: string[] = [];
      if (duplicateCount > 0) warnings.push(`${duplicateCount} 条重复记录未处理`);
      if (mismatchCount > 0) warnings.push(`${mismatchCount} 条转调未同步`);
      setScopeWarning(warnings.join('，'));
    }
  }, [mismatchCount, duplicateCount]);

  const handleExport = async () => {
    if (filteredRecords.length === 0) {
      return;
    }

    setIsExporting(true);

    try {
      const content = generateExportContent(filteredRecords);
      const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `排练小结_${format(new Date(), 'yyyyMMdd_HHmmss')}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportComplete(true);
      setTimeout(() => setExportComplete(false), 3000);
    } catch (e) {
      const humanError = HumanErrorHandler.translate(e as Error, {
        userAction: '导出排练小结',
      });
      useArchiveStore.getState().setError(humanError);
    } finally {
      setIsExporting(false);
    }
  };

  const generateExportContent = (records: ArchiveRecord[]): string => {
    const rows = records.map(r => {
      const tResult = TranspositionValidator.validate(r);
      const sourceList = r.sources.map(s => 
        `${s.sourceType === 'metronome' ? '节拍器' : s.sourceType === 'song_list' ? '选曲表' : '曲谱PDF'}${s.isBackfilled ? '(补录)' : ''}`
      ).join('、');
      const keyInfo = r.transposition 
        ? `节拍器:${r.transposition.metronomeKey !== undefined ? KEY_NAMES[r.transposition.metronomeKey] : '-'} | 选曲表:${r.transposition.songListKey !== undefined ? KEY_NAMES[r.transposition.songListKey] : '-'} | 曲谱:${r.transposition.sheetMusicKey !== undefined ? KEY_NAMES[r.transposition.sheetMusicKey] : '-'}`
        : '无';
      const statusText = tResult.isSynced ? '✅ 已同步' : '⚠️ 未同步';
      
      return `<tr>
        <td style="padding:8px;border:1px solid #e2e8f0">${r.student.name}</td>
        <td style="padding:8px;border:1px solid #e2e8f0">${r.pieceName}</td>
        <td style="padding:8px;border:1px solid #e2e8f0">${r.changeType === 'supplement' ? '补材料' : '改结论'}</td>
        <td style="padding:8px;border:1px solid #e2e8f0">${sourceList}</td>
        <td style="padding:8px;border:1px solid #e2e8f0">${keyInfo}</td>
        <td style="padding:8px;border:1px solid #e2e8f0">${statusText}</td>
        <td style="padding:8px;border:1px solid #e2e8f0">${r.createdBy}</td>
        <td style="padding:8px;border:1px solid #e2e8f0">${format(new Date(r.updatedAt), 'yyyy-MM-dd')}</td>
      </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>排练小结</title>
<style>
body{font-family:'Microsoft YaHei',sans-serif;padding:40px;color:#1e293b}
h1{font-size:20px;margin-bottom:8px}
.meta{font-size:12px;color:#64748b;margin-bottom:20px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{padding:8px;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left;font-weight:600}
</style></head><body>
<h1>排练小结</h1>
<p class="meta">导出范围：${rangeDescription}</p>
<p class="meta">导出时间：${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</p>
<table><thead><tr>
<th>学生</th><th>曲目</th><th>变动类型</th><th>数据来源</th><th>转调</th><th>状态</th><th>录入人</th><th>更新日期</th>
</tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-primary-50/30">
      <header className="bg-white/80 backdrop-blur-md border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 h-14">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-neutral-600" />
            </button>
            <h1 className="font-serif text-lg font-bold text-neutral-900">导出排练小结</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {error && <ErrorDisplay error={error} onClose={clearError} />}

        <section className="bg-white rounded-xl border border-neutral-200 p-5">
          <h2 className="font-serif text-sm font-semibold text-neutral-800 flex items-center gap-2 mb-4">
            <FileCheck className="w-4 h-4 text-primary-600" />
            导出范围确认
          </h2>
          <div className="p-3 bg-primary-50 rounded-lg mb-4">
            <p className="text-sm text-primary-800 font-medium">{rangeDescription}</p>
          </div>
          <p className="text-sm text-neutral-600">
            将导出当前筛选条件下的 <span className="font-bold text-neutral-900">{filteredRecords.length}</span> 条归档记录。
            刷新页面或重启后，导出内容将与屏幕显示的筛选范围保持一致。
          </p>
        </section>

        {scopeWarning && (
          <div className="p-4 bg-warning-50 border border-warning-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-warning-800">存在待处理问题</h3>
                <p className="text-sm text-warning-700 mt-1">{scopeWarning}。建议先处理这些问题再导出，否则导出内容可能不完整。</p>
              </div>
            </div>
          </div>
        )}

        {filteredRecords.length > 0 && (
          <section className="bg-white rounded-xl border border-neutral-200 p-5">
            <h2 className="font-serif text-sm font-semibold text-neutral-800 mb-4">预览</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="text-left p-2 text-neutral-500 font-medium text-xs">学生</th>
                    <th className="text-left p-2 text-neutral-500 font-medium text-xs">曲目</th>
                    <th className="text-left p-2 text-neutral-500 font-medium text-xs">类型</th>
                    <th className="text-left p-2 text-neutral-500 font-medium text-xs">转调</th>
                    <th className="text-left p-2 text-neutral-500 font-medium text-xs">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.slice(0, 10).map(r => {
                    const tResult = TranspositionValidator.validate(r);
                    return (
                      <tr key={r.id} className="border-b border-neutral-100">
                        <td className="p-2 text-neutral-800">{r.student.name}</td>
                        <td className="p-2 text-neutral-800">{r.pieceName}</td>
                        <td className="p-2"><ChangeTypeBadge changeType={r.changeType} /></td>
                        <td className="p-2">
                          <span className="flex items-center gap-1 text-xs">
                            <Music className="w-3 h-3" />
                            {tResult.isSynced
                              ? KEY_NAMES[tResult.expectedKey] + '调 ✓'
                              : '未同步 ⚠'
                            }
                          </span>
                        </td>
                        <td className="p-2"><StatusBadge status={r.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredRecords.length > 10 && (
                <p className="text-xs text-neutral-400 text-center mt-2">
                  仅显示前10条，共 {filteredRecords.length} 条
                </p>
              )}
            </div>
          </section>
        )}

        {filteredRecords.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-neutral-200">
            <AlertTriangle className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500 text-sm">当前筛选条件下没有记录</p>
            <Link to="/" className="btn-primary mt-4 inline-block text-sm">
              返回调整筛选
            </Link>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link to="/" className="btn-secondary text-sm">
            返回
          </Link>
          <button
            onClick={handleExport}
            disabled={filteredRecords.length === 0 || isExporting}
            className="btn-primary text-sm flex items-center gap-2"
          >
            {exportComplete ? (
              <>
                <CheckCircle className="w-4 h-4" />
                导出成功
              </>
            ) : isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                正在生成...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                导出排练小结
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
