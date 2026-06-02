import { MessageSquare, AlertTriangle } from 'lucide-react';
import { useTrailStore } from '@/store/useStore';

const formatTime = (date: string | Date) => {
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function FeedbackList() {
  const feedbacks = useTrailStore((s) => s.feedbacks);
  const getPointById = useTrailStore((s) => s.getPointById);
  const setSelectedPoint = useTrailStore((s) => s.setSelectedPoint);
  const setSidebarTab = useTrailStore((s) => s.setSidebarTab);

  const sorted = [...feedbacks].sort(
    (a, b) => new Date(b.feedbackTime).getTime() - new Date(a.feedbackTime).getTime()
  );

  const handleClick = (pointId: string) => {
    setSelectedPoint(pointId);
    setSidebarTab('feedback');
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-200">
        <MessageSquare size={18} className="text-[#1a535c]" />
        <span className="font-semibold text-[#1a535c]">居民反馈</span>
        <span className="ml-auto text-xs text-stone-400">{sorted.length} 条</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map((fb) => {
          const point = getPointById(fb.pointId);
          return (
            <div
              key={fb.id}
              className="border-b border-stone-200 px-4 py-3 cursor-pointer hover:bg-stone-50 transition-colors"
              onClick={() => handleClick(fb.pointId)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-stone-800">{fb.residentName}</span>
                <div className="flex items-center gap-2">
                  {fb.hasConflict && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-[#ff6b35]">
                      <AlertTriangle size={12} />
                      冲突
                    </span>
                  )}
                  <span className="text-xs text-stone-400">{formatTime(fb.feedbackTime)}</span>
                </div>
              </div>
              <p className="text-sm text-stone-600 line-clamp-2 mb-1">{fb.content}</p>
              {point && (
                <span className="text-xs text-[#4ecdc4]">{point.name}</span>
              )}
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-stone-400">暂无反馈</div>
        )}
      </div>
    </div>
  );
}
