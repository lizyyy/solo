import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useEffect } from 'react';
import { useThresholdStore } from '@/store/useThresholdStore';
import { useEquipmentStore } from '@/store/useEquipmentStore';
import { useRecordStore } from '@/store/useRecordStore';
import { useReviewStore } from '@/store/useReviewStore';

export function MainLayout() {
  const initThresholds = useThresholdStore(state => state.init);
  const initEquipment = useEquipmentStore(state => state.init);
  const initRecords = useRecordStore(state => state.init);
  const initReviews = useReviewStore(state => state.init);

  useEffect(() => {
    initThresholds();
    initEquipment();
    initRecords();
    initReviews();
  }, [initThresholds, initEquipment, initRecords, initReviews]);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
