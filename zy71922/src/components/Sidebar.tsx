import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ClipboardList, FileText, Upload, Download, ChevronLeft, ChevronRight } from 'lucide-react';

const Sidebar = () => {
  const [expanded, setExpanded] = useState(true);
  const location = useLocation();

  const navItems = [
    { path: '/', icon: ClipboardList, label: '盘点总表' },
    { path: '/import', icon: Upload, label: '导入与撤回' },
    { path: '/export', icon: Download, label: '筛选导出' },
  ];

  const isArtworkDetail = location.pathname.startsWith('/artwork/');

  return (
    <aside className={`fixed left-0 top-0 h-full bg-gallery-surface border-r border-gallery-border transition-all duration-300 z-50 ${expanded ? 'w-48' : 'w-16'}`}>
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-gallery-border">
          {expanded ? (
            <h1 className="text-lg font-semibold text-gallery-amber">版画库存</h1>
          ) : (
            <FileText className="w-6 h-6 text-gallery-amber mx-auto" />
          )}
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 hover:bg-gallery-bg transition-colors ${
                  isActive ? 'border-l-2 border-gallery-amber bg-gallery-bg/50' : 'border-l-2 border-transparent'
                }`
              }
            >
              <item.icon className="w-5 h-5 text-gallery-muted flex-shrink-0" />
              {expanded && <span className="ml-3 text-sm">{item.label}</span>}
            </NavLink>
          ))}

          {isArtworkDetail && (
            <div className="flex items-center px-4 py-3 border-l-2 border-gallery-amber bg-gallery-bg/50">
              <FileText className="w-5 h-5 text-gallery-muted flex-shrink-0" />
              {expanded && <span className="ml-3 text-sm">作品详情</span>}
            </div>
          )}
        </nav>

        <button
          onClick={() => setExpanded(!expanded)}
          className="p-4 border-t border-gallery-border hover:bg-gallery-bg transition-colors"
        >
          {expanded ? (
            <ChevronLeft className="w-5 h-5 text-gallery-muted mx-auto" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gallery-muted mx-auto" />
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
