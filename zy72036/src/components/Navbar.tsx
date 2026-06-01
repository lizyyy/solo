import { NavLink } from "react-router-dom";
import { Home, History, HelpCircle, Zap } from "lucide-react";

const navItems = [
  { path: "/", label: "滑板公园", icon: <Home size={18} /> },
  { path: "/history", label: "历史记录", icon: <History size={18} /> },
  { path: "/help", label: "使用说明", icon: <HelpCircle size={18} /> },
];

export default function Navbar() {
  return (
    <nav className="bg-skate-black border-b-4 border-skate-teal shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="bg-skate-teal p-2 rounded-lg transform -rotate-3">
              <Zap size={28} className="text-skate-black" />
            </div>
            <div>
              <h1 className="text-skate-chalk text-2xl font-handwriting tracking-wider">
                微积分滑板公园
              </h1>
              <p className="text-skate-chalk-dim text-xs font-mono">
                Calculus Skate Park v1.0
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg font-handwriting text-lg transition-all duration-200 ${
                    isActive
                      ? "bg-skate-teal text-skate-black shadow-chalk"
                      : "text-skate-chalk hover:bg-skate-chalk/10 hover:text-skate-orange"
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
