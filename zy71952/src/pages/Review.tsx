import { useRecordStore } from '../store/useRecordStore';
import { StatusSection } from '../components/review/StatusSection';
import { ReviewChecklist } from '../components/review/ReviewChecklist';
import { ExportButtons } from '../components/review/ExportButtons';
import { FileText } from 'lucide-react';
import { handlingSummary } from '../data/mockData';

export function Review() {
  const { records } = useRecordStore();
  const confirmed = records.filter(r => r.status === 'confirmed');
  const pending = records.filter(r => r.status === 'pending');
  const modified = records.filter(r => r.status === 'modified');

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="border-b border-mono-200 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="text-primary-600" size={24} />
            <h1 className="text-xl font-bold text-mono-800">飞行复盘导出</h1>
          </div>
          <p className="text-sm text-mono-500">
            自动分类「已确认/待补/人工改过」三类记录，附带处理口径，导出一致性报告
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <StatusSection status="confirmed" records={confirmed} />
          <StatusSection status="pending" records={pending} />
          <StatusSection status="modified" records={modified} />
        </div>

        <div className="border border-mono-300 bg-mono-50 p-5">
          <h2 className="text-sm font-bold text-mono-800 mb-3">处理口径摘要</h2>
          <div className="text-sm text-mono-700 leading-relaxed whitespace-pre-line">
            {handlingSummary}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-6">
          <div className="col-span-3">
            <ReviewChecklist />
          </div>
          <div className="col-span-2">
            <div className="border border-mono-300 bg-mono-50 p-4 h-full">
              <h3 className="font-bold text-mono-800 mb-3">导出报告</h3>
              <p className="text-xs text-mono-500 mb-4">
                完成左侧全部复核项后，可导出以下格式的飞行复盘报告：
              </p>
              <div className="space-y-3 mb-6">
                <div className="bg-white border border-mono-200 p-3">
                  <p className="text-sm font-medium text-mono-800">Excel 格式</p>
                  <p className="text-xs text-mono-500 mt-1">
                    包含5个工作表：全部记录、已确认、待补、人工改过、复盘摘要
                  </p>
                </div>
                <div className="bg-white border border-mono-200 p-3">
                  <p className="text-sm font-medium text-mono-800">PDF 格式</p>
                  <p className="text-xs text-mono-500 mt-1">
                    包含统计概览、处理口径、分状态详细记录及异常说明
                  </p>
                </div>
              </div>
              <ExportButtons />
            </div>
          </div>
        </div>

        <div className="border-t border-mono-200 pt-4">
          <div className="flex items-center justify-between text-xs text-mono-400">
            <span>系统生成时间：{new Date().toLocaleString('zh-CN')}</span>
            <span>共 {records.length} 架次记录</span>
          </div>
        </div>
      </div>
    </div>
  );
}
