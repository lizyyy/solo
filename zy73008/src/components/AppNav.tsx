import { NavLink } from 'react-router-dom';
import { PawPrint, FileSearch, ClipboardList, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function AppNav() {
  const [open, setOpen] = useState(false);

  const linkCls = (isActive: boolean) =>
    `inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
      isActive
        ? 'bg-brand-600 text-white shadow-sm'
        : 'text-brand-700 hover:bg-brand-50 hover:text-brand-800'
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-brand-100/60 bg-cream-50/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-md">
            <PawPrint className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-lg text-brand-800 leading-tight">
              宠物医院寄养登记 · 犬只疫苗报告导出系统
            </h1>
            <p className="text-[11px] text-brand-500 tracking-wide">Foster Registry · Vaccine Report Traceability</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/" className={({ isActive }) => linkCls(isActive)} end>
            <ClipboardList className="w-4 h-4" />
            寄养登记表
          </NavLink>
          <NavLink to="/reports" className={({ isActive }) => linkCls(isActive)}>
            <FileSearch className="w-4 h-4" />
            疫苗报告导出分析
          </NavLink>
        </nav>

        <button className="md:hidden btn-ghost p-2" onClick={() => setOpen(!open)}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <nav className="md:hidden border-t border-brand-100 bg-white/90 px-5 py-2 flex flex-col gap-1">
          <NavLink to="/" onClick={() => setOpen(false)} className={({ isActive }) => linkCls(isActive)} end>
            <ClipboardList className="w-4 h-4" />
            寄养登记表
          </NavLink>
          <NavLink to="/reports" onClick={() => setOpen(false)} className={({ isActive }) => linkCls(isActive)}>
            <FileSearch className="w-4 h-4" />
            疫苗报告导出分析
          </NavLink>
        </nav>
      )}
    </header>
  );
}
