import { useRecordStore } from '../../store/useRecordStore';
import { TimelineItem } from './TimelineItem';

export function Timeline() {
  const { getFilteredRecords, selectedRecordId, setSelectedRecordId } = useRecordStore();
  const records = getFilteredRecords();

  return (
    <div className="py-2">
      {records.map((record) => (
        <TimelineItem
          key={record.id}
          record={record}
          isSelected={selectedRecordId === record.id}
          onClick={() => setSelectedRecordId(record.id)}
        />
      ))}
    </div>
  );
}
