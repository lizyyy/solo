import { User, Search, Settings, FileText } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { formatDateTime } from '@/utils/unitConverter';

export default function Header() {
  const currentVersion = useAppStore((s) => s.getCurrentVersion());
  const warningCount = useAppStore((s) => s.warnings.length);

  return (
    <header className="sticky top-0 z-30 h-16 bg-surface-card/95 backdrop-blur border-b border-surface-border flex items-center px-4 lg:px-6 gap-4">
      <div className="flex items-center gap-2 lg:hidden">
        <div className="w-8 h-8 rounded-md bg-industrial-500 flex items-center justify-center text-white text-xs font-bold">
          TL
        </div>
        <span className="title-font font-semibold text-industrial-700">管线阈值预警</span>
      </div>

      <div className="flex-1 flex items-center max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-industrial-300" />
          <input
            type="text"
            placeholder="搜索设备编号 / 管线名称 / 预警ID…"
            className="w-full h-9 pl-9 pr-3 rounded-md bg-surface-muted border border-surface-border text-sm placeholder:text-industrial-300 focus:outline-none focus:ring-2 focus:ring-industrial-300/60 focus:border-industrial-400 transition-all"
          />
        </div>
      </div>

      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-industrial-50 border border-industrial-100">
        <FileText className="w-3.5 h-3.5 text-industrial-500" />
        <span className="text-xs text-industrial-600">
          当前口径：
          <span className="font-semibold text-industrial-700">{currentVersion?.version}</span>
          <span className="text-industrial-400 mx-1.5">·</span>
          <span className="text-industrial-500">生效 {currentVersion?.effective_date}</span>
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button className="p-2 rounded-md text-industrial-500 hover:bg-industrial-50 transition-colors" title="设置">
          <Settings className="w-4.5 h-4.5" />
        </button>
        <div className="flex items-center gap-2 pl-2 border-l border-surface-border">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-industrial-300 to-industrial-500 flex items-center justify-center text-white">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden sm:block">
            <div className="text-xs font-medium text-industrial-700 leading-tight">唐建国</div>
            <div className="text-[10px] text-industrial-400 num">
              今日 {formatDateTime(new Date().toISOString()).slice(5, 16)}
            </div>
          </div>
        </div>
      </div>

      <div className="sm:hidden flex items-center gap-2">
        <span className="num text-xs px-2 py-1 rounded bg-alert-yellow/20 text-[#8a6a00] font-semibold">
          {warningCount}条预警
        </span>
      </div>
    </header>
  );
}
