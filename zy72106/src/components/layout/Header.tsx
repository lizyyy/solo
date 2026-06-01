import { Bell, User, Settings } from 'lucide-react';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6">
      <h2 className="text-lg font-semibold text-white">{title}</h2>

      <div className="flex items-center gap-4">
        <button className="p-2 text-slate-400 hover:text-white transition-colors relative">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <button className="p-2 text-slate-400 hover:text-white transition-colors">
          <Settings size={20} />
        </button>
        <div className="flex items-center gap-2 pl-4 border-l border-slate-800">
          <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
            <User size={16} className="text-white" />
          </div>
          <span className="text-sm text-slate-300">分析师</span>
        </div>
      </div>
    </header>
  );
}
