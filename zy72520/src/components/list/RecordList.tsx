import { useReviewStore } from '../../store/useReviewStore';
import RecordCard from './RecordCard';
import { Inbox } from 'lucide-react';

const RecordList = () => {
  const getFilteredRecords = useReviewStore(state => state.getFilteredRecords);
  const records = getFilteredRecords();

  if (records.length === 0) {
    return (
      <div className="card text-center py-16">
        <Inbox className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-500 mb-2">暂无符合条件的记录</h3>
        <p className="text-sm text-gray-400">请尝试调整筛选条件或搜索关键词</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {records.map((record, index) => (
        <RecordCard key={record.id} record={record} index={index} />
      ))}
    </div>
  );
};

export default RecordList;
