import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { useRecordStore } from '../store/useRecordStore';
import { StatusBadge } from '../components/StatusBadge';
import { SourceBadge } from '../components/SourceBadge';
import type { TrackCleanupRecord } from '../../shared/types';

export default function ExportPreview() {
  const navigate = useNavigate();
  const { records, filters, loading, exportCsv, fetchRecords } = useRecordStore();
  const [previewRecords, setPreviewRecords] = useState<TrackCleanupRecord[]>([]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    setPreviewRecords(records);
  }, [records]);

  const getFlagTags = (record: TrackCleanupRecord) => {
    const tags: string[] = [];
    if (record.isOldMaster) tags.push('旧版母带');
    if (record.isDuplicate) tags.push('重复曲目');
    if (!record.hasAuthorization) tags.push('缺授权');
    if (record.isRenamed) tags.push(`人工改名(原:${record.originalTrackName})`);
    return tags.length > 0 ? tags.join('、') : '无';
  };

  const handleExport = () => {
    exportCsv();
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading && previewRecords.length === 0) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center">
        <div className="animate-pulse-soft text-slate-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-50">
      <header className="bg-slate-800 text-white py-6 mb-8 no-print">
        <div className="container max-w-5xl px-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={16} />
            返回列表
          </button>
          <h1 className="font-display text-2xl font-semibold">导出清单预览</h1>
          <p className="text-slate-300 text-sm mt-1">
            当前筛选结果共 {previewRecords.length} 条记录 · {new Date().toLocaleDateString('zh-CN')}
          </p>
          <div className="mt-4 flex gap-3">
            <button onClick={handleExport} className="btn-amber flex items-center gap-2">
              <Download size={16} />
              导出 CSV
            </button>
            <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
              <Printer size={16} />
              打印
            </button>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl px-4 pb-12">
        <div className="bg-white rounded-lg shadow-sm border border-warm-100 p-8 print:shadow-none print:border-none print:p-0">
          <div className="text-center mb-8 pb-6 border-b-2 border-amber-500">
            <h2 className="font-display text-2xl font-semibold text-slate-800 mb-2">
              编曲工程轨道清理清单
            </h2>
            <p className="text-sm text-slate-500">
              导出日期：{new Date().toLocaleDateString('zh-CN')} | 记录数量：{previewRecords.length} 条
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-warm-200">
                  <th className="text-left py-3 px-2 font-semibold text-slate-700">序号</th>
                  <th className="text-left py-3 px-2 font-semibold text-slate-700">曲目名称</th>
                  <th className="text-left py-3 px-2 font-semibold text-slate-700">艺人/学生</th>
                  <th className="text-left py-3 px-2 font-semibold text-slate-700">状态</th>
                  <th className="text-left py-3 px-2 font-semibold text-slate-700">来源</th>
                  <th className="text-left py-3 px-2 font-semibold text-slate-700">特殊标记</th>
                  <th className="text-left py-3 px-2 font-semibold text-slate-700">处理备注</th>
                  <th className="text-left py-3 px-2 font-semibold text-slate-700">处理人</th>
                  <th className="text-left py-3 px-2 font-semibold text-slate-700">处理时间</th>
                </tr>
              </thead>
              <tbody>
                {previewRecords.map((record, index) => (
                  <tr key={record.id} className="border-b border-warm-100 hover:bg-warm-50/50">
                    <td className="py-3 px-2 text-slate-600">{index + 1}</td>
                    <td className="py-3 px-2 font-medium text-slate-800">{record.trackName}</td>
                    <td className="py-3 px-2 text-slate-700">{record.artistName}</td>
                    <td className="py-3 px-2">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="py-3 px-2">
                      <SourceBadge source={record.source} />
                    </td>
                    <td className="py-3 px-2 text-slate-600 text-xs">{getFlagTags(record)}</td>
                    <td className="py-3 px-2 text-slate-600 max-w-xs text-xs">{record.currentNote}</td>
                    <td className="py-3 px-2 text-slate-700">{record.latestHandler}</td>
                    <td className="py-3 px-2 text-slate-500 text-xs">{record.latestHandleTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 pt-6 border-t border-warm-200">
            <div className="flex justify-between text-xs text-slate-400">
              <span>厂牌运营 · 编曲工程轨道清理管理系统</span>
              <span>本清单由系统自动生成</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
