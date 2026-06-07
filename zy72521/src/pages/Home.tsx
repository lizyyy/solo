import { Shield, Info } from 'lucide-react';
import { RecordList } from '../components/RecordList';
import { DetailPanel } from '../components/DetailPanel';

export default function Home() {
  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <header className="h-14 px-6 flex items-center justify-between border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-800">
              AI 绘画素材版权提醒
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-md">
            <Info className="w-4 h-4 text-amber-600" />
            <span className="text-sm text-amber-700">演示数据 · 共3条记录</span>
          </div>
        </div>
      </header>
      
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[380px] border-r border-slate-200 bg-white flex flex-col">
          <RecordList />
        </aside>
        
        <main className="flex-1 overflow-hidden">
          <DetailPanel />
        </main>
      </div>
    </div>
  );
}
