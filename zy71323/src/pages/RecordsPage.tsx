import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useRecordStore } from '@/store/useRecordStore';
import { useEstimationStore } from '@/store/useEstimationStore';
import { RecordList } from '@/components/records/RecordList';
import { RecordDetail } from '@/components/records/RecordDetail';
import type { EstimationRecord } from '@/types';

export default function RecordsPage() {
  const navigate = useNavigate();
  const { loadRecords, records, isLoading, comparisonScenarios } = useRecordStore();
  const { loadRecord } = useEstimationStore();
  const [selectedRecord, setSelectedRecord] = useState<EstimationRecord | null>(null);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleViewRecord = (record: EstimationRecord) => {
    setSelectedRecord(record);
  };

  const handleContinue = async (id: string) => {
    await loadRecord(id, true);
    navigate('/');
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-display font-bold gradient-text mb-2">
            历史记录
          </h2>
          <p className="text-gray-400 text-sm">
            共 {records.length} 条记录 | 可复算ID确保相同参数产生相同结果
          </p>
        </div>

        <button
          onClick={() => navigate('/')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          新建估算
        </button>
      </div>

      {comparisonScenarios.length > 0 && (
        <div className="mb-6 p-4 bg-tech-500/10 border border-tech-500/30 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {comparisonScenarios.map((scenario, index) => (
                <div
                  key={scenario.id}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-ocean-800"
                  style={{ backgroundColor: scenario.color }}
                >
                  {index + 1}
                </div>
              ))}
            </div>
            <span className="text-sm text-gray-300">
              已添加 {comparisonScenarios.length} 个情景到对比
            </span>
          </div>
          <button
            onClick={() => navigate('/compare')}
            className="text-sm text-tech-400 hover:text-tech-300 flex items-center gap-1"
          >
            前往对比 →
          </button>
        </div>
      )}

      <RecordList
        onViewRecord={handleViewRecord}
        onContinueRecord={handleContinue}
      />

      {selectedRecord && (
        <RecordDetail
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </div>
  );
}
