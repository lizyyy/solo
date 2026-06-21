import { Eye, ArrowUpDown } from 'lucide-react';
import { useReportStore } from '@/store/reportStore';
import { SourceBadge, SedimentLevelBadge, AnomalyBadge } from './Badges';
import { formatLatLng } from '@/utils/coordinate';
import { formatDepth } from '@/utils/sediment';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type { SedimentRecord } from '@/types';

type SortField = 'timestamp' | 'sedimentDepth' | 'id';
type SortOrder = 'asc' | 'desc';

export default function DataTable() {
  const { getFilteredRecords, getCurrentParams, getCurrentVersion } = useReportStore();
  const navigate = useNavigate();
  const records = getFilteredRecords();
  const params = getCurrentParams();
  const currentVersion = getCurrentVersion();

  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedRecords = [...records].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'timestamp':
        comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        break;
      case 'sedimentDepth':
        comparison = a.sedimentDepth - b.sedimentDepth;
        break;
      case 'id':
        comparison = a.id.localeCompare(b.id);
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const normalRecords = sortedRecords.filter((r) => r.isNormal);
  const anomalyRecords = sortedRecords.filter((r) => !r.isNormal);
  const cloudCoverRecords = anomalyRecords.filter((r) => r.anomalyType === 'cloudCover');
  const otherAnomalyRecords = anomalyRecords.filter((r) => r.anomalyType !== 'cloudCover');

  const SortHeader = ({
    field,
    label,
  }: {
    field: SortField;
    label: string;
  }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown
          size={12}
          className={sortField === field ? 'text-ocean-600' : 'text-gray-300'}
        />
      </div>
    </th>
  );

  const RecordRow = ({ record }: { record: SedimentRecord }) => (
    <tr
      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
        !record.isNormal ? 'bg-warning-50/30' : ''
      }`}
      onClick={() => navigate(`/record/${record.id}?version=${currentVersion?.id || 'v3'}`)}
    >
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="font-mono text-sm text-gray-700">{record.id}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm text-gray-600">{record.timestamp}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <SourceBadge source={record.source} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="text-sm font-mono text-gray-700">
          {formatLatLng(record.latitude, record.longitude, params?.coordinateFormat || 'decimal')}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          原始: {record.rawLatitude}, {record.rawLongitude}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm font-medium text-gray-700">
          {formatDepth(record.sedimentDepth, params?.depthUnit)}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <SedimentLevelBadge level={record.sedimentLevel} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {record.anomalyType !== 'none' ? (
          <AnomalyBadge type={record.anomalyType} />
        ) : (
          <span className="text-sm text-green-600">正常</span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="text-sm text-gray-600 max-w-xs truncate" title={record.remark}>
          {record.remark || '-'}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <button className="p-1.5 text-gray-400 hover:text-ocean-600 hover:bg-ocean-50 rounded transition-colors">
          <Eye size={16} />
        </button>
      </td>
    </tr>
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortHeader field="id" label="记录ID" />
              <SortHeader field="timestamp" label="时间" />
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                来源
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                经纬度
              </th>
              <SortHeader field="sedimentDepth" label="淤积深度" />
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                淤积等级
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                备注
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {normalRecords.length > 0 && (
              <>
                <tr className="bg-green-50/50">
                  <td colSpan={9} className="px-4 py-2">
                    <span className="text-sm font-medium text-green-700">
                      正常记录 ({normalRecords.length}条)
                    </span>
                  </td>
                </tr>
                {normalRecords.map((record) => (
                  <RecordRow key={record.id} record={record} />
                ))}
              </>
            )}

            {cloudCoverRecords.length > 0 && (
              <>
                <tr className="bg-gray-100/70">
                  <td colSpan={9} className="px-4 py-2">
                    <span className="text-sm font-medium text-gray-600">
                      云遮挡记录 ({cloudCoverRecords.length}条) — 数据质量不可靠，已单独列出
                    </span>
                  </td>
                </tr>
                {cloudCoverRecords.map((record) => (
                  <RecordRow key={record.id} record={record} />
                ))}
              </>
            )}

            {otherAnomalyRecords.length > 0 && (
              <>
                <tr className="bg-yellow-50/70">
                  <td colSpan={9} className="px-4 py-2">
                    <span className="text-sm font-medium text-yellow-700">
                      其他异常 ({otherAnomalyRecords.length}条)
                    </span>
                  </td>
                </tr>
                {otherAnomalyRecords.map((record) => (
                  <RecordRow key={record.id} record={record} />
                ))}
              </>
            )}

            {sortedRecords.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                  暂无符合条件的记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
