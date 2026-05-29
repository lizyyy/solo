import { ShotCard } from './ShotCard';
import { useShotStore } from '@/store/useShotStore';
import { Film } from 'lucide-react';
import { useMemo } from 'react';

export function ShotList() {
  const shots = useShotStore((state) => state.shots);
  const filters = useShotStore((state) => state.filters);
  const getFilteredShots = useShotStore((state) => state.getFilteredShots);

  const filteredShots = useMemo(() => {
    return getFilteredShots();
  }, [shots, filters, getFilteredShots]);

  if (filteredShots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-film-card rounded-full flex items-center justify-center mb-4">
          <Film className="w-10 h-10 text-film-text-muted" />
        </div>
        <h3 className="text-lg font-semibold text-film-text-primary mb-2">暂无镜头</h3>
        <p className="text-film-text-muted max-w-md">
          点击右上角"新建镜头"按钮创建第一个分镜，或点击"加载示例数据"查看演示。
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-film-text-secondary">
          共 <span className="text-film-primary font-semibold">{filteredShots.length}</span> 个镜头
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredShots.map((shot) => (
          <ShotCard key={shot.id} shot={shot} />
        ))}
      </div>
    </div>
  );
}
