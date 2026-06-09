import { HandoverCards } from '../components/HandoverCards';
import { FilterBar } from '../components/FilterBar';
import { StatisticsCards } from '../components/StatisticsCards';
import { WorkOrderTable } from '../components/WorkOrderTable';
import { AbnormalQueue } from '../components/AbnormalQueue';
import { OrderDetailDrawer } from '../components/OrderDetailDrawer';
import { useWorkOrderStore } from '../store/workOrderStore';

export default function ReplayDashboard() {
  const { showHandoverGuide, toggleHandoverGuide } = useWorkOrderStore();

  return (
    <div className="min-h-screen bg-slate-100">
      {showHandoverGuide && (
        <HandoverCards asOverlay onClose={() => toggleHandoverGuide(false)} />
      )}
      <OrderDetailDrawer />

      <div className="max-w-[1800px] mx-auto px-4 md:px-6 py-5 space-y-4">
        <FilterBar />
        <StatisticsCards />
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <div className="xl:col-span-3">
            <WorkOrderTable />
          </div>
          <div className="xl:col-span-1">
            <AbnormalQueue />
          </div>
        </div>
      </div>
    </div>
  );
}
