import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getAllWeekKeys, formatWeekDisplay, generateWeekTitle } from '@/utils/dateUtils';
import { getWeekKey } from '@/utils/dateUtils';

interface WeekSelectorProps {
  onWeekChange?: (weekKey: string) => void;
}

export function WeekSelector({ onWeekChange }: WeekSelectorProps) {
  const { currentRecordId, records, setCurrentRecord, createNewWeek, loadSampleData } = useAppStore();
  const weekKeys = getAllWeekKeys(8);
  const currentWeekKey = getWeekKey();

  const currentRecord = records.find(r => r.id === currentRecordId);

  const handleWeekClick = (weekKey: string) => {
    const existingRecord = records.find(r => r.weekKey === weekKey);
    
    if (existingRecord) {
      setCurrentRecord(existingRecord.id);
    } else {
      const newRecord = createNewWeek(weekKey, '老许');
      setCurrentRecord(newRecord.id);
    }
    
    onWeekChange?.(weekKey);
  };

  const handleLoadSample = () => {
    loadSampleData();
  };

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-studio-amber" />
          <span className="font-medium text-studio-text">选择周次</span>
        </div>
        
        {records.length === 0 && (
          <button
            onClick={handleLoadSample}
            className="text-xs text-studio-amber hover:underline"
          >
            加载小样例数据试试 →
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-2">
        {weekKeys.map((weekKey) => {
          const hasData = records.some(r => r.weekKey === weekKey);
          const isActive = currentRecord?.weekKey === weekKey;
          const isCurrentWeek = weekKey === currentWeekKey;
          
          return (
            <button
              key={weekKey}
              onClick={() => handleWeekClick(weekKey)}
              className={`
                shrink-0 px-4 py-2.5 rounded-lg text-sm transition-all duration-200
                flex flex-col items-center gap-0.5 min-w-[100px]
                ${isActive
                  ? 'bg-studio-amber text-studio-bg font-medium shadow-md'
                  : hasData
                    ? 'bg-studio-amber/10 text-studio-amber hover:bg-studio-amber/20 border border-studio-amber/30'
                    : 'bg-gray-100 text-studio-textMuted hover:bg-gray-200'
                }
              `}
            >
              <span className="text-xs font-mono opacity-75">
                {weekKey.replace('-W', ' 第')}周
              </span>
              <span className="text-xs whitespace-nowrap">
                {formatWeekDisplay(weekKey)}
              </span>
              {isCurrentWeek && !isActive && (
                <span className="text-[10px] opacity-60">本周</span>
              )}
              {hasData && !isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-studio-amber mt-1" />
              )}
            </button>
          );
        })}
      </div>

      {currentRecord && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="font-serif text-lg font-bold text-studio-text">
            {currentRecord.title}
          </p>
          <p className="text-sm text-studio-textMuted mt-1">
            操作人：{currentRecord.operator} · 
            状态：{currentRecord.status === 'draft' ? '编辑中' : '已定稿'}
          </p>
        </div>
      )}
    </div>
  );
}
