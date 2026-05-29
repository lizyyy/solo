import { useState, useEffect } from 'react';
import { useRecordStore } from '@/store/useRecordStore';
import { ExceptionPanel } from '@/components/ExceptionPanel';
import { RecordDetail } from '@/components/RecordDetail';
import { ArrowLeft, AlertTriangle, Disc } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { InventoryRecord } from '@/types';

export function Exceptions() {
  const navigate = useNavigate();
  const [viewingRecord, setViewingRecord] = useState<InventoryRecord | undefined>();

  useEffect(() => {
    useRecordStore.getState().loadFromStorage();
  }, []);

  const unresolvedCount = useRecordStore
    .getState()
    .getUnresolvedExceptions().length;

  const handleViewRecord = (recordId: string) => {
    const record = useRecordStore.getState().getRecordById(recordId);
    if (record) {
      setViewingRecord(record);
    }
  };

  return (
    <div className="min-h-screen bg-cream-100">
      <header className="bg-vinyl-700 text-white shadow-vinyl-lg sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                className="p-2 hover:bg-white/10 rounded-sm transition-colors -ml-2"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <Disc className="w-8 h-8 text-caramel-400" />
                <div>
                  <h1 className="font-display text-xl font-bold">异常清单</h1>
                  <p className="text-white/70 text-xs">
                    {unresolvedCount} 条待处理异常
                  </p>
                </div>
              </div>
            </div>
            {unresolvedCount > 0 && (
              <div className="flex items-center gap-2 bg-alert-500/20 px-3 py-1.5 rounded-sm">
                <AlertTriangle className="w-4 h-4 text-alert-500" />
                <span className="text-sm text-alert-500 font-medium">
                  需要及时处理
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="mb-4">
          <p className="text-vinyl-600 text-sm">
            系统自动检测以下类型的异常：字段缺失、重复版号、状态异常、价格异常。
            请及时处理后标记已解决。
          </p>
        </div>
        <ExceptionPanel onViewRecord={handleViewRecord} />
      </main>

      {viewingRecord && (
        <RecordDetail
          record={viewingRecord}
          onClose={() => setViewingRecord(undefined)}
          onEdit={() => {}}
        />
      )}
    </div>
  );
}
