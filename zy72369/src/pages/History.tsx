import { useStore } from '@/store';
import { Clock, Image } from 'lucide-react';
import { useState } from 'react';

const actionLabels: Record<string, { text: string; cls: string }> = {
  import: { text: '导入', cls: 'bg-[#0F4C5C]/10 text-[#0F4C5C]' },
  create: { text: '录入', cls: 'bg-blue-50 text-blue-700' },
  supplementary: { text: '补录', cls: 'bg-[#FBBF24]/20 text-yellow-700' },
  conflict_detected: { text: '冲突', cls: 'bg-[#E36414]/10 text-[#E36414]' },
  conflict_resolved: { text: '裁决', cls: 'bg-green-50 text-green-700' },
  review: { text: '复核', cls: 'bg-purple-50 text-purple-700' },
  selfcheck: { text: '自检', cls: 'bg-gray-100 text-gray-700' },
};

export default function History() {
  const auditLogs = useStore(s => s.auditLogs);
  const records = useStore(s => s.records);
  const nameplates = useStore(s => s.nameplates);
  const screenshots = useStore(s => s.screenshots);
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null);

  const sortedLogs = [...auditLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-900">历史记录</h2>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Clock size={18} className="text-[#0F4C5C]" />
          <h3 className="font-semibold text-gray-800">操作时间线</h3>
          <span className="ml-auto text-xs text-gray-400">{sortedLogs.length} 条记录</span>
        </div>

        {sortedLogs.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">暂无操作记录</p>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
            <div className="space-y-4">
              {sortedLogs.map(log => {
                const al = actionLabels[log.action] || { text: log.action, cls: 'bg-gray-100 text-gray-700' };
                const isSupp = log.action === 'supplementary';
                const dotColor = isSupp ? 'bg-[#FBBF24]' : log.action === 'conflict_resolved' ? 'bg-[#0F4C5C]' : log.action === 'conflict_detected' ? 'bg-[#E36414]' : 'bg-gray-400';
                return (
                  <div key={log.id} className="relative pl-10">
                    <div className={`absolute left-3 top-2 w-3 h-3 rounded-full ${dotColor} border-2 border-white`} />
                    <div className={`p-3 rounded-lg border ${isSupp ? 'border-[#FBBF24]/30 bg-yellow-50/30' : 'border-gray-100'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${al.cls}`}>{al.text}</span>
                        <span className="text-xs text-gray-500">{log.operator}</span>
                        <span className="text-xs text-gray-400 ml-auto">{new Date(log.timestamp).toLocaleString('zh-CN')}</span>
                      </div>
                      <p className="text-sm text-gray-700">{log.detail}</p>
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
          <span className="ml-auto text-xs text-gray-400">{screenshots.length} 张</span>
        </div>
        {screenshots.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">暂无截图</p>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {screenshots.map(ss => {
              const record = records.find(r => r.id === ss.recordId);
              const np = record ? nameplates.find(n => n.id === record.nameplateId) : null;
              return (
                <div key={ss.id} className="border border-gray-100 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => setPreviewScreenshot(ss.id)}>
                  <div className="aspect-video bg-gray-100 overflow-hidden">
                    <img src={ss.dataUrl} alt="截图" className="w-full h-full object-cover" />
                  </div>
                  <div className="p-2">
                    <p className="text-xs text-gray-700 truncate">{ss.note || '无备注'}</p>
                    <p className="text-[10px] text-gray-400">{np?.equipmentCode || '-'} | {ss.uploader}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Screenshot Preview Modal */}
      {previewScreenshot && (() => {
        const ss = screenshots.find(s => s.id === previewScreenshot);
        if (!ss) return null;
        const record = records.find(r => r.id === ss.recordId);
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setPreviewScreenshot(null)}>
            <div className="bg-white rounded-xl p-4 max-w-2xl max-h-[80vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
              <img src={ss.dataUrl} alt="截图预览" className="w-full rounded" />
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-800">{ss.note || '无备注'}</p>
                <p className="text-xs text-gray-400 mt-1">上传者: {ss.uploader} | 时间: {new Date(ss.uploadTime).toLocaleString('zh-CN')}</p>
                {record && <p className="text-xs text-gray-400">关联记录: R={record.bendRadius}mm D={record.direction}</p>}
              </div>
              <button onClick={() => setPreviewScreenshot(null)} className="mt-3 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">关闭</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
