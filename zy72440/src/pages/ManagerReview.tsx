import { useState } from 'react';
import { AlertTriangle, CheckCircle, MapPin, User } from 'lucide-react';
import { useInventoryStore } from '@/store/inventoryStore';
import { RecordCard } from '@/components/common/RecordCard';
import type { InventoryRecord } from '@/types';

export function ManagerReview() {
  const { getPendingReviewRecords, managerReview } = useInventoryStore();
  const pendingRecords = getPendingReviewRecords();
  const [selectedRecord, setSelectedRecord] = useState<InventoryRecord | null>(null);

  const handleReview = (record: InventoryRecord) => {
    setSelectedRecord(record);
  };

  const handleConfirm = () => {
    if (selectedRecord) {
      const missingCity = selectedRecord.authorizedRegions.find(r => r.isMissing)?.city;
      if (missingCity) {
        managerReview(selectedRecord.id, missingCity);
        setSelectedRecord(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center text-white flex-shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-amber-800 mb-1">店长复核队列</h3>
            <p className="text-amber-700 text-sm">
              以下记录的授权地区信息不完整，需要您复核确认并补充缺失的地区信息后，流程才能继续。
            </p>
            <p className="text-amber-600 text-sm mt-2 font-medium">
              待处理：{pendingRecords.length} 条
            </p>
          </div>
        </div>
      </div>

      {pendingRecords.length > 0 ? (
        <div className="space-y-4">
          {pendingRecords.map(record => {
            const missingCities = record.authorizedRegions.filter(r => r.isMissing).map(r => r.city);
            const isSelected = selectedRecord?.id === record.id;
            
            return (
              <div key={record.id} className={`bg-white rounded-xl border ${isSelected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'} overflow-hidden shadow-sm`}>
                <div className="p-6">
                  <RecordCard record={record} />
                </div>
                <div className="px-6 pb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <MapPin className="w-4 h-4 text-amber-500" />
                      <span>缺失地区：</span>
                      <span className="font-medium text-amber-700">{missingCities.join('、')}</span>
                    </div>
                    <button
                      onClick={() => handleReview(record)}
                      className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors flex items-center gap-2"
                    >
                      <User className="w-4 h-4" />
                      复核补充
                    </button>
                  </div>
                </div>

                {isSelected && (
                  <div className="bg-blue-50 border-t border-blue-100 p-6">
                    <h4 className="font-medium text-slate-800 mb-4">确认补充以下地区？</h4>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {missingCities.map(city => (
                        <span key={city} className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium">
                          ✓ {city}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-slate-600 mb-4">
                      补充后，该记录将从"待店长复核"转为"正常"状态，流程可继续下一步。
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setSelectedRecord(null)}
                        className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleConfirm}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        确认补充
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-medium text-slate-700 mb-2">暂无待复核记录</h3>
          <p className="text-slate-500">所有记录的授权地区信息都已完整，无需复核</p>
        </div>
      )}
    </div>
  );
}
