import { AlertTriangle } from "lucide-react";

interface PendingBannerProps {
  count: number;
  onClick: () => void;
}

export default function PendingBanner({ count, onClick }: PendingBannerProps) {
  if (count <= 0) return null;

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
    >
      <AlertTriangle size={16} className="shrink-0" />
      <span>待复核事项 {count} 项</span>
    </button>
  );
}
