import { useState } from 'react';
import { Plus, Link2, Calendar } from 'lucide-react';
import { useReviewStore } from '@/store';
import { formatDate } from '@/utils/hash';

export default function BatchesManagement() {
  const {
    batches,
    records,
    addBatch,
    linkBatchToRecord,
  } = useReviewStore();

  const [showAdd, setShowAdd] = useState(false);
  const [newBatch, setNewBatch] = useState({
    batchName: '',
    batchNo: '',
    grayTime: '',
    remark: '',
  });
  const [linkingRecordId, setLinkingRecordId] = useState<string | null>(null);

  const handleAddBatch = () => {
    if (!newBatch.batchName || !newBatch.batchNo || !newBatch.grayTime) {
      alert('请填写批次名称、编号和灰度时间');
      return;
    }

    addBatch({
      ...newBatch,
      grayTime: new Date(newBatch.grayTime).toISOString(),
    });

    setNewBatch({ batchName: '', batchNo: '', grayTime: '', remark: '' });
    setShowAdd(false);
  };

  const handleLink = (recordId: string, batchId: string) => {
    linkBatchToRecord(recordId, batchId);
    setLinkingRecordId(null);
  };

  const unlinkedRecords = records.filter(r => !r.batchId);
  const getBatchRecords = (batchId: string) => records.filter(r => r.batchId === batchId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary-500">
            灰度批次管理
          </h1>
          <p className="mt-2 text-slate-600">
            灰度批次可以后续补录，关联到对应的审查记录。
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors shadow-md"
        >
          <Plus className="w-4 h-4" />
          补录灰度批次
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-primary-200">
          <h3 className="text-lg font-semibold text-primary-500 mb-4">
            补录灰度批次
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                批次名称
              </label>
              <input
                type="text"
                value={newBatch.batchName}
                onChange={(e) => setNewBatch({ ...newBatch, batchName: e.target.value })}
                placeholder="如：第三批次-本地生活"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                批次编号
              </label>
              <input
                type="text"
                value={newBatch.batchNo}
                onChange={(e) => setNewBatch({ ...newBatch, batchNo: e.target.value })}
                placeholder="如：GRAY-2026-0607"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                灰度时间
              </label>
              <input
                type="datetime-local"
                value={newBatch.grayTime}
                onChange={(e) => setNewBatch({ ...newBatch, grayTime: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                备注说明
              </label>
              <input
                type="text"
                value={newBatch.remark}
                onChange={(e) => setNewBatch({ ...newBatch, remark: e.target.value })}
                placeholder="选填：批次说明"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleAddBatch}
              className="px-4 py-2 bg-accent-teal text-white rounded-lg hover:bg-teal-600 transition-colors"
            >
              确认补录
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-primary-500 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            已补录批次
          </h3>
          <div className="space-y-4">
            {batches.map((batch) => (
              <div
                key={batch.id}
                className="border border-slate-200 rounded-lg p-4 hover:border-primary-300 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-slate-800">{batch.batchName}</h4>
                    <p className="text-sm text-slate-500 mt-1">编号：{batch.batchNo}</p>
                    <p className="text-sm text-slate-500">
                      灰度时间：{formatDate(batch.grayTime)}
                    </p>
                    {batch.remark && (
                      <p className="text-xs text-primary-600 mt-2 bg-primary-50 px-2 py-1 rounded inline-block">
                        {batch.remark}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                      {getBatchRecords(batch.id).length} 条关联
                    </span>
                  </div>
                </div>

                {getBatchRecords(batch.id).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500 mb-2">已关联脚本：</p>
                    <div className="space-y-1">
                      {getBatchRecords(batch.id).map((r) => (
                        <p key={r.id} className="text-xs text-slate-600 truncate">
                          • {r.scriptContent.substring(0, 30)}...
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-primary-500 mb-4 flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            未关联批次的审查记录
          </h3>
          {unlinkedRecords.length === 0 ? (
            <p className="text-slate-500 text-sm">所有审查记录都已关联批次</p>
          ) : (
            <div className="space-y-3">
              {unlinkedRecords.map((record) => (
                <div
                  key={record.id}
                  className="border border-dashed border-amber-300 bg-amber-50 rounded-lg p-4"
                >
                  <p className="text-sm text-slate-700">{record.scriptContent}</p>
                  <div className="mt-3">
                    {linkingRecordId === record.id ? (
                      <div className="space-y-2">
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                          onChange={(e) => {
                            if (e.target.value) {
                              handleLink(record.id, e.target.value);
                            }
                          }}
                          defaultValue=""
                        >
                          <option value="">选择要关联的批次...</option>
                          {batches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.batchName} ({b.batchNo})
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => setLinkingRecordId(null)}
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setLinkingRecordId(record.id)}
                        className="text-xs text-primary-500 hover:text-primary-600 flex items-center gap-1"
                      >
                        <Link2 className="w-3 h-3" />
                        关联灰度批次
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
