import { NavLink } from "react-router-dom";
import {
  Layers3,
  History,
  Sun,
  UserCircle2,
  Settings2,
} from "lucide-react";

interface Props {
  operator: string;
  onOperatorChange: (name: string) => void;
  onOpenHandover: () => void;
}

export const AppHeader = ({
  operator,
  onOperatorChange,
  onOpenHandover,
}: Props) => {
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? "bg-ink text-white shadow-card"
        : "text-ink-700 hover:bg-white hover:shadow-card"
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-paper-line bg-white/80 backdrop-blur-md shadow-card">
      <div className="container max-w-[1400px] px-6 py-3 flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-md bg-ink flex items-center justify-center text-white">
            <Sun size={18} />
          </div>
          <div className="leading-tight">
            <h1 className="font-serif font-semibold text-ink text-base">
              日照体量方案比选
            </h1>
            <p className="text-xs text-ink-400 -mt-0.5">
              材料送审表 · 变更记录 · 历史时间线
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1 ml-4">
          <NavLink to="/" className={navClass} end>
            <Layers3 size={16} />
            记录工作台
          </NavLink>
          <NavLink to="/timeline" className={navClass}>
            <History size={16} />
            历史时间线
          </NavLink>
        </nav>

        <div className="flex-1" />

        <button
          onClick={onOpenHandover}
          className="btn-secondary"
          title="生成交接说明"
        >
          <Settings2 size={15} />
          交接说明
        </button>

        <div className="flex items-center gap-2 pl-4 border-l border-paper-line">
          <UserCircle2 size={18} className="text-ink-500" />
          <label className="text-xs text-ink-500">操作人</label>
          <input
            value={operator}
            onChange={(e) => onOperatorChange(e.target.value)}
            className="w-24 px-2 py-1 text-sm bg-paper border border-paper-line rounded focus:outline-none focus:border-ink-400"
          />
        </div>
      </div>
    </header>
  );
};
