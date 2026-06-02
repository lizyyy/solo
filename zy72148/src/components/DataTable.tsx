import { useState, useMemo } from 'react';
import { Eye, Tag } from 'lucide-react';
import type { RoomAllocation, DataQualityIssue } from '@/types';
import { PERSON_TYPE_LABELS, STATUS_LABELS } from '@/types';
import { useAllocationStore } from '@/store/useAllocationStore';
import { RemarksCell } from './RemarksCell';
import { QualityBadge, getRowQualityClass } from './QualityBadge';
import { Pagination } from './Pagination';

interface DataTableProps {
  records: RoomAllocation[];
  onViewSource: (recordId: string) => void;
}

const statusColors = {
  confirmed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  issue: 'bg-red-100 text-red-700',
};

const personTypeColors = {
  artist: 'bg-purple-100 text-purple-700',
  staff: 'bg-blue-100 text-blue-700',
  guest: 'bg-pink-100 text-pink-700',
};

const tagOptions = ['已确认', '待核对', '有问题', '优先处理'];

export const DataTable = ({ records, onViewSource }: DataTableProps) => {
  const currentPage = useAllocationStore(state => state.currentPage);
  const pageSize = useAllocationStore(state => state.pageSize);
  const setCurrentPage = useAllocationStore(state => state.setCurrentPage);
  const updateRemarks = useAllocationStore(state => state.updateRemarks);
  const updateStatus = useAllocationStore(state => state.updateStatus);
  const updateManualTag = useAllocationStore(state => state.updateManualTag);
  const selectedRecords = useAllocationStore(state => state.selectedRecords);
  const toggleSelectRecord = useAllocationStore(state => state.toggleSelectRecord);
  const qualityIssues = useAllocationStore(state => state.qualityIssues);

  const [tagMenuOpen, setTagMenuOpen] = useState<string | null>(null);

  const totalPages = Math.ceil(records.length / pageSize);
  const paginatedRecords = records.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const qualityMap = useMemo(() => {
    const map = new Map<string, DataQualityIssue[]>();
    qualityIssues.forEach(issue => {
      if (!map.has(issue.recordId)) {
        map.set(issue.recordId, []);
      }
      map.get(issue.recordId)!.push(issue);
    });
    return map;
  }, [qualityIssues]);

  const handleStatusChange = (id: string, status: RoomAllocation['status']) => {
    updateStatus(id, status);
  };

  const handleTagSelect = (recordId: string, tag: string) => {
    updateManualTag(recordId, tag);
    setTagMenuOpen(null);
  };

  const handleSelectAll = () => {
    const allSelected = paginatedRecords.every(r => selectedRecords.includes(r.id));
    paginatedRecords.forEach(r => {
      if (allSelected && selectedRecords.includes(r.id)) {
        toggleSelectRecord(r.id);
      } else if (!allSelected && !selectedRecords.includes(r.id)) {
        toggleSelectRecord(r.id);
      }
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={paginatedRecords.length > 0 && paginatedRecords.every(r => selectedRecords.includes(r.id))}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">巡演</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">酒店</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">房型</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">入住人</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">类型</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">入住</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">退房</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">备注</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">质量</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-6 py-12 text-center text-gray-400">
                  暂无数据，点击"导入数据"开始吧
                </td>
              </tr>
            ) : (
              paginatedRecords.map((record, index) => {
                const recordQuality = qualityMap.get(record.id) || [];
                const rowClass = getRowQualityClass(recordQuality);
                const isSelected = selectedRecords.includes(record.id);

                return (
                  <tr
                    key={record.id}
                    className={`hover:bg-gray-50 transition-colors ${rowClass} ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    } ${isSelected ? 'bg-primary-50' : ''}`}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRecord(record.id)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900">{record.tourName}</td>
                    <td className="px-3 py-3 text-sm text-gray-900">{record.hotelName}</td>
                    <td className="px-3 py-3 text-sm text-gray-900">{record.roomType}</td>
                    <td className="px-3 py-3 text-sm text-gray-900">
                      {record.personName || (
                        <span className="text-gray-400 italic">未填写</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`badge ${personTypeColors[record.personType]}`}>
                        {PERSON_TYPE_LABELS[record.personType]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">{record.checkInDate}</td>
                    <td className="px-3 py-3 text-sm text-gray-600">{record.checkOutDate}</td>
                    <td className="px-3 py-3">
                      <select
                        value={record.status}
                        onChange={(e) => handleStatusChange(record.id, e.target.value as RoomAllocation['status'])}
                        className={`badge border-0 cursor-pointer ${statusColors[record.status]}`}
                      >
                        <option value="pending">{STATUS_LABELS.pending}</option>
                        <option value="confirmed">{STATUS_LABELS.confirmed}</option>
                        <option value="issue">{STATUS_LABELS.issue}</option>
                      </select>
                    </td>
                    <td className="px-3 py-3 min-w-[200px]">
                      <RemarksCell
                        value={record.remarks}
                        onSave={(value) => updateRemarks(record.id, value)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <QualityBadge issues={recordQuality} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {record.manualTag && (
                          <span className="badge bg-accent-100 text-accent-700">
                            {record.manualTag}
                          </span>
                        )}
                        <div className="relative">
                          <button
                            onClick={() => setTagMenuOpen(tagMenuOpen === record.id ? null : record.id)}
                            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                            title="添加标记"
                          >
                            <Tag className="w-4 h-4 text-gray-400 hover:text-accent-500" />
                          </button>
                          {tagMenuOpen === record.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-10 min-w-[120px]">
                              {tagOptions.map(tag => (
                                <button
                                  key={tag}
                                  onClick={() => handleTagSelect(record.id, tag)}
                                  className={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${
                                    record.manualTag === tag ? 'text-primary-600 font-medium' : 'text-gray-700'
                                  }`}
                                >
                                  {tag}
                                </button>
                              ))}
                              <button
                                onClick={() => handleTagSelect(record.id, '')}
                                className="w-full px-3 py-1.5 text-left text-sm text-gray-400 hover:bg-gray-50"
                              >
                                清除标记
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => onViewSource(record.id)}
                          className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                          title="查看来源"
                        >
                          <Eye className="w-4 h-4 text-gray-400 hover:text-primary-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalItems={records.length}
        pageSize={pageSize}
      />
    </div>
  );
};
