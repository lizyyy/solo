import { useTrackStore } from '../store/useTrackStore';
import TrackRow from './TrackRow';
import { Inbox, Filter } from 'lucide-react';

export default function TrackTable() {
  const getFilteredRecords = useTrackStore((state) => state.getFilteredRecords);
  const filters = useTrackStore((state) => state.filters);
  const records = useTrackStore((state) => state.records);
  const filteredRecords = getFilteredRecords();

  const hasActiveFilters = filters.teacherName || filters.trackName || filters.dateFrom || filters.dateTo || filters.status !== 'all';

  if (records.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <Inbox size={64} className="mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-700 mb-2">暂无数据</h3>
        <p className="text-slate-500 text-sm">请上传Excel文件开始核销，或点击"加载样例数据"查看演示</p>
      </div>
    );
  }

  if (filteredRecords.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <Filter size={64} className="mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-700 mb-2">没有匹配的结果</h3>
        <p className="text-slate-500 text-sm">当前筛选条件下没有找到数据，请调整筛选条件</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {hasActiveFilters && (
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
          <p className="text-sm text-blue-700">
            当前筛选结果：<span className="font-semibold">{filteredRecords.length}</span> 条
            <span className="text-blue-500 ml-2">(共 {records.length} 条)</span>
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-20">
                #
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                教师姓名
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                曲目名称
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                授权日期
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                时码
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                课时
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                校验状态
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                备注
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRecords.map((record, index) => (
              <TrackRow key={record.id} record={record} index={index} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
