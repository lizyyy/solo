import { Search, Download } from 'lucide-react';
import { RecordStatus, StatusFilter } from '../../types';
import { exportToExcel } from '../../utils/exportUtil';
import { useRecordStore } from '../../store/recordStore';

const filterOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: RecordStatus.CONFIRMED, label: '已确认' },
  { value: RecordStatus.PENDING_MATERIAL, label: '待补材料' },
  { value: RecordStatus.MANUAL_ADJUSTED, label: '人工改判' },
];

export default function FilterBar() {
  const { statusFilter, setStatusFilter, searchQuery, setSearchQuery, getFilteredRecords } = useRecordStore();

  const handleExport = () => {
    const records = getFilteredRecords();
    exportToExcel(records);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索投资者姓名或金额..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setStatusFilter(option.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === option.value
                    ? 'bg-primary-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-700 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
        >
          <Download className="w-4 h-4" />
          <span>导出Excel</span>
        </button>
      </div>
    </div>
  );
}
