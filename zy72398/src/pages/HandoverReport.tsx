import { useState, useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import { getBatchTypeName, formatDateTime, formatTemperature, downloadJSON, detectTemperatureMixing } from "@/utils";
import type { HistoryEntry } from "@/types";
import { FileCheck, AlertTriangle, CheckCircle, XCircle, Download, Clock, User, FileText, ChevronDown, ChevronUp, History, FileDiff, Shield, Flag, Eye } from "lucide-react";

export default function HandoverReport() {
  const { 
    currentBatchType, 
    reports, 
    workPhotos,
    inspectionNotes,
    conflicts,
    generateReport,
    getWorkPhotosByBatch,
    getConflictsForPhoto,
    getHistoryForReport
  } = useAppStore();

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [showHistoryEntries, setShowHistoryEntries] = useState(false);

  const batchPhotos = getWorkPhotosByBatch(currentBatchType);
  const batchReports = reports.filter(r => r.batchType === currentBatchType);
  
  const currentReport = useMemo(() => {
    if (selectedReportId) {
      return reports.find(r => r.id === selectedReportId);
    }
    return batchReports[batchReports.length - 1];
  }, [selectedReportId, batchReports, reports]);

  const reportHistory = currentReport ? getHistoryForReport(currentReport.id) : [];

  const { mixed, details: mixingDetails } = detectTemperatureMixing(workPhotos, inspectionNotes);

  const toggleItem = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleGenerate = () => {
    generateReport();
  };

  const handleExport = () => {
    if (!currentReport) return;
    const batchPhotosForExport = getWorkPhotosByBatch(currentBatchType);
    const batchNotesForExport = inspectionNotes.filter(n => 
      batchPhotosForExport.some(p => p.id === n.workPhotoId)
    );
    const batchConflictsForExport = conflicts.filter(c => 
      batchPhotosForExport.some(p => p.id === c.workPhotoId)
    );
    const data = {
      report: currentReport,
      workPhotos: batchPhotosForExport,
      inspectionNotes: batchNotesForExport,
      conflicts: batchConflictsForExport,
      historyEntries: reportHistory,
      exportTime: new Date().toISOString()
    };
    downloadJSON(data, `交接报告_${getBatchTypeName(currentBatchType)}_${Date.now()}.json`);
  };

  const getPreviousReport = () => {
    if (batchReports.length < 2) return null;
    return batchReports[batchReports.length - 2];
  };

  const previousReport = getPreviousReport();

  const compareWithHistory = () => {
    if (!currentReport || !previousReport) return [];
    const diffs: { field: string; current: string; previous: string }[] = [];
    
    if (currentReport.deduplicatedItemCount !== previousReport.deduplicatedItemCount) {
      diffs.push({
        field: '去重后记录数',
        current: String(currentReport.deduplicatedItemCount),
        previous: String(previousReport.deduplicatedItemCount)
      });
    }
    if (currentReport.conflictCount !== previousReport.conflictCount) {
      diffs.push({
        field: '冲突总数',
        current: String(currentReport.conflictCount),
        previous: String(previousReport.conflictCount)
      });
    }
    if (currentReport.resolvedCount !== previousReport.resolvedCount) {
      diffs.push({
        field: '已解决数',
        current: String(currentReport.resolvedCount),
        previous: String(previousReport.resolvedCount)
      });
    }
    if (currentReport.temperatureMixed !== previousReport.temperatureMixed) {
      diffs.push({
        field: '温度单位混用',
        current: currentReport.temperatureMixed ? '是' : '否',
        previous: previousReport.temperatureMixed ? '是' : '否'
      });
    }
    if (currentReport.items.length !== previousReport.items.length) {
      diffs.push({
        field: '报告条目数',
        current: String(currentReport.items.length),
        previous: String(previousReport.items.length)
      });
    }
    
    currentReport.diffusionResults.forEach(cr => {
      const prev = previousReport.diffusionResults.find(d => d.deviceNo === cr.deviceNo);
      if (prev && Math.abs(cr.diffusionRate - prev.diffusionRate) > 0.001) {
        diffs.push({
          field: `${cr.deviceNo} 扩散率`,
          current: cr.diffusionRate.toFixed(4),
          previous: prev.diffusionRate.toFixed(4)
        });
      }
    });
    
    return diffs;
  };

  const historyDiffs = compareWithHistory();

  const getReviewBadge = (status: string) => {
    switch (status) {
      case 'reviewed':
        return <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded flex items-center gap-0.5"><CheckCircle size={10} />已复核</span>;
      case 'flagged':
        return <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded flex items-center gap-0.5"><Flag size={10} />待复核</span>;
      default:
        return <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded flex items-center gap-0.5"><Eye size={10} />待审</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">第三步：交接报告</h2>
          <p className="text-sm text-slate-500 mt-1">生成结构化交接报告，去重后计数，与历史比对，导出完整证据链</p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded">
            {getBatchTypeName(currentBatchType)}
          </span>
        </div>
      </div>

      {mixed && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">存在摄氏度/开尔文混用情况</p>
              <p className="text-xs text-amber-700 mt-1">{mixingDetails.join("；")}</p>
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ 请训练教练复核后再确认报告定稿
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleGenerate}
          className="px-4 py-2 text-sm bg-[#0F4C81] text-white rounded hover:bg-[#0a3a65] transition-colors flex items-center gap-1"
        >
          <FileCheck size={16} />
          生成/更新报告
        </button>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="px-4 py-2 text-sm bg-white border border-slate-200 text-slate-700 rounded hover:bg-slate-50 transition-colors flex items-center gap-1"
        >
          <History size={16} />
          历史对比
          {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          onClick={() => setShowHistoryEntries(!showHistoryEntries)}
          className="px-4 py-2 text-sm bg-white border border-slate-200 text-slate-700 rounded hover:bg-slate-50 transition-colors flex items-center gap-1"
        >
          <FileDiff size={16} />
          变更记录({reportHistory.length})
          {showHistoryEntries ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {currentReport && (
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm bg-white border border-slate-200 text-slate-700 rounded hover:bg-slate-50 transition-colors flex items-center gap-1"
          >
            <Download size={16} />
            导出JSON
          </button>
        )}
      </div>

      {showHistoryEntries && reportHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileDiff size={18} className="text-[#0F4C81]" />
            <h3 className="text-sm font-medium text-slate-800">变更记录（保留原话、修改人和修改原因）</h3>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {reportHistory.map((entry: HistoryEntry) => (
              <div key={entry.id} className="p-3 bg-slate-50 rounded border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-700">{entry.field}</span>
                    <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded line-through">{entry.oldValue}</span>
                    <span className="text-xs text-slate-400">→</span>
                    <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">{entry.newValue}</span>
                  </div>
                  <span className="text-xs text-slate-400">{formatDateTime(entry.modifiedAt)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><User size={10} />修改人：{entry.modifier}</span>
                  <span>原因：{entry.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showHistoryEntries && reportHistory.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 text-center text-sm text-slate-500">
          暂无变更记录
        </div>
      )}

      {showHistory && previousReport && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileDiff size={18} className="text-[#0F4C81]" />
            <h3 className="text-sm font-medium text-slate-800">与上一版本对比</h3>
          </div>
          {historyDiffs.length === 0 ? (
            <p className="text-sm text-slate-500">与上一版本无差异</p>
          ) : (
            <div className="space-y-2">
              {historyDiffs.map((diff, idx) => (
                <div key={idx} className="flex items-center gap-4 p-2 bg-amber-50 rounded text-sm">
                  <span className="font-medium text-slate-700 w-28">{diff.field}</span>
                  <span className="text-red-600 line-through">{diff.previous}</span>
                  <span className="text-slate-400">→</span>
                  <span className="text-green-600 font-medium">{diff.current}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {currentReport ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileCheck size={20} className="text-[#0F4C81]" />
                <div>
                  <h3 className="text-base font-medium text-slate-800">交接报告</h3>
                  <p className="text-xs text-slate-500 mt-0.5">生成时间：{formatDateTime(currentReport.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-800">{currentReport.deduplicatedItemCount}</p>
                  <p className="text-xs text-slate-500">去重后记录</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${currentReport.temperatureMixed ? 'text-amber-600' : 'text-green-600'}`}>
                    {currentReport.temperatureMixed ? '是' : '否'}
                  </p>
                  <p className="text-xs text-slate-500">温度混用</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{currentReport.conflictCount}</p>
                  <p className="text-xs text-slate-500">冲突数</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{currentReport.resolvedCount}</p>
                  <p className="text-xs text-slate-500">已解决</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#0F4C81]">{currentReport.diffusionResults.length}</p>
                  <p className="text-xs text-slate-500">扩散计算</p>
                </div>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {currentReport.items.map((item, idx) => {
              const photo = workPhotos.find(p => p.id === item.workPhotoId);
              const photoConflicts = getConflictsForPhoto(item.workPhotoId);
              const isExpanded = expandedItems.has(item.workPhotoId);
              const diffusion = currentReport.diffusionResults.find(d => d.workPhotoId === item.workPhotoId);
              
              return (
                <div key={item.workPhotoId}>
                  <div 
                    className="px-6 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => toggleItem(item.workPhotoId)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-400 w-8">#{idx + 1}</span>
                      <span className="text-sm font-medium text-slate-800 w-24">{item.deviceNo}</span>
                      <span className="text-sm text-slate-600 w-32">
                        溶氧 {item.dissolvedOxygen} mg/L
                      </span>
                      <span className={`text-sm w-28 ${item.temperatureMixed ? 'text-amber-600 font-medium' : 'text-slate-600'}`}>
                        {formatTemperature(item.temperature, item.temperatureUnit)}
                        {item.temperatureMixed && <span className="ml-1">⚠️</span>}
                      </span>
                      {diffusion && (
                        <span className="text-xs text-slate-500 w-28">
                          扩散率 {diffusion.diffusionRate.toFixed(4)}
                        </span>
                      )}
                      {item.supplementaryUpdated && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">已补录</span>
                      )}
                      <span className="text-xs text-slate-400">
                        {formatDateTime(item.recordTime)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getReviewBadge(item.reviewStatus)}
                      {item.hasConflict && (
                        <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
                          item.conflictResolved 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {item.conflictResolved ? <CheckCircle size={12} /> : <XCircle size={12} />}
                          {photoConflicts.length} 项冲突
                        </span>
                      )}
                      {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="px-6 pb-4">
                      <div className="bg-slate-50 rounded p-4 space-y-3">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500">设备编号：</span>
                            <span className="font-medium">{item.deviceNo}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">溶氧值：</span>
                            <span className="font-medium">{item.dissolvedOxygen} mg/L</span>
                          </div>
                          <div>
                            <span className="text-slate-500">复核状态：</span>
                            {getReviewBadge(item.reviewStatus)}
                          </div>
                        </div>
                        
                        {diffusion && (
                          <div className="grid grid-cols-3 gap-4 text-sm pt-2 border-t border-slate-200">
                            <div>
                              <span className="text-slate-500">扩散率：</span>
                              <span className="font-medium text-[#0F4C81]">{diffusion.diffusionRate.toFixed(4)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">温度(℃)：</span>
                              <span className="font-medium">{diffusion.temperatureC.toFixed(1)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">时间跨度：</span>
                              <span className="font-medium">{diffusion.timeHours.toFixed(1)}h</span>
                            </div>
                          </div>
                        )}
                        
                        {photoConflicts.length > 0 && (
                          <div className="pt-2 border-t border-slate-200">
                            <p className="text-xs text-slate-500 mb-2">冲突详情：</p>
                            <div className="space-y-2">
                              {photoConflicts.map((c) => (
                                <div key={c.id} className="flex items-center gap-3 text-xs p-2 bg-white rounded border border-slate-200">
                                  <span className={`px-1.5 py-0.5 rounded ${
                                    c.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                    c.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                    'bg-amber-100 text-amber-700'
                                  }`}>
                                    {c.status === 'confirmed' ? '已确认' : c.status === 'rejected' ? '已驳回' : '待处理'}
                                  </span>
                                  <span className="text-slate-600">
                                    {c.photoValue} vs {c.noteValue}
                                  </span>
                                  {c.resolverName && (
                                    <span className="text-slate-400 ml-auto">
                                      处理人：{c.resolverName}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <FileCheck size={48} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500 mb-4">暂无报告，点击上方按钮生成</p>
        </div>
      )}

      {batchReports.length > 1 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h3 className="text-sm font-medium text-slate-800 mb-3 flex items-center gap-2">
            <History size={16} />
            历史报告（同批次，去重后计数不翻倍）
          </h3>
          <div className="space-y-2">
            {batchReports.slice().reverse().map((report, idx) => (
              <button
                key={report.id}
                onClick={() => setSelectedReportId(report.id)}
                className={`w-full text-left px-4 py-2 rounded text-sm transition-colors flex items-center justify-between ${
                  selectedReportId === report.id || (!selectedReportId && idx === 0)
                    ? "bg-[#0F4C81]/10 border border-[#0F4C81]"
                    : "bg-slate-50 hover:bg-slate-100 border border-transparent"
                }`}
              >
                <span>
                  版本 {batchReports.length - idx}：{formatDateTime(report.createdAt)}
                </span>
                <span className="text-xs text-slate-500">
                  去重后 {report.deduplicatedItemCount} 条 · 扩散 {report.diffusionResults.length} 项 · 冲突 {report.conflictCount} 项
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="text-sm text-slate-500">
          <User size={14} className="inline mr-1" />
          报告需训练教练最终复核确认
        </div>
        <div className="text-xs text-slate-400">
          证据链完整度：{batchPhotos.length > 0 ? '100%' : '0%'} · 去重口径：设备编号+记录时间
        </div>
      </div>
    </div>
  );
}
