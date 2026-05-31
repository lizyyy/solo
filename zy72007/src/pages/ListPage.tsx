import { useEffect } from 'react';
import { useRecordStore } from '../store/recordStore';
import { RecordStatus } from '../types';
import StatCard from '../components/record/StatCard';
import FilterBar from '../components/record/FilterBar';
import RecordList from '../components/record/RecordList';

export default function ListPage() {
  const { loadRecords, records } = useRecordStore();

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const confirmedRecords = records.filter(r => r.status === RecordStatus.CONFIRMED);
  const pendingRecords = records.filter(r => r.status === RecordStatus.PENDING_MATERIAL);
  const adjustedRecords = records.filter(r => r.status === RecordStatus.MANUAL_ADJUSTED);

  const confirmedAmount = confirmedRecords.reduce((sum, r) => sum + r.amount, 0);
  const pendingAmount = pendingRecords.reduce((sum, r) => sum + r.amount, 0);
  const adjustedAmount = adjustedRecords.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">回访记录列表</h2>
        <p className="text-gray-600">管理私募投资者回访材料，进行对账留痕</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="已确认"
          count={confirmedRecords.length}
          amount={confirmedAmount}
          status={RecordStatus.CONFIRMED}
          color="green"
        />
        <StatCard
          title="待补材料"
          count={pendingRecords.length}
          amount={pendingAmount}
          status={RecordStatus.PENDING_MATERIAL}
          color="amber"
        />
        <StatCard
          title="人工改判"
          count={adjustedRecords.length}
          amount={adjustedAmount}
          status={RecordStatus.MANUAL_ADJUSTED}
          color="red"
        />
      </div>

      <FilterBar />
      <RecordList />
    </div>
  );
}
