import { useStore } from '@/store';
import { Clock, Image, Filter, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import type { AuditAction } from '@/types';

const actionLabels: Record<string, { text: string; cls: string }> = {
  import: { text: '导入', cls: 'bg-[#0F4C5C]/10 text-[#0F4C5C]' },
  create: { text: '录入', cls: 'bg-blue-50 text-blue-700' },
  supplementary: { text: '补录', cls: 'bg-[#FBBF24]/20 text-yellow-700' },
  conflict_detected: { text: '冲突', cls: 'bg-[#E36414]/10 text-[#E36414]' },
  conflict_resolved: { text: '裁决', cls: 'bg-green-50 text-green-700' },
  review: { text: '复核', cls: 'bg-purple-50 text-purple-700' },
  selfcheck: { text: '自检', cls: 'bg-gray-100 text-gray-700' },
  edit: { text: '修改', cls: 'bg-indigo-50 text-indigo-700' },
  nameplate_duplicate_warning: { text: '铭牌重复', cls: 'bg-[#E36414]/20 text-[#E36414]' },
  record_duplicate_warning: { text: '记录重复', cls: 'bg-[#E36414]/20 text-[#E36414]' },
  supplementary_recalc: { text: '补录重算', cls: 'bg-[#FBBF24]/30 text-yellow-800' },
};

const ALL_ACTIONS: AuditAction[] = ['import', 'create', 'supplementary', 'conflict_detected', 'conflict_resolved', 'review', 'selfcheck', 'edit', 'nameplate_duplicate_warning', 'record_duplicate_warning', 'supplementary_recalc'];

export default function History() {
  const auditLogs = useStore(s => s.auditLogs);
  const records = useStore(s => s.records);
  const nameplates = useStore(s => s.nameplates);
  const screenshots = useStore(s => s.screenshots);
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null);
  const [expandedFilters, setExpandedFilters] = useState(true);
  const [activeFilters, setActiveFilters] = useState<Set<AuditAction>>(new Set());

  const toggleFilter = (a: AuditAction) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  };

  const sortedLogs = [...auditLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const filteredLogs = activeFilters.size > 0 ? sortedLogs.filter(l => activeFilters.has(l.action as AuditAction)) : sortedLogs;

  const recordIdToEquipment: Record<string, string> = {};
  for (const r of records) {
    const np = nameplates.find(n => n.id === r.nameplateId);
    recordIdToEquipment[r.id] = np ? np.equipmentCode : '未关联';
  }
  for (const np of nameplates) {
    recordIdToEquipment[np.id] = np.equipmentCode;
  }

  const stats = {
    total: sortedLogs.length,
    duplicates: sortedLogs.filter(l => l.action === 'nameplate_duplicate_warning' || l.action === 'record_duplicate_warning').length,
    edits: sortedLogs.filter(l => l.action === 'edit').length,
    supplementaries: sortedLogs.filter(l => l.action === 'supplementary' || l.action === 'supplementary_recalc').length,
    conflicts: sortedLogs.filter(l => l.action === 'conflict_detected' || l.action === 'conflict_resolved').length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">历史记录</h2>
        <div className="flex items-center gap-3 text-xs">
          <span className="px-2 py-1 bg-[#0F4C5C]/5 rounded text-[#0F4C5C]">总计: {stats.total}</span>
          <span className="px-2 py-1 bg-[#E36414]/10 rounded text-[#E36414]">重复警告: {stats.duplicates}</span>
          <span className="px-2 py-1 bg-indigo-50 rounded text-indigo-700">修改: {stats.edits}</span>
          <span className="px-2 py-1 bg-yellow-50 rounded text-yellow-700">补录: {stats.supplementaries}</span>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <button onClick={() => setExpandedFilters(!expandedFilters)} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800">
          <Filter size={14} />
          <span className="font-medium">操作类型筛选</span>
          {activeFilters.size > 0 && <span className="px-1.5 py-0.5 bg-[#0F4C5C] text-white rounded text-[10px]">{activeFilters.size}项已选</span>}
          {expandedFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {expandedFilters && (
          <div className="mt-3 flex flex-wrap gap-2">
            {ALL_ACTIONS.map(a => {
              const label = actionLabels[a];
              const active = activeFilters.has(a);
              return (
                <button key={a} onClick={() => toggleFilter(a)} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${active ? `${label.cls} border-transparent shadow-sm` : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {label.text}
                  <span className="ml-1 text-[9px] opacity-70">
                    ({sortedLogs.filter(l => l.action === a).length})
                  </span>
                </button>
              );
            })}
            {activeFilters.size > 0 && (
              <button onClick={() => setActiveFilters(new Set())} className="px-3 py-1 rounded-full text-xs text-gray-400 hover:text-gray-600 underline">
                清除筛选
              </button>
            )}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Clock size={18} className="text-[#0F4C5C]" />
          <h3 className="font-semibold text-gray-800">操作时间线</h3>
          <span className="ml-auto text-xs text-gray-400">{filteredLogs.length} / {sortedLogs.length} 条记录</span>
        </div>

        {filteredLogs.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">{sortedLogs.length === 0 ? '暂无操作记录' : '当前筛选条件无结果'}</p>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
            <div className="space-y-4">
              {filteredLogs.map(log => {
                const al = actionLabels[log.action] || { text: log.action, cls: 'bg-gray-100 text-gray-700' };
                const isWarning = log.action === 'nameplate_duplicate_warning' || log.action === 'record_duplicate_warning';
                const isSupp = log.action === 'supplementary' || log.action === 'supplementary_recalc';
                const isEdit = log.action === 'edit';
                const isResolved = log.action === 'conflict_resolved';

                let dotColor = 'bg-gray-400';
                if (isSupp) dotColor = 'bg-[#FBBF24]';
                else if (isResolved || log.action === 'import') dotColor = 'bg-[#0F4C5C]';
                else if (isWarning) dotColor = 'bg-[#E36414]';
                else if (isEdit) dotColor = 'bg-indigo-500';
                else if (log.action === 'conflict_detected') dotColor = 'bg-[#E36414]';
                else if (log.action === 'review') dotColor = 'bg-purple-500';
                else if (log.action === 'selfcheck') dotColor = 'bg-gray-600';

                const equipment = recordIdToEquipment[log.recordId] || (log.recordId === 'system' ? '系统' : log.recordId.slice(0, 8));

                return (
                  <div key={log.id} className="relative pl-10">
                    <div className={`absolute left-3 top-2 w-3 h-3 rounded-full ${dotColor} border-2 border-white shadow`} />
                    <div className={`p-3 rounded-lg border ${isWarning ? 'border-[#E36414]/30 bg-orange-50/50' : isSupp ? 'border-[#FBBF24]/30 bg-yellow-50/40' : isEdit ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-100'}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${al.cls}`}>{al.text}</span>
                        <span className="text-xs font-medium text-gray-700">{equipment}</span>
                        <span className="text-xs text-gray-500">· {log.operator}</span>
                        <span className="text-xs text-gray-400 ml-auto">{new Date(log.timestamp).toLocaleString('zh-CN')}</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed font-mono">{log.detail}</p>
                      {isWarning && (
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#E36414]">
                          <AlertTriangle size={12} />
                          <span>系统已记录警告，原始操作痕迹未被清洗</span>
                        </div>
                      )}
                      {log.action === 'selfcheck' && (
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-600">
                          {log.detail.includes('通过') ? <CheckCircle2 size={12} className="text-green-600" /> : <AlertTriangle size={12} className="text-[#E36414]" />}
                          <span>详情请见「自检与导出」页面</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Screenshot Gallery */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Image size={18} className="text-[#0F4C5C]" />
          <h3 className="font-semibold text-gray-800">维修群截图</h3>
          <span className="ml-auto text-xs text-gray-400">{screenshots.length} 张 · {screenshots.filter(s => s.lastModified).length} 张备注已编辑</span>
        </div>
        {screenshots.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">暂无截图</p>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {screenshots.map(ss => {
              const record = records.find(r => r.id === ss.recordId);
              const np = record ? nameplates.find(n => n.id === record.nameplateId) : null;
              const noteChanged = !!ss.lastModified;
              return (
                <div key={ss.id} className={`border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer ${noteChanged ? 'border-[#FBBF24]/40 ring-1 ring-[#FBBF24]/20' : 'border-gray-100'}`} onClick={() => setPreviewScreenshot(ss.id)}>
                  <div className="aspect-video bg-gray-100 overflow-hidden relative">
                    <img src={ss.dataUrl} alt="截图" className="w-full h-full object-cover" />
                    {noteChanged && <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-[#FBBF24] text-[9px] text-gray-800 rounded font-medium">备注已编辑</div>}
                  </div>
                  <div className="p-2">
                    <p className="text-xs text-gray-700 truncate font-mono leading-snug">{ss.note || <span className="text-gray-400 italic">(无备注)</span>}</p>
                    <p className="text-[10px] text-gray-400 mt-1 truncate">{np?.equipmentCode || '-'} | {ss.uploader}</p>
                    {ss.changeHistory && ss.changeHistory.length > 0 && <p className="text-[9px] text-[#FBBF24] mt-0.5">备注变更{ss.changeHistory.length}次</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewScreenshot && (() => {
        const ss = screenshots.find(s => s.id === previewScreenshot);
        if (!ss) return null;
        const record = records.find(r => r.id === ss.recordId);
        const np = record ? nameplates.find(n => n.id === record.nameplateId) : null;
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setPreviewScreenshot(null)}>
            <div className="bg-white rounded-xl p-4 max-w-2xl max-h-[85vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
              <img src={ss.dataUrl} alt="截图预览" className="w-full rounded" />
              <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-medium text-gray-500 flex-shrink-0 w-16">设备:</span>
                  <span className="text-sm text-gray-800 font-mono">{np?.equipmentCode || record?.nameplateId.slice(0, 8) || '-'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xs font-medium text-gray-500 flex-shrink-0 w-16">关联记录:</span>
                  <span className="text-sm text-gray-800 font-mono">R={record?.bendRadius}mm D={record?.direction} L={record?.lossValue}dB</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xs font-medium text-gray-500 flex-shrink-0 w-16">备注原文:</span>
                  <div className="text-sm text-gray-800 font-mono bg-white p-2 rounded border border-gray-100 w-full whitespace-pre-wrap">
                    {ss.note || <span className="text-gray-400 italic">（无备注）</span>}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xs font-medium text-gray-500 flex-shrink-0 w-16">上传信息:</span>
                  <span className="text-xs text-gray-500">{ss.uploader} · {new Date(ss.uploadTime).toLocaleString('zh-CN')}{ss.lastModified && <span className="text-[#FBBF24] ml-2">已修改 @ {new Date(ss.lastModified).toLocaleString('zh-CN')}</span>}</span>
                </div>
                {ss.changeHistory && ss.changeHistory.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium text-gray-500 flex-shrink-0 w-16">变更历史:</span>
                    <div className="flex-1 space-y-1">
                      {[...ss.changeHistory].reverse().map((ch) => (
                        <div key={ch.id} className="text-[11px] font-mono pl-3 border-l-2 border-[#FBBF24]/60 py-0.5">
                          <span className="text-red-500">"{ch.oldValue}"</span>
                          <span className="text-gray-400"> → </span>
                          <span className="text-green-600">"{ch.newValue}"</span>
                          <span className="text-gray-400 ml-2">by {ch.changedBy}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => setPreviewScreenshot(null)} className="mt-3 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 w-full">关闭</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
