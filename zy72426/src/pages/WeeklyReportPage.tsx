import { useMemo } from 'react';
import { Card } from '@/components/common/Card';
import { StatsCard } from '@/components/report/StatsCard';
import { useEmotionLabelStore } from '@/store/useEmotionLabelStore';
import { exportWeeklyReport } from '@/utils/exporter';
import {
  FileBarChart, Download, Users, Music, CheckCircle, AlertTriangle, Clock, TrendingUp,
  Link2, Link2Off, Info, RefreshCw, FilePlus, FileCheck, FileX,
} from 'lucide-react';

export const WeeklyReportPage = () => {
  const { getUnifiedView, runSelfCheck, runConsistencyCheck, consistencyCheckResult, lastImportInfo, recordExport } = useEmotionLabelStore();

  const view = useMemo(() => getUnifiedView('report'), [getUnifiedView]);
  const records = view.records;
  const groups = view.groups;
  const summary = view.summary;

  const emotionStats = useMemo(() => {
    const stats = new Map<string, number>();
    records.forEach((r) => {
      stats.set(r.emotionTag, (stats.get(r.emotionTag) || 0) + 1);
    });
    return Array.from(stats.entries()).sort((a, b) => b[1] - a[1]);
  }, [records]);

  const statusStats = useMemo(() => {
    return {
      total: records.length,
      confirmed: summary.confirmedCount,
      reviewing: summary.pendingReviewCount,
      pending: summary.pendingCount,
      exception: summary.rejectedCount,
    };
  }, [records, summary]);

  const groupStats = useMemo(() => {
    return {
      total: groups.length,
      confirmed: groups.filter((g) => g.reviewStatus === 'confirmed').length,
      pending: groups.filter((g) => g.reviewStatus === 'pending').length,
    };
  }, [groups]);

  const handleExport = () => {
    runSelfCheck();
    runConsistencyCheck();
    recordExport('weekly_report', '店长');
    setTimeout(() => {
      exportWeeklyReport(view.records, view.groups);
    }, 300);
  };

  const completionRate = summary.completionRate.toFixed(1);

  const emotionColors: Record<string, string> = {
    '欢快': 'bg-yellow-500',
    '治愈': 'bg-green-500',
    '热血': 'bg-red-500',
    '抒情': 'bg-pink-500',
    '悲伤': 'bg-blue-500',
    '紧张': 'bg-purple-500',
    '搞笑': 'bg-orange-500',
    '悬疑': 'bg-gray-500',
    '感动': 'bg-rose-500',
    '其他': 'bg-slate-500',
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            第三步：店长周报更新
          </h1>
          <p className="text-gray-500 mt-1">
            给店长看的汇总视图，与页面/接口/导出读同一份数据快照
            <span className="ml-2 font-mono text-xs text-gray-400">
              哈希: {view.dataHash.slice(0, 12)}...
            </span>
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-5 py-2.5 text-white bg-[#dd6b20] rounded hover:bg-[#c05621] transition-colors"
        >
          <Download className="w-4 h-4" />
          导出周报Excel
        </button>
      </div>

      <div className={`p-4 rounded-lg border ${
        consistencyCheckResult.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {consistencyCheckResult.passed ? (
              <>
                <Link2 className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">周报与页面/导出 数据同源</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    修改记录 → 自动重算 → 三方同步，店长看到的和音乐老师确认的完全一致
                  </p>
                </div>
              </>
            ) : (
              <>
                <Link2Off className="w-6 h-6 text-red-600" />
                <div>
                  <p className="font-medium text-red-800">检测到数据不同源！</p>
                  <p className="text-xs text-red-700 mt-0.5">
                    {consistencyCheckResult.diffs?.length || '?'} 处差异，请点击「运行校验」修复
                  </p>
                </div>
              </>
            )}
          </div>
          <button
            onClick={runConsistencyCheck}
            className="text-xs px-3 py-1 rounded bg-white border text-gray-600 hover:bg-gray-50"
          >
            运行校验
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatsCard
          title="总记录数"
          value={statusStats.total}
          subtitle="音频样本总数"
          icon={<Music className="w-8 h-8" />}
          color="blue"
        />
        <StatsCard
          title="已确认"
          value={statusStats.confirmed}
          subtitle={`完成率 ${completionRate}%`}
          icon={<CheckCircle className="w-8 h-8" />}
          color="green"
        />
        <StatsCard
          title="待复核"
          value={statusStats.reviewing}
          subtitle="需许老师确认"
          icon={<AlertTriangle className="w-8 h-8" />}
          color="amber"
        />
        <StatsCard
          title="已确认分组"
          value={groupStats.confirmed}
          subtitle={`共 ${groupStats.total} 个分组`}
          icon={<Users className="w-8 h-8" />}
          color="gray"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {lastImportInfo && (
            <Card
              title={
                <span className="flex items-center gap-2">
                  <FileBarChart className="w-5 h-5 text-[#dd6b20]" />
                  本期导入分析
                </span>
              }
              subtitle={`批次 ${lastImportInfo.importVersion} · 操作人：${lastImportInfo.operator} · ${new Date(lastImportInfo.importedAt).toLocaleString('zh-CN')}`}
            >
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-800">{lastImportInfo.rawRows}</p>
                  <p className="text-xs text-gray-500">原始行数</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">{lastImportInfo.reusedRows}</p>
                  <p className="text-xs text-gray-500">复用记录</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">{lastImportInfo.newRows}</p>
                  <p className="text-xs text-gray-500">真新增</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-amber-600">{lastImportInfo.resultingReviewCount}</p>
                  <p className="text-xs text-gray-500">待复核</p>
                </div>
              </div>

              {lastImportInfo.reusedPairs.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileCheck className="w-4 h-4 text-green-600" />
                    <p className="text-sm font-medium text-gray-700">复用记录明细（{lastImportInfo.reusedPairs.length} 条）</p>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 bg-gray-50 p-2 rounded text-xs">
                    {lastImportInfo.reusedPairs.map((pair) => (
                      <div key={pair.newKey} className="flex items-center justify-between py-1 px-2 hover:bg-white rounded">
                        <span className="text-gray-700">
                          <span className="text-gray-400">#{pair.existingOriginalRow}</span> {pair.liveName}
                          {pair.liveName !== pair.copyrightName && ` → ${pair.copyrightName}`}
                        </span>
                        <span className="text-green-600 font-medium">
                          {pair.existingGroupCount > 1 ? `${pair.existingGroupCount} 条一组` : '独立'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lastImportInfo.newRecords && lastImportInfo.newRecords.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FilePlus className="w-4 h-4 text-blue-600" />
                    <p className="text-sm font-medium text-gray-700">真新增记录明细（{lastImportInfo.newRecords.length} 条）</p>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 bg-blue-50 p-2 rounded text-xs">
                    {lastImportInfo.newRecords.map((rec) => (
                      <div key={rec.id} className="flex items-center justify-between py-1 px-2 hover:bg-white rounded">
                        <span className="text-gray-700">
                          <span className="text-blue-400">#{rec.originalRowNumber}</span> {rec.liveName}
                          {rec.liveName !== rec.copyrightName && ` → ${rec.copyrightName}`}
                        </span>
                        <span className="text-blue-600 font-medium">{rec.emotionTag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lastImportInfo.rejectedDuplicates.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileX className="w-4 h-4 text-red-500" />
                    <p className="text-sm font-medium text-gray-700">跳过重复项（{lastImportInfo.rejectedDuplicates.length} 条）</p>
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1 bg-red-50 p-2 rounded text-xs">
                    {lastImportInfo.rejectedDuplicates.map((dup, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1 px-2 hover:bg-white rounded">
                        <span className="text-gray-700">
                          第 {dup.row} 行：{dup.liveName} / {dup.copyrightName}
                        </span>
                        <span className="text-red-500 font-medium">与第 {dup.duplicateOfOriginalRow} 行重复</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-gray-600">复用判断逻辑：</span>
                  基于「现场名 + 版权名」组合唯一键匹配。同一首歌导入过第二次时，之前的人工复核结果（情绪标签、误差说明、备注）会直接沿用，无需重复操作。
                </p>
              </div>
            </Card>
          )}

          <Card
            title={
              <span className="flex items-center gap-2">
                <FileBarChart className="w-5 h-5 text-[#1e3a5f]" />
                情绪分布进度条
              </span>
            }
            subtitle="各类情绪标签的歌曲数量分布，与CSV导出第11列情绪标签一致"
          >
            <div className="space-y-4">
              {emotionStats.map(([emotion, count]) => {
                const pct = statusStats.total > 0
                  ? ((count / statusStats.total) * 100).toFixed(1)
                  : '0';
                return (
                  <div key={emotion}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 font-medium">{emotion}</span>
                      <span className="text-gray-500">{count} 首 ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${emotionColors[emotion] || 'bg-[#1e3a5f]'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card
            title={
              <span className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#dd6b20]" />
                改动可追溯清单
              </span>
            }
            subtitle="人工修改过情绪标签、备注、误差说明的记录，按时间倒序"
          >
            {view.changeLog.filter((c) => c.actionType === 'update').length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                暂无人工改动
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {view.changeLog
                  .filter((c) => c.actionType === 'update')
                  .slice(0, 20)
                  .map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-gray-50 rounded border-l-4 border-[#dd6b20] text-sm"
                    >
                      <div className="flex justify-between items-start">
                        <p className="text-gray-700">{log.description}</p>
                        <span className="ml-3 text-xs font-mono text-gray-400 flex-shrink-0">
                          {new Date(log.timestamp).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-gray-500">
                        <span>操作人: <span className="font-medium text-gray-700">{log.operator}</span></span>
                        <span>影响记录: <span className="font-medium text-gray-700">{log.affectedRecordIds.length} 条</span></span>
                        {log.reason && (
                          <span>原因: <span className="text-[#dd6b20]">{log.reason}</span></span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card
            title={
              <span className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                完成率
              </span>
            }
            subtitle="店长关注的整体进度"
          >
            <div className="text-center py-4">
              <p className="text-5xl font-bold text-[#1e3a5f]" style={{ fontFamily: '"Noto Serif SC", serif' }}>
                {completionRate}%
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {statusStats.confirmed + statusStats.exception} / {statusStats.total} 条记录已处理
              </p>
              <div className="mt-4 w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
              {statusStats.reviewing > 0 && (
                <p className="mt-3 text-xs text-amber-700 bg-amber-50 p-2 rounded">
                  还有 <span className="font-bold">{statusStats.reviewing}</span> 条待许老师复核，
                  复核后计入完成率
                </p>
              )}
            </div>
          </Card>

          <Card
            title={
              <span className="flex items-center gap-2">
                <FileBarChart className="w-5 h-5 text-[#1e3a5f]" />
                导出历史记录
              </span>
            }
            subtitle="每次导出留痕，可追溯哪份导出包含哪些数据"
          >
            {(() => {
              const { exportHistory } = useEmotionLabelStore.getState();
              if (exportHistory.length === 0) {
                return (
                  <div className="py-6 text-center text-gray-400 text-sm">
                    暂无导出记录
                  </div>
                );
              }
              return (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {exportHistory.slice(0, 10).map((exp) => (
                    <div key={exp.id} className="p-2 bg-gray-50 rounded text-xs">
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-gray-700">{exp.fileName}</span>
                        <span className="text-[10px] font-mono text-gray-400">
                          #{exp.dataHash.slice(0, 6)}
                        </span>
                      </div>
                      <div className="flex gap-3 mt-1 text-gray-500">
                        <span>{exp.exportType.toUpperCase()}</span>
                        <span>{exp.recordCount} 条</span>
                        <span>{new Date(exp.timestamp).toLocaleTimeString('zh-CN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>

          <Card
            title={
              <span className="flex items-center gap-2">
                <Info className="w-5 h-5 text-[#1e3a5f]" />
                本周重点提示
              </span>
            }
            subtitle="同一首歌现场名/版权名的处理说明"
          >
            <div className="space-y-3 text-sm text-gray-600">
              <div className="p-3 bg-amber-50 rounded border border-amber-100">
                <p className="font-medium text-amber-800 mb-1">⚠ 不急着归正常</p>
                <p className="text-xs text-amber-700">
                  同一首歌有「现场名」和「版权名」两种写法，系统会自动归类为同一组，但保留"复核中"状态，
                  留给音乐老师开会前确认，不做自动通过。
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded border border-blue-100">
                <p className="font-medium text-blue-800 mb-1">📎 原始行号保留</p>
                <p className="text-xs text-blue-700">
                  所有记录（包括已分组的）都会保留票务导出表中的原始行号，
                  店长追问时可直接回到原始表格取证。
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded border border-green-100">
                <p className="font-medium text-green-800 mb-1">✓ 导出一致</p>
                <p className="text-xs text-green-700">
                  本页看到的情绪分布、完成率、待处理数量，与第二步导出的CSV/Excel第1-10列完全一致，
                  通过数据哈希校验。
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
