import { useState, useRef, useEffect, useMemo } from "react";
import { Download, Calendar } from "lucide-react";
import { useTermWallStore } from "@/store/useTermWallStore";

const PRESETS = [
  { key: "perspective", label: "透视" },
  { key: "front", label: "正面" },
  { key: "side", label: "侧面" },
  { key: "top", label: "俯视" },
];

export default function Toolbar() {
  const { cameraPreset, setCameraPreset, exportCSV, exportPNG, positions, openSliceView } = useTermWallStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sliceDropdownOpen, setSliceDropdownOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sliceRef = useRef<HTMLDivElement>(null);

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const p of positions) {
      if (p.contractMonth) set.add(p.contractMonth);
    }
    return Array.from(set).sort();
  }, [positions]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!sliceDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (sliceRef.current && !sliceRef.current.contains(e.target as Node)) {
        setSliceDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sliceDropdownOpen]);

  return (
    <div className="fixed top-0 left-0 right-0 h-12 bg-[#0a0e1a]/90 backdrop-blur border-b border-[#1e293b] flex items-center justify-between px-4 z-40">
      <div className="font-mono font-bold text-lg text-white">期货持仓期限墙</div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setCameraPreset(p.key)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                cameraPreset === p.key
                  ? "bg-[#1e293b] text-white ring-1 ring-slate-500"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-[#1e293b]" />

        <div className="relative" ref={sliceRef}>
          <button
            onClick={() => setSliceDropdownOpen(!sliceDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1e293b] text-xs text-slate-300 hover:bg-[#2d3548]"
          >
            <Calendar size={14} />
            月份切片
          </button>
          {sliceDropdownOpen && (
            <div className="absolute left-1/2 -translate-x-1/2 mt-1 bg-[#1a1f2e] border border-[#2d3548] rounded-lg shadow-xl overflow-hidden">
              <div className="grid grid-cols-4 gap-1 p-2 min-w-[240px]">
                {months.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      openSliceView(m);
                      setSliceDropdownOpen(false);
                    }}
                    className="px-2 py-1 rounded text-xs text-slate-300 hover:bg-[#2d3548] text-center"
                  >
                    {m.slice(2)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative" ref={ref}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1e293b] text-xs text-slate-300 hover:bg-[#2d3548]"
        >
          <Download size={14} />
          导出
        </button>
        {dropdownOpen && (
          <div className="absolute right-0 mt-1 w-36 bg-[#1a1f2e] border border-[#2d3548] rounded-lg shadow-xl overflow-hidden">
            <button
              onClick={() => {
                exportCSV();
                setDropdownOpen(false);
              }}
              className="w-full px-3 py-2 text-xs text-slate-300 hover:bg-[#2d3548] text-left"
            >
              导出CSV
            </button>
            <button
              onClick={() => {
                exportPNG();
                setDropdownOpen(false);
              }}
              className="w-full px-3 py-2 text-xs text-slate-300 hover:bg-[#2d3548] text-left"
            >
              导出截图PNG
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
