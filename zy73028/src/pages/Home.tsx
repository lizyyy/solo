import ProgressHeader from '@/components/ProgressHeader';
import FilterPanel from '@/components/FilterPanel';
import RecordsTable from '@/components/RecordsTable';
import AnomalyQueue from '@/components/AnomalyQueue';
import GuideFloatingCard from '@/components/GuideFloatingCard';
import AnomalyDetailDrawer from '@/components/AnomalyDetailDrawer';
import MergeDuplicateModal from '@/components/MergeDuplicateModal';
import ExportConfigPanel from '@/components/ExportConfigPanel';
import { useAppStore } from '@/store/useAppStore';

export default function Home() {
  const queueWidth = useAppStore((s) => s.ui.queueWidth);

  return (
    <div
      className="h-screen w-screen overflow-hidden relative"
      style={{
        backgroundImage:
          'radial-gradient(circle at 20% 85%, rgba(14,165,168,0.05) 0%, transparent 45%), radial-gradient(circle at 80% 15%, rgba(139,92,246,0.05) 0%, transparent 45%)',
        backgroundColor: '#F3F6F9',
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none select-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='44' height='44' viewBox='0 0 44 44' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 44L44 0H22L0 22M44 44V22L22 44' fill='%23000' fill-opacity='0.5'/%3E%3C/svg%3E\")",
        }}
      />

      <ProgressHeader />

      <main
        className="relative z-0 h-full pt-[170px] px-5 pb-5 flex items-start gap-5"
      >
        <FilterPanel />
        <RecordsTable />
        <div
          className="shrink-0"
          style={{ width: `${queueWidth}px` }}
        >
          <AnomalyQueue />
        </div>
      </main>

      <GuideFloatingCard />
      <AnomalyDetailDrawer />
      <MergeDuplicateModal />
      <ExportConfigPanel />
    </div>
  );
}
