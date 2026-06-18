import { useState, useEffect } from 'react';
import { X, FileText, MessageSquare, Clock, Send } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import { formatAmount, getStatusLabel, getStatusColor } from '@/utils/format';
import { cn } from '@/lib/utils';
import type { CreditRecord, OperationLog, RemarkItem } from '../../shared/types';

export function RecordDetailDrawer() {
  const { detailRecord, setDetailRecord, fetchRecords } = useDashboardStore();
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [remarkContent, setRemarkContent] = useState('');
  const [submittingRemark, setSubmittingRemark] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'remarks' | 'logs'>('info');
  const [currentRecord, setCurrentRecord] = useState<CreditRecord | null>(null);

  useEffect(() => {
    if (!detailRecord) {
      setCurrentRecord(null);
      return;
    }
    setCurrentRecord(detailRecord);
    fetch(`/api/records/${detailRecord.id}/logs`)
      .then(r => r.json())
      .then(d => { if (d.success) setLogs(d.data); })
      .catch(() => {});
  }, [detailRecord]);

  if (!currentRecord) return null;

  const handleAddRemark = async () => {
    if (!remarkContent.trim() || !currentRecord) return;
    setSubmittingRemark(true);
    try {
      const res = await fetch(`/api/records/${currentRecord.id}/remark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: remarkContent.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setRemarkContent('');
        await fetchRecords();
        const freshRes = await fetch(`/api/records/${currentRecord.id}`);
        const freshData = await freshRes.json();
        if (freshData.success) setCurrentRecord(freshData.data);
        const logsRes = await fetch(`/api/records/${currentRecord.id}/logs`);
        const logsData = await logsRes.json();
        if (logsData.success) setLogs(logsData.data);
      }
    } catch {}
    setSubmittingRemark(false);
  };

  return (
    <div className="fixed inset-0 z-40 overflow-hidden">
      <div className="absolute inset-0 bg-black/30" onClick={() => setDetailRecord(null)} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900">记录详情</h2>
          </div>
          <button onClick={() => setDetailRecord(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-gray-200 bg-gray-50 px-6">
          <div className="flex gap-6">
            {(['info', 'remarks', 'logs'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'border-b-2 px-1 py-3 text-sm font-medium',
                  activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                {tab === 'info' ? '基本信息' : tab === 'remarks' ? `人工备注 (${currentRecord.remarks?.length || 0})` : `操作日志 (${logs.length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-gray-500">机构代码</p><p className="font-medium text-gray-900">{currentRecord.institutionCode}</p></div>
                <div><p className="text-xs text-gray-500">当前机构简称</p><p className="font-medium text-gray-900">{currentRecord.institutionNameCurrent}</p></div>
                <div><p className="text-xs text-gray-500">原机构简称</p><p className="font-medium text-gray-900">{currentRecord.institutionNamePrev}</p></div>
                <div><p className="text-xs text-gray-500">简称一致</p><p className={cn('font-medium', currentRecord.nameConsistent ? 'text-green-600' : 'text-orange-600')}>{currentRecord.nameConsistent ? '是' : '否（已标记异常）'}</p></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><p className="text-xs text-gray-500">授信额度</p><p className="font-mono font-medium text-gray-900">{formatAmount(currentRecord.creditLine)}</p></div>
                <div><p className="text-xs text-gray-500">已占用</p><p className="font-mono font-medium text-gray-900">{formatAmount(currentRecord.occupiedAmount)}</p></div>
                <div><p className="text-xs text-gray-500">可用额度</p><p className="font-mono font-medium text-gray-900">{formatAmount(currentRecord.availableAmount)}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-gray-500">状态</p><span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', getStatusColor(currentRecord.status))}>{getStatusLabel(currentRecord.status)}</span></div>
                <div><p className="text-xs text-gray-500">导入时间</p><p className="text-sm text-gray-700">{currentRecord.importTime}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-gray-500">除权日</p><p className="text-sm text-gray-700">{currentRecord.custodianData.exDividendDate}</p></div>
                <div><p className="text-xs text-gray-500">配售比例</p><p className="text-sm text-gray-700">{currentRecord.custodianData.shareRatio}</p></div>
              </div>
              {currentRecord.custodianData.totalShares > 0 && (
                <div><p className="text-xs text-gray-500">总股数</p><p className="text-sm text-gray-700">{currentRecord.custodianData.totalShares.toLocaleString()}</p></div>
              )}
              {currentRecord.supplementFields && Object.keys(currentRecord.supplementFields).length > 0 && (
                <div>
                  <p className="text-xs text-gray-500">补录字段</p>
                  <div className="mt-1 rounded-lg bg-blue-50 p-3 text-sm">
                    {Object.entries(currentRecord.supplementFields).map(([k, v]) => (
                      <p key={k} className="text-blue-800"><span className="text-blue-500">{k}:</span> {String(v)}</p>
                    ))}
                  </div>
                </div>
              )}
              {currentRecord.conflictResolution && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="text-xs font-medium text-green-800">冲突处理结果</p>
                  <p className="mt-1 text-sm text-green-700">方式: {currentRecord.conflictResolution.resolution === 'confirm_custodian' ? '确认托管数据' : '驳回，以截图为准'}</p>
                  <p className="text-sm text-green-700">操作人: {currentRecord.conflictResolution.operator}</p>
                  <p className="text-sm text-green-700">备注: {currentRecord.conflictResolution.remark}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'remarks' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={remarkContent}
                  onChange={e => setRemarkContent(e.target.value)}
                  placeholder="输入人工备注..."
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  onKeyDown={e => { if (e.key === 'Enter') handleAddRemark(); }}
                />
                <button
                  onClick={handleAddRemark}
                  disabled={submittingRemark || !remarkContent.trim()}
                  className="flex items-center gap-1 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  添加
                </button>
              </div>
              {(!currentRecord.remarks || currentRecord.remarks.length === 0) ? (
                <div className="py-8 text-center text-gray-500">
                  <MessageSquare className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  <p className="text-sm">暂无备注</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentRecord.remarks.map((r: RemarkItem) => (
                    <div key={r.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <p className="text-sm text-gray-800">{r.content}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        <span>{r.operator} · {r.createTime}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-3">
              {logs.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  <Clock className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  <p className="text-sm">暂无操作日志</p>
                </div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800">{log.operationType}</span>
                      <span className="text-xs text-gray-400">{log.operationTime}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{log.remark || '-'}</p>
                    <p className="text-xs text-gray-400">操作人: {log.operator}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
