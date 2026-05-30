import { FilterBar } from '../components/records/FilterBar';
import { DataTable } from '../components/records/DataTable';

export function ValuationRecords() {
  return (
    <div className="flex flex-col h-[calc(100vh-65px)] overflow-hidden">
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-slate-800">估值明细</h2>
            <p className="text-sm text-slate-500 mt-1">查看和管理所有估值记录，支持多维度筛选</p>
          </div>
        </div>
      </div>
      
      <FilterBar />
      
      <div className="flex-1 overflow-auto p-6 pt-4">
        <DataTable />
      </div>
    </div>
  );
}
