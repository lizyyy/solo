import { useTrailStore } from '@/store/useStore';
import StatsBar from '@/components/StatsBar';
import FeedbackList from '@/components/FeedbackList';
import PhotoGrid from '@/components/PhotoGrid';
import NotesEditor from '@/components/NotesEditor';

const tabs = [
  { key: 'feedback' as const, label: '居民反馈' },
  { key: 'photos' as const, label: '巡检照片' },
  { key: 'notes' as const, label: '人工备注' },
];

export default function Sidebar() {
  const sidebarTab = useTrailStore((s) => s.sidebarTab);
  const setSidebarTab = useTrailStore((s) => s.setSidebarTab);

  return (
    <div className="flex h-full w-full flex-col bg-[#f7f3e9]">
      <StatsBar />
      <div className="flex border-b border-stone-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSidebarTab(tab.key)}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors relative ${
              sidebarTab === tab.key
                ? 'text-[#1a535c]'
                : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            {tab.label}
            {sidebarTab === tab.key && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[#1a535c]" />
            )}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {sidebarTab === 'feedback' && <FeedbackList />}
        {sidebarTab === 'photos' && <PhotoGrid />}
        {sidebarTab === 'notes' && <NotesEditor />}
      </div>
    </div>
  );
}
