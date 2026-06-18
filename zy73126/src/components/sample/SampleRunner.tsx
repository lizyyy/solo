import { useState } from "react";
import { ChevronUp, ChevronDown, Download, FilePenLine, Clock, ArrowRight, Package, Search } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { mockRecords } from "../../data/mockData";

interface Step {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

const STEPS: Step[] = [
  { icon: <Download size={20} />, title: "📥 导入旧材料", desc: "导入船上记录本原始数据，系统自动解析字段与单位" },
  { icon: <FilePenLine size={20} />, title: "📝 补后补备注", desc: "对可疑记录添加后补备注，标注修正依据与来源" },
  { icon: <Clock size={20} />, title: "🧭 查看历史时间线", desc: "在时间线上回溯每条记录的操作与状态变更" },
];

export default function SampleRunner() {
  const [expanded, setExpanded] = useState(false);
  const importRecords = useAppStore((s) => s.importRecords);
  const rerunDetection = useAppStore((s) => s.rerunDetection);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-deep-100 shadow-lg z-50">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-deep-50 transition-colors"
      >
        <span className="font-semibold text-deep-800">🧪 样例试跑区</span>
        {expanded ? <ChevronDown size={18} className="text-deep-400" /> : <ChevronUp size={18} className="text-deep-400" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          <div className="flex items-start gap-3">
            {STEPS.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                {i > 0 && <ArrowRight size={16} className="text-deep-200 mt-5 shrink-0" />}
                <div className="flex-1 rounded-lg border border-deep-100 p-3 min-w-[180px]">
                  <div className="flex items-center gap-2 text-coral-500 mb-1">
                    {step.icon}
                    <span className="font-medium text-sm text-deep-800">{step.title}</span>
                  </div>
                  <p className="text-xs text-deep-300 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => importRecords(mockRecords)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-coral-400 text-white hover:bg-coral-500 transition-colors"
            >
              <Package size={15} />
              一键加载样例包
            </button>
            <button
              onClick={rerunDetection}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-deep-100 text-deep-300 hover:bg-deep-50 transition-colors"
            >
              <Search size={15} />
              一键重跑检测
            </button>
          </div>

          <p className="text-xs text-deep-300">
            样例包包含 9 条船上记录本数据，含潮位单位混写（m/厘米/ft/米/无单位）、后补备注及各类异常
          </p>
        </div>
      )}
    </div>
  );
}
