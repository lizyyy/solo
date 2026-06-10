import FieldMappingTable from "@/components/mapping/FieldMappingTable";

export default function FieldMappingPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-industrial-800 mb-1">
          备件清单字段映射配置
        </h2>
        <p className="text-sm text-gray-500">
          复核人交来的备件清单字段名可能前后不一，至少把来源和处理状态保住
        </p>
      </div>
      <FieldMappingTable />
    </div>
  );
}
