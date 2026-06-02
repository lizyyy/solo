import { Map, Table, Camera, FileCheck } from "lucide-react";

type SourceType = "gis" | "street_table" | "photo" | "approval";

interface EvidenceTagProps {
  sourceType: SourceType;
}

const config: Record<SourceType, { label: string; icon: typeof Map; bg: string; text: string }> = {
  gis: { label: "GIS", icon: Map, bg: "bg-blue-50", text: "text-source" },
  street_table: { label: "表格", icon: Table, bg: "bg-green-50", text: "text-resolved" },
  photo: { label: "照片", icon: Camera, bg: "bg-purple-50", text: "text-purple-700" },
  approval: { label: "审批", icon: FileCheck, bg: "bg-ochre-tint", text: "text-ochre" },
};

export default function EvidenceTag({ sourceType }: EvidenceTagProps) {
  const c = config[sourceType];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-xs font-medium ${c.bg} ${c.text}`}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}
