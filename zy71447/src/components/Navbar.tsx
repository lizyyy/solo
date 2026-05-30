import { NavLink } from 'react-router-dom';
import { Layers, Waves, MapPin, FileText, Music } from 'lucide-react';
import { InstrumentSelector } from './InstrumentSelector';
import type { InstrumentName } from '@/types';

interface NavbarProps {
  currentInstrument: InstrumentName;
  onInstrumentChange: (name: InstrumentName) => void;
}

const navItems = [
  { path: '/', label: '3D剖面', icon: Layers },
  { path: '/frequency', label: '频段分析', icon: Waves },
  { path: '/hotspots', label: '热点标注', icon: MapPin },
  { path: '/report', label: '报告导出', icon: FileText },
];

export function Navbar({ currentInstrument, onInstrumentChange }: NavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-charcoal-950/90 backdrop-blur-md border-b border-charcoal-800">
      <div className="max-w-screen-2xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-walnut-700 to-walnut-900 rounded-lg flex items-center justify-center shadow-bronze-glow">
              <Music size={24} className="text-bronze-400" />
            </div>
            <div>
              <h1 className="font-serif text-lg text-bronze-400 leading-tight">
                乐器博物馆
              </h1>
              <p className="text-xs text-gray-500 font-mono leading-tight">
                声学剖面分析系统
              </p>
            </div>
          </div>

          <div className="h-8 w-px bg-charcoal-700 mx-2" />

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={14} className="inline mr-1" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </div>

        <InstrumentSelector current={currentInstrument} onChange={onInstrumentChange} />
      </div>

      <div className="md:hidden border-t border-charcoal-800 px-4 py-2">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => `
                  flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors
                  ${isActive ? 'text-bronze-400' : 'text-gray-500'}
                `}
              >
                <Icon size={18} />
                <span className="text-xs font-mono">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
