import HandoverPanel from "@/components/handover/HandoverPanel";

export default function HandoverPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-industrial-800 mb-1">
          交接面板 · 原话对照摘要
        </h2>
        <p className="text-sm text-gray-500">
          维保主管阿敏交接时，先找到备件清单里的原话，再用页面摘要解释处理结论
        </p>
      </div>
      <HandoverPanel />
    </div>
  );
}
