import { useState } from 'react';
import { X, AlertTriangle, CheckCircle, FileText, Image } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import { cn } from '@/lib/utils';

export function ConflictDrawer() {
  const { selectedRecord, showConflictDrawer, setShowConflictDrawer, resolveConflict, fetchRecords } = useDashboardStore();
  const [remark, setRemark] = useState('');
  const [resolving, setResolving] = useState(false);

  if (!selectedRecord || !showConflictDrawer) return null;

  const handleResolve = async (resolution: 'confirm_custodian' | 'reject_use_screenshot') => {
    if (!selectedRecord) return;
    setResolving(true);
    const success = await resolveConflict(selectedRecord.id, resolution, remark);
    if (success) {
      await fetchRecords();
      setShowConflictDrawer(false);
      setRemark('');
    }
    setResolving(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div 
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={() => setShowConflictDrawer(false)}
      />
      
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-900">数据冲突处理</h2>
          </div>
          <button
            onClick={() => setShowConflictDrawer(false)}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="mb-6 flex items-center justify-between rounded-lg bg-gray-50 p-4">
            <div>
              <p className="text-sm text-gray-500">机构名称</p>
              <p className="font-medium text-gray-900">
                {selectedRecord.institutionNameCurrent}
                <span className="ml-2 text-xs text-gray-400">
                  {selectedRecord.institutionCode}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">冲突字段数</p>
              <p className="font-mono text-lg font-bold text-red-600">
                {selectedRecord.conflictFields?.length || 0}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="mb-4 flex items-center gap-2 font-medium text-gray-900">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              冲突证据对比
            </h3>
            
            <div className="space-y-4">
              {selectedRecord.conflictEvidence?.map((evidence, idx) => (
                <div key={idx} className="overflow-hidden rounded-lg border border-gray-200">
                  <div className="bg-gray-50 px-4 py-2">
                    <p className="font-medium text-gray-900">{evidence.fieldLabel}</p>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-gray-200">
                    <div className={cn(
                      'p-4',
                      selectedRecord.conflictResolution?.resolution === 'confirm_custodian'
                        ? 'bg-green-50'
                        : selectedRecord.conflictResolution?.resolution === 'reject_use_screenshot'
                        ? 'bg-red-50'
                        : ''
                    )}>
                      <div className="mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium text-gray-600">托管确认页</span>
                        {selectedRecord.conflictResolution?.resolution === 'confirm_custodian' && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <p className="font-mono text-lg font-bold text-gray-900">
                        {evidence.custodianValue}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        来源: {evidence.custodianSource}
                      </p>
                    </div>
                    <div className={cn(
                      'p-4',
                      selectedRecord.conflictResolution?.resolution === 'reject_use_screenshot'
                        ? 'bg-green-50'
                        : selectedRecord.conflictResolution?.resolution === 'confirm_custodian'
                        ? 'bg-red-50'
                        : ''
                    )}>
                      <div className="mb-2 flex items-center gap-2">
                        <Image className="h-4 w-4 text-purple-500" />
                        <span className="text-sm font-medium text-gray-600">除权日截图</span>
                        {selectedRecord.conflictResolution?.resolution === 'reject_use_screenshot' && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <p className="font-mono text-lg font-bold text-gray-900">
                        {evidence.screenshotValue}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        来源: {evidence.screenshotSource}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedRecord.conflictResolution ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="font-medium text-green-800">已处理</span>
              </div>
              <p className="mt-2 text-sm text-green-700">
                处理方式: {selectedRecord.conflictResolution.resolution === 'confirm_custodian' 
                  ? '确认托管数据' 
                  : '驳回，以截图为准'}
              </p>
              <p className="text-sm text-green-700">
                操作人: {selectedRecord.conflictResolution.operator}
              </p>
              <p className="text-sm text-green-700">
                备注: {selectedRecord.conflictResolution.remark}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">处理备注</label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="请输入处理备注..."
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => handleResolve('confirm_custodian')}
                  disabled={resolving}
                  className="flex-1 rounded-lg border-2 border-red-500 bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                >
                  ✓ 确认托管数据
                </button>
                <button
                  onClick={() => handleResolve('reject_use_screenshot')}
                  disabled={resolving}
                  className="flex-1 rounded-lg border-2 border-blue-500 bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
                >
                  ✗ 驳回，以截图为准
                </button>
              </div>
              
              <p className="text-center text-xs text-gray-400">
                系统不会自动决策，请根据实际情况选择处理方式
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
