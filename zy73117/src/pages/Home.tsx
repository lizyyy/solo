import { Building2, GitBranch, Clock, FileCheck } from 'lucide-react';
import { FilterPanel } from '@/components/FilterPanel';
import { MaterialList } from '@/components/MaterialList';
import { DetailSidebar } from '@/components/DetailSidebar';
import { NotificationToast } from '@/components/NotificationToast';
import { PendingPanel } from '@/components/PendingPanel';
import { useStore } from '@/store/useStore';

export default function Home() {
  const materials = useStore((state) => state.materials);
  const records = useStore((state) => state.records);
  const selectedMaterialId = useStore((state) => state.selectedMaterialId);

  const normalCount = materials.filter((m) => m.status === 'normal').length;
  const changedCount = materials.filter((m) => m.status === 'changed').length;
  const withdrawnCount = materials.filter((m) => m.status === 'withdrawn').length;
  const exceptionCount = materials.filter((m) => m.status === 'exception').length;
  const pendingCount = materials.filter((m) => m.isPending).length;

  return (
    <div className="h-screen flex flex-col bg-industrial-900 overflow-hidden">
      <header className="h-14 border-b border-industrial-700 bg-industrial-800 flex items-center px-4 shrink-0 grid-pattern">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-500 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-industrial-100 leading-tight">
              旧楼测绘材料追踪
            </h1>
            <p className="text-xs text-industrial-500 leading-tight">
              Old Building Survey Material Tracker
            </p>
          </div>
        </div>

        <div className="ml-8 flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-success-500" />
            <span className="text-industrial-400">正常</span>
            <span className="font-mono text-industrial-200 font-medium">{normalCount}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <GitBranch className="w-3.5 h-3.5 text-primary-400" />
            <span className="text-industrial-400">变更</span>
            <span className="font-mono text-industrial-200 font-medium">{changedCount}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-danger-500" />
            <span className="text-industrial-400">撤回</span>
            <span className="font-mono text-industrial-200 font-medium">{withdrawnCount}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-warning-500 animate-pulse" />
            <span className="text-industrial-400">异常</span>
            <span className="font-mono text-warning-400 font-medium">{exceptionCount}</span>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 text-xs ml-2 pl-4 border-l border-industrial-700">
              <Clock className="w-3.5 h-3.5 text-warning-400 animate-pulse" />
              <span className="text-warning-400 font-medium">待处理 {pendingCount} 条</span>
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-industrial-400">
            <FileCheck className="w-3.5 h-3.5 text-primary-400" />
            <span>共 {materials.length} 条材料 / {records.length} 条记录</span>
          </div>
          <div className="h-6 w-px bg-industrial-700" />
          <div className="text-xs text-industrial-500">
            设计院 · 现场管理系统
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 shrink-0 overflow-hidden">
          <FilterPanel />
        </aside>

        <main className="flex-1 overflow-hidden border-l border-industrial-700">
          <MaterialList />
        </main>

        <aside
          className={`border-l border-industrial-700 overflow-hidden transition-all duration-300 ${
            selectedMaterialId ? 'w-[420px]' : 'w-0'
          }`}
        >
          <DetailSidebar />
        </aside>
      </div>

      <NotificationToast />
      <PendingPanel />
    </div>
  );
}
