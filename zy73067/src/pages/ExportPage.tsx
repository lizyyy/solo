import ConsistencyPreview from "@/components/export/ConsistencyPreview";

export default function ExportPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-industrial-800 mb-1">
          导出中心 · 一致性校验
        </h2>
        <p className="text-sm text-gray-500">
          导出页面摘要时，状态列、备注和文件结论要能互相对得上
        </p>
      </div>
      <ConsistencyPreview />
    </div>
  );
}
