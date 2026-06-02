import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Upload, GitMerge, FileText, MapPin, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAppStore } from "../store/app.store";

const navItems = [
  { to: "/", label: "总览", icon: LayoutDashboard },
  { to: "/import", label: "数据导入", icon: Upload },
  { to: "/review", label: "归并与复核", icon: GitMerge },
  { to: "/export", label: "公示清单", icon: FileText },
];

export default function Sidebar() {
  const { currentBatch, batches, setCurrentBatch, fetchBatches, createBatch } = useAppStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showNewBatch, setShowNewBatch] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleCreateBatch = async () => {
    if (!newBatchName.trim()) return;
    const batch = await createBatch(newBatchName.trim());
    if (batch) {
      setNewBatchName("");
      setShowNewBatch(false);
      setDropdownOpen(false);
    }
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-paper border-r border-gray-300 flex flex-col z-30">
      <div className="px-4 py-5 border-b border-gray-300">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-ochre" />
          <h1 className="font-serif text-lg font-bold text-ink">街区业态管理</h1>
        </div>
      </div>

      <div className="px-3 py-3 border-b border-gray-300" ref={dropdownRef}>
        <button
          className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-300 rounded-sm text-sm hover:border-ochre transition-colors"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          <span className="truncate text-ink">
            {currentBatch ? currentBatch.name : "选择批次"}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-gray-500 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
          />
        </button>

        {dropdownOpen && (
          <div className="absolute left-3 mt-1 w-54 bg-white border border-gray-200 rounded-sm shadow-lg z-40">
            {batches.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">暂无批次</div>
            )}
            {batches.map((b) => (
              <button
                key={b.id}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-ochre-tint transition-colors ${
                  currentBatch?.id === b.id ? "bg-ochre-tint text-ochre font-medium" : "text-ink"
                }`}
                onClick={() => {
                  setCurrentBatch(b);
                  setDropdownOpen(false);
                }}
              >
                {b.name}
              </button>
            ))}
            <div className="border-t border-gray-200">
              {showNewBatch ? (
                <div className="p-2">
                  <input
                    className="input-base mb-2"
                    placeholder="批次名称"
                    value={newBatchName}
                    onChange={(e) => setNewBatchName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateBatch()}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button className="btn-primary flex-1 text-xs py-1" onClick={handleCreateBatch}>
                      创建
                    </button>
                    <button
                      className="btn-ghost flex-1 text-xs py-1"
                      onClick={() => {
                        setShowNewBatch(false);
                        setNewBatchName("");
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="w-full text-left px-3 py-2 text-sm text-ochre hover:bg-ochre-tint transition-colors"
                  onClick={() => setShowNewBatch(true)}
                >
                  + 创建新批次
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 mx-2 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors ${
                isActive
                  ? "bg-ochre-tint text-ochre border-l-[3px] border-ochre"
                  : "text-ink hover:bg-gray-100 border-l-[3px] border-transparent"
              }`
            }
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-gray-300 text-xs text-gray-500">
        历史街区业态更新管理系统
      </div>
    </aside>
  );
}
