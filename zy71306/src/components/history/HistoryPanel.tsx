import { useCalibrationStore } from '../../store/calibrationStore';
import { Card } from '../common/Card';
import RecordCard from './RecordCard';
import { History } from 'lucide-react';
import { Button } from '../common/Button';
import { useNavigate } from 'react-router-dom';

export default function HistoryPanel() {
  const { records, selectedRecords, generateCalibrationReport, clearSelectedRecords } =
    useCalibrationStore();
  const navigate = useNavigate();

  const handleGenerateReport = () => {
    if (selectedRecords.length > 0) {
      generateCalibrationReport(selectedRecords);
      navigate('/report');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card
        title={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <History size={18} className="text-brass-400" />
              <span>校准记录</span>
              <span className="text-xs text-walnut-400">({records.length})</span>
            </div>
            {selectedRecords.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-brass-400">已选 {selectedRecords.length} 条</span>
                <Button size="sm" onClick={clearSelectedRecords} variant="secondary">
                  清除
                </Button>
                <Button size="sm" onClick={handleGenerateReport}>
                  生成报告
                </Button>
              </div>
            )}
          </div>
        }
      >
        {records.length === 0 ? (
          <div className="text-center py-12 text-walnut-400">
            <History size={48} className="mx-auto mb-4 opacity-30" />
            <p>暂无校准记录</p>
            <p className="text-sm mt-2">调整参数后点击"保存记录"</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {records.map((record) => (
              <RecordCard
                key={record.id}
                record={record}
                isSelected={selectedRecords.includes(record.id)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
