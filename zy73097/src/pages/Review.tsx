import { FilterPanel } from '../components/FilterPanel';
import { StatsCards } from '../components/StatsCards';
import { ReviewBoard } from '../components/ReviewBoard';
import { DetailDrawer } from '../components/DetailDrawer';

export default function Review() {
  return (
    <div className="flex-1 flex min-h-0">
      <div className="flex-1 min-w-0 flex flex-col gap-4 p-4 overflow-y-auto">
        <FilterPanel />
        <StatsCards />
        <ReviewBoard />
      </div>
      <DetailDrawer />
    </div>
  );
}
