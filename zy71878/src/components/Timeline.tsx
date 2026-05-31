import { useRecordsStore } from '../store/useRecordsStore';
import { RecordCard } from './RecordCard';
import { formatDate } from '../utils/format';

export const Timeline = () => {
  const { getFilteredRecords, selectedRecordId, selectRecord } = useRecordsStore();
  const records = getFilteredRecords();

  const groupedByDate = records.reduce((acc, record) => {
    const date = formatDate(record.timestamp);
    if (!acc.has(date)) {
      acc.set(date, []);
    }
    acc.get(date)!.push(record);
    return acc;
  }, new Map<string, typeof records>());

  if (records.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <p className="text-lg mb-2">暂无记录</p>
          <p className="text-sm">请导入数据包或重置数据</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-2xl mx-auto relative">
        <div className="timeline-line" />
        
        {Array.from(groupedByDate.entries()).map(([date, dayRecords]) => (
          <div key={date} className="mb-6">
            <div className="flex items-center gap-3 mb-4 ml-8">
              <div className="h-px flex-1 bg-slate-700" />
              <span className="text-xs font-mono text-slate-500 bg-slate-900 px-3 py-1 rounded">
                {date}
              </span>
              <div className="h-px flex-1 bg-slate-700" />
            </div>
            
            {dayRecords.map((record) => (
              <RecordCard
                key={record.id}
                record={record}
                isSelected={selectedRecordId === record.id}
                onClick={() => selectRecord(
                  selectedRecordId === record.id ? null : record.id
                )}
              />
            ))}
          </div>
        ))}

        <div className="h-12" />
      </div>
    </div>
  );
};
