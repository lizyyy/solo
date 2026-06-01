import { useState } from 'react';
import { MessageSquare, Save, History, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { useStore } from '@/store/useStore';

export function RemarkPanel() {
  const { points, selectedPointId, updatePointRemark, currentOperator } = useStore();
  const [remarkText, setRemarkText] = useState('');
  const [remarkReason, setRemarkReason] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const selectedPoint = points.find((p) => p.id === selectedPointId);

  const handleSave = () => {
    if (!selectedPoint || !remarkText.trim()) return;

    setIsSaving(true);
    setTimeout(() => {
      updatePointRemark(
        selectedPoint.id,
        remarkText.trim(),
        remarkReason.trim() || '补录备注'
      );
      setRemarkText('');
      setRemarkReason('');
      setIsSaving(false);
    }, 300);
  };

  if (!selectedPoint) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-primary-700 font-serif flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          备注补录
        </h3>
        <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg">
          <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>请在场景图或列表中选择一个点位</p>
          <p className="text-xs mt-1">选中后可补录备注并查看变更历史</p>
        </div>
      </div>
    );
  }

  const hasDiff = selectedPoint.diffHistory.length > 0;
  const oldRemark = selectedPoint.diffHistory.find((d) => d.field === 'remark')?.oldValue as string | undefined;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-primary-700 font-serif flex items-center gap-2">
        <MessageSquare className="w-5 h-5" />
        备注补录
      </h3>

      <div className="p-3 bg-primary-50 rounded-lg border border-primary-200">
        <div className="text-sm">
          <span className="text-gray-500">当前选中:</span>
          <span className="font-medium text-primary-700 ml-1">{selectedPoint.name}</span>
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {selectedPoint.instrument} · 楼层 {selectedPoint.floor}
        </div>
      </div>

      {selectedPoint.remark && (
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-xs text-gray-500 mb-1">现有备注</div>
          <p className="text-sm text-gray-700">{selectedPoint.remark}</p>
        </div>
      )}

      {oldRemark !== undefined && oldRemark !== selectedPoint.remark && (
        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="text-xs text-yellow-600 mb-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            补录差异
          </div>
          <div className="text-xs text-yellow-700">
            <div>
              原备注: <span className="line-through">{oldRemark || '(无)'}</span>
            </div>
            <div className="mt-0.5">
              新备注: <span className="font-medium">{selectedPoint.remark || '(无)'}</span>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            备注内容
          </label>
          <textarea
            value={remarkText}
            onChange={(e) => setRemarkText(e.target.value)}
            placeholder="输入备注内容..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all resize-none"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            补录原因
          </label>
          <input
            type="text"
            value={remarkReason}
            onChange={(e) => setRemarkReason(e.target.value)}
            placeholder="如：现场核对后补充、阿乔临时补录等"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!remarkText.trim() || isSaving}
          className="btn btn-primary w-full flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          {isSaving ? '保存中...' : '保存备注'}
        </button>

        <div className="text-xs text-gray-500 text-center">
          操作人: {currentOperator} · 系统将自动记录变更历史
        </div>
      </div>

      {hasDiff && (
        <div className="pt-4 border-t border-gray-100">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors"
          >
            <span className="flex items-center gap-2">
              <History className="w-4 h-4" />
              变更历史 ({selectedPoint.diffHistory.length})
            </span>
            {showHistory ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showHistory && (
            <div className="mt-3 space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
              {selectedPoint.diffHistory
                .slice()
                .reverse()
                .map((diff, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white rounded border border-gray-200 text-xs"
                  >
                    <div className="flex items-center justify-between text-gray-500 mb-2">
                      <span>{diff.operator}</span>
                      <span>{new Date(diff.timestamp).toLocaleString('zh-CN')}</span>
                    </div>
                    <div className="bg-gray-50 px-2 py-1 rounded mb-1">
                      <span className="text-primary-600 font-medium">{diff.reason}</span>
                    </div>
                    <div className="text-gray-700">
                      <span className="text-gray-500">字段:</span> {diff.field}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="text-gray-500">原值:</span>
                      <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded line-through">
                        {String(diff.oldValue) || '(空)'}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded">
                        {String(diff.newValue) || '(空)'}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-xs text-blue-700">
          <div className="font-medium mb-1">补录说明</div>
          <ul className="list-disc list-inside space-y-0.5 text-blue-600">
            <li>补录的备注会同步更新到报告和明细中</li>
            <li>系统会自动记录补录前后的差异</li>
            <li>所有变更都会保留操作人、时间和原因</li>
            <li>导出数据时会包含完整的补录历史</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
