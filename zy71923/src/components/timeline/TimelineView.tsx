import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import TimelineAxis from './TimelineAxis';
import TimelineCard from './TimelineCard';

export default function TimelineView() {
  const { timelineRecords, getArtworkById } = useApp();

  const sortedRecords = useMemo(() => {
    return [...timelineRecords].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [timelineRecords]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, typeof sortedRecords> = {};
    sortedRecords.forEach((record) => {
      const date = new Date(record.timestamp);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(record);
    });
    return groups;
  }, [sortedRecords]);

  const dateLabels: Record<string, string> = {
    lighting: '灯光记录',
    note: '策展备注',
    inventory: '作品清单',
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="font-display text-3xl text-gray-900 mb-2">布展时间线</h2>
        <p className="font-body text-gray-600 text-sm">
          按时间顺序整合灯光记录、策展备注和作品清单，清晰呈现数据先后关系和变更历史
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        {Object.entries(dateLabels).map(([key, label]) => (
          <div key={key} className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                key === 'lighting'
                  ? 'bg-orange-600'
                  : key === 'note'
                  ? 'bg-blue-700'
                  : 'bg-green-700'
              }`}
            />
            <span className="font-body text-sm text-gray-600">{label}</span>
          </div>
        ))}
      </div>

      <div className="relative">
        <TimelineAxis />
        <div className="ml-4">
          {Object.entries(groupedByDate).map(([date, records]) => (
            <div key={date} className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="font-mono text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded">
                  {date}
                </span>
                <span className="font-body text-xs text-gray-400">
                  {records.length} 条记录
                </span>
              </div>
              {records.map((record, index) => (
                <TimelineCard
                  key={record.id}
                  record={record}
                  artwork={getArtworkById(record.artworkId)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
