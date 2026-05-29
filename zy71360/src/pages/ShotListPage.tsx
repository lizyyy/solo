import { ShotFilters } from '@/components/shot/ShotFilters';
import { ShotList } from '@/components/shot/ShotList';
import { FilmBorder } from '@/components/common/FilmBorder';

export function ShotListPage() {
  return (
    <div>
      <FilmBorder>
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-film-text-primary">镜头索引</h2>
              <p className="text-sm text-film-text-secondary mt-1">
                管理所有分镜镜头，支持按场景、状态、人员筛选
              </p>
            </div>
          </div>
        </div>
      </FilmBorder>
      <ShotFilters />
      <ShotList />
    </div>
  );
}
