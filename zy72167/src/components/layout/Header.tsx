import { useCarbonStore } from '@/store/carbonStore';
import { Save, RotateCcw, Clock } from 'lucide-react';

export default function Header({ title }: { title: string }) {
  const { lastSaved, resetData } = useCarbonStore();

  const handleReset = () => {
    if (window.confirm('确定要重置所有数据吗？这将恢复到初始样例数据状态。')) {
      resetData();
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <h2 className="font-serif text-xl font-semibold text-gray-800">{title}</h2>
      </div>

      <div className="flex items-center gap-4">
        {lastSaved && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            <span>
              上次保存: {new Date(lastSaved).toLocaleString('zh-CN')}
            </span>
            <Save className="w-4 h-4 text-green-600" />
          </div>
        )}
        
        <button
          onClick={handleReset}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          重置数据
        </button>
      </div>
    </header>
  );
}
