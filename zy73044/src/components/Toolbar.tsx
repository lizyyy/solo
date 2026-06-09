import { useRef } from "react";
import { Upload, CheckCircle2, Undo2, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onImport: (file: File) => void;
  onConfirm: () => void;
  onWithdraw: () => void;
  onExport: () => void;
  selectedCount: number;
  totalCount: number;
  confirmedCount: number;
  pendingCount: number;
}

export default function Toolbar({
  onImport,
  onConfirm,
  onWithdraw,
  onExport,
  selectedCount,
  totalCount,
  confirmedCount,
  pendingCount,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const Btn = ({
    onClick,
    icon: Icon,
    children,
    variant = "outline",
    disabled,
  }: {
    onClick: () => void;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
    variant?: "solid" | "outline" | "ghost";
    disabled?: boolean;
  }) => {
    const base =
      "inline-flex items-center gap-2 h-10 px-4 rounded-[2px] font-sans text-sm tracking-tight border-2 transition-colors duration-150 select-none";
    const v =
      variant === "solid"
        ? "bg-[#1E40AF] text-white border-[#1E40AF] hover:bg-[#1d4ed8] active:bg-[#1e3a8a]"
        : variant === "outline"
        ? "bg-white text-slate-800 border-slate-800 hover:bg-slate-50 active:bg-slate-100"
        : "bg-transparent text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-100";
    const d = disabled
      ? "opacity-40 cursor-not-allowed pointer-events-none"
      : "cursor-pointer";
    return (
      <button onClick={onClick} className={cn(base, v, d)} disabled={disabled}>
        <Icon className="w-4 h-4" />
        {children}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-3 flex-wrap border-b-2 border-slate-800 pb-5 pt-4">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImport(f);
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
      <Btn variant="solid" onClick={() => fileRef.current?.click()} icon={Upload}>
        导入CSV
      </Btn>
      <Btn
        variant="outline"
        onClick={onConfirm}
        icon={CheckCircle2}
        disabled={selectedCount === 0}
      >
        确认选中{selectedCount > 0 ? ` (${selectedCount})` : ""}
      </Btn>
      <Btn
        variant="outline"
        onClick={onWithdraw}
        icon={Undo2}
        disabled={selectedCount === 0}
      >
        撤回选中{selectedCount > 0 ? ` (${selectedCount})` : ""}
      </Btn>
      <div className="flex-1" />
      <Btn variant="outline" onClick={onExport} icon={FileDown}>
        导出CSV
      </Btn>
      <div className="flex items-center gap-4 pl-4 ml-2 border-l-2 border-slate-200 h-10">
        <div className="flex flex-col items-end leading-tight">
          <span className="text-[10px] font-sans text-slate-500 tracking-wider uppercase">Total</span>
          <span className="font-sans text-xl font-black text-slate-800 tabular-nums">{totalCount}</span>
        </div>
        <div className="flex flex-col items-end leading-tight">
          <span className="text-[10px] font-sans text-emerald-600 tracking-wider uppercase">Confirmed</span>
          <span className="font-sans text-xl font-black text-emerald-700 tabular-nums">{confirmedCount}</span>
        </div>
        <div className="flex flex-col items-end leading-tight">
          <span className="text-[10px] font-sans text-amber-600 tracking-wider uppercase">Pending</span>
          <span className="font-sans text-xl font-black text-amber-700 tabular-nums">{pendingCount}</span>
        </div>
      </div>
    </div>
  );
}
