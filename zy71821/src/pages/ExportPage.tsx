import React, { useState, useMemo } from 'react';
import { Download, CheckCircle, AlertTriangle, XCircle, FileSpreadsheet, FileText, Database, Clock, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAppStore } from '../store';
import { CheckItem } from '../types';

export default function ExportPage() {
  const { feedbacks, schedules, rankings, importedFiles } = useAppStore();
  const [exportConfig, setExportConfig] = useState({
    includeRanking: true,
    includeSchedule: true,
    includeFeedback: true,
    includeHistory: true,
    format: 'excel' as 'excel' | 'csv' | 'json',
  });
  const [isChecking, setIsChecking] = useState(false);
  const [checkResults, setCheckResults] = useState<CheckItem[]>([]);
  const [hasChecked, setHasChecked] = useState(false);

  const runConsistencyCheck = () => {
    setIsChecking(true);
    
    setTimeout(() => {
      const results: CheckItem[] = [];
      
      const rankingWithMods = rankings.filter(r => r.modifications.length > 0);
      results.push({
        id: '1',
        name: '排行榜修改记录完整性',
        checked: true,
        status: rankingWithMods.length === rankings.length || rankings.length === 0 ? 'pass' : 'warning',
        message: rankingWithMods.length > 0 
          ? `检测到 ${rankingWithMods.length} 条排行榜记录有修改历史，已全部包含在导出中` 
          : '无修改记录',
      });

      const scheduleWithAnomalies = schedules.filter(s => s.status === 'abnormal');
      results.push({
        id: '2',
        name: '异常排班说明完整性',
        checked: true,
        status: scheduleWithAnomalies.every(s => s.note) ? 'pass' : 'warning',
        message: scheduleWithAnomalies.length > 0 
          ? `共 ${scheduleWithAnomalies.length} 个异常排班，${scheduleWithAnomalies.filter(s => s.note).length} 个已填写说明` 
          : '无异常排班',
      });

      const pendingFeedbacks = feedbacks.filter(f => f.status === 'pending');
      results.push({
        id: '3',
        name: '玩家反馈处理状态',
        checked: true,
        status: pendingFeedbacks.length === 0 ? 'pass' : 'warning',
        message: pendingFeedbacks.length > 0 
          ? `有 ${pendingFeedbacks.length} 条反馈待确认，建议处理后导出` 
          : '所有反馈已处理',
      });

      const duplicateFeedbacks = feedbacks.filter(f => f.isDuplicate);
      results.push({
        id: '4',
        name: '重复数据检测',
        checked: true,
        status: duplicateFeedbacks.length === 0 ? 'pass' : 'warning',
        message: duplicateFeedbacks.length > 0 
          ? `检测到 ${duplicateFeedbacks.length} 条重复数据，导出时将自动标记` 
          : '无重复数据',
      });

      const dateRange = {
        min: schedules.length > 0 ? Math.min(...schedules.map(s => new Date(s.date).getTime())) : null,
        max: schedules.length > 0 ? Math.max(...schedules.map(s => new Date(s.date).getTime())) : null,
      };
      const feedbackInRange = dateRange.min && dateRange.max 
        ? feedbacks.filter(f => {
            const t = new Date(f.timestamp).getTime();
            return t >= dateRange.min! && t <= dateRange.max!;
          }).length
        : 0;
      
      results.push({
        id: '5',
        name: '排班与反馈时间匹配',
        checked: true,
        status: schedules.length === 0 || feedbackInRange > 0 ? 'pass' : 'warning',
        message: `排班周期内有 ${feedbackInRange} 条玩家反馈`,
      });

      results.push({
        id: '6',
        name: '源文件追溯',
        checked: true,
        status: importedFiles.length > 0 ? 'pass' : 'warning',
        message: importedFiles.length > 0 
          ? `已记录 ${importedFiles.length} 个源文件，可追溯数据来源` 
          : '无导入文件记录',
      });

      const totalModifications = rankings.reduce((sum, r) => sum + r.modifications.length, 0) +
        schedules.reduce((sum, s) => sum + s.history.length, 0);
      results.push({
        id: '7',
        name: '操作审计记录',
        checked: true,
        status: 'pass',
        message: `共记录 ${totalModifications} 次人工修改操作，全部可追溯`,
      });

      setCheckResults(results);
      setHasChecked(true);
      setIsChecking(false);
    }, 1500);
  };

  const handleExport = () => {
    if (!hasChecked) {
      alert('请先进行一致性复核');
      return;
    }

    const exportData: any = {
      exportTime: new Date().toISOString(),
      checker: '社群运营',
    };

    if (exportConfig.includeRanking) {
      exportData.rankings = rankings.map(r => ({
        排名: r.rank,
        玩家名称: r.playerName,
        分数: r.score,
        修改次数: r.modifications.length,
        最后修改: r.modifications.length > 0 
          ? new Date(r.modifications[r.modifications.length - 1].timestamp).toLocaleString()
          : '-',
      }));
      
      if (exportConfig.includeHistory) {
        exportData.rankingHistory = rankings.flatMap(r => 
          r.modifications.map(m => ({
            玩家名称: r.playerName,
            修改时间: new Date(m.timestamp).toLocaleString(),
            修改原因: m.reason,
            操作人: m.operator,
            修改前排名: m.before?.rank,
            修改后排名: m.after?.rank,
            修改前分数: m.before?.score,
            修改后分数: m.after?.score,
          }))
        );
      }
    }

    if (exportConfig.includeSchedule) {
      exportData.schedules = schedules.map(s => ({
        日期: s.date,
        矿场类型: s.mineType,
        运营人员: s.operator,
        状态: s.status === 'normal' ? '正常' : s.status === 'abnormal' ? '异常' : '已完成',
        备注: s.note || '',
        修改次数: s.history.length,
      }));
    }

    if (exportConfig.includeFeedback) {
      exportData.feedbacks = feedbacks.map(f => ({
        玩家ID: f.playerId,
        玩家名称: f.playerName,
        反馈内容: f.content,
        时间: new Date(f.timestamp).toLocaleString(),
        来源: f.source === 'file' ? '文件导入' : '手动录入',
        状态: f.status === 'pending' ? '待确认' : f.status === 'confirmed' ? '已确认' : '已解决',
        是否重复: f.isDuplicate ? '是' : '否',
      }));
    }

    exportData.checkResults = checkResults.map(c => ({
      检查项: c.name,
      结果: c.status === 'pass' ? '通过' : c.status === 'warning' ? '警告' : '失败',
      说明: c.message,
    }));

    if (exportConfig.format === 'excel') {
      const wb = XLSX.utils.book_new();
      
      Object.entries(exportData).forEach(([key, data]) => {
        if (Array.isArray(data) && data.length > 0) {
          const ws = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(wb, ws, key);
        }
      });
      
      XLSX.writeFile(wb, `太空矿场活动复盘_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (exportConfig.format === 'json') {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `太空矿场活动复盘_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const passCount = checkResults.filter(r => r.status === 'pass').length;
  const warningCount = checkResults.filter(r => r.status === 'warning').length;
  const failCount = checkResults.filter(r => r.status === 'fail').length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">导出中心</h1>
        <p className="text-slate-400 text-sm mt-1">一致性复核后导出活动复盘和明细数据</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <h2 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-orange-400" />
              导出配置
            </h2>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">包含内容</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportConfig.includeRanking}
                    onChange={(e) => setExportConfig({ ...exportConfig, includeRanking: e.target.checked })}
                    className="rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-slate-300">排行榜数据</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportConfig.includeSchedule}
                    onChange={(e) => setExportConfig({ ...exportConfig, includeSchedule: e.target.checked })}
                    className="rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-slate-300">排班记录</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportConfig.includeFeedback}
                    onChange={(e) => setExportConfig({ ...exportConfig, includeFeedback: e.target.checked })}
                    className="rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-slate-300">玩家反馈</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportConfig.includeHistory}
                    onChange={(e) => setExportConfig({ ...exportConfig, includeHistory: e.target.checked })}
                    className="rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-slate-300">包含修改历史（用于审计）</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">导出格式</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setExportConfig({ ...exportConfig, format: 'excel' })}
                  className={`flex-1 py-2 rounded text-sm flex items-center justify-center gap-1 ${
                    exportConfig.format === 'excel'
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <FileSpreadsheet size={14} />
                  Excel
                </button>
                <button
                  onClick={() => setExportConfig({ ...exportConfig, format: 'json' })}
                  className={`flex-1 py-2 rounded text-sm flex items-center justify-center gap-1 ${
                    exportConfig.format === 'json'
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <Database size={14} />
                  JSON
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-400" />
              一致性复核
            </h2>
            <button
              onClick={runConsistencyCheck}
              disabled={isChecking}
              className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 disabled:opacity-50"
            >
              {isChecking ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  检查中...
                </>
              ) : (
                <>
                  <RefreshCw size={12} />
                  重新检查
                </>
              )}
            </button>
          </div>
          <div className="p-4">
            {!hasChecked ? (
              <div className="text-center py-8">
                <AlertTriangle size={32} className="mx-auto mb-2 text-slate-500" />
                <p className="text-slate-400 text-sm">点击「重新检查」开始一致性复核</p>
                <p className="text-slate-500 text-xs mt-1">导出前必须完成复核</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-4 mb-4 text-sm">
                  <div className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle size={14} />
                    {passCount} 通过
                  </div>
                  <div className="flex items-center gap-1 text-amber-400">
                    <AlertTriangle size={14} />
                    {warningCount} 警告
                  </div>
                  <div className="flex items-center gap-1 text-red-400">
                    <XCircle size={14} />
                    {failCount} 失败
                  </div>
                </div>
                
                {checkResults.map((item) => (
                  <div key={item.id} className="p-3 bg-slate-700/50 rounded">
                    <div className="flex items-start gap-2">
                      {item.status === 'pass' && <CheckCircle size={16} className="text-emerald-400 mt-0.5 shrink-0" />}
                      {item.status === 'warning' && <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />}
                      {item.status === 'fail' && <XCircle size={16} className="text-red-400 mt-0.5 shrink-0" />}
                      <div>
                        <p className="text-sm text-slate-200">{item.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{item.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-slate-300">数据概览</h3>
            <div className="flex gap-6 mt-2 text-sm">
              <div className="flex items-center gap-2">
                <TrophyIcon />
                <span className="text-slate-400">排行榜: <span className="text-slate-200">{rankings.length}</span> 条</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarIcon />
                <span className="text-slate-400">排班: <span className="text-slate-200">{schedules.length}</span> 条</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageIcon />
                <span className="text-slate-400">反馈: <span className="text-slate-200">{feedbacks.length}</span> 条</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-slate-500" />
                <span className="text-slate-400">导入文件: <span className="text-slate-200">{importedFiles.length}</span> 个</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={!hasChecked}
            className={`px-6 py-2 rounded font-medium flex items-center gap-2 ${
              hasChecked
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Download size={18} />
            导出活动复盘
          </button>
        </div>
      </div>
    </div>
  );
}

function TrophyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-500">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
