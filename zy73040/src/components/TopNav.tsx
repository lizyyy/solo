import { Database, Droplets, Settings, UserCircle2 } from 'lucide-react';

export default function TopNav() {
  return (
    <header className="bg-navy-500 text-white border-b-4 border-navy-600 shadow-md sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-gradient-to-br from-coral-400 to-amber-400 flex items-center justify-center shadow-inner">
            <Droplets className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wide leading-tight">
              泵站巡检工单回放系统
            </h1>
            <p className="text-[11px] text-navy-200 leading-none mt-0.5">
              Pump Station Inspection Playback · v1.0
            </p>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          <button className="px-4 py-2 rounded-sm text-sm font-medium bg-white/10 hover:bg-white/15 transition-colors inline-flex items-center gap-2">
            <Database className="w-4 h-4" />
            工单回放
          </button>
          <button className="px-4 py-2 rounded-sm text-sm font-medium text-navy-200 hover:bg-white/10 hover:text-white transition-colors inline-flex items-center gap-2">
            <Settings className="w-4 h-4" />
            规则配置
          </button>
          <div className="ml-3 flex items-center gap-2 pl-3 border-l border-white/20">
            <div className="w-8 h-8 rounded-full bg-navy-400 border-2 border-white/30 flex items-center justify-center">
              <UserCircle2 className="w-5 h-5" strokeWidth={2} />
            </div>
            <div className="text-sm leading-tight">
              <div className="font-medium">排班 · 老张</div>
              <div className="text-[10px] text-navy-200">工号 SCH-0032</div>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
