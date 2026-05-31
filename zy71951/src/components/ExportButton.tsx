import { useState } from "react";
import { Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import api from "@/utils/api";

type ExportFormat = "pdf" | "excel";

interface ExportButtonProps {
  className?: string;
}

export default function ExportButton({ className }: ExportButtonProps) {
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [loading, setLoading] = useState(false);
  const { filters } = useAppStore();

  const handleExport = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { format };
      if (filters.dateRange) {
        params.startDate = filters.dateRange[0];
        params.endDate = filters.dateRange[1];
      }
      if (filters.status) params.status = filters.status;
      if (filters.severity) params.severity = filters.severity;
      if (filters.towerId) params.towerId = filters.towerId;
      if (filters.keyword) params.keyword = filters.keyword;

      const blob = await api.get<Blob>("/review/export", {
        params,
        headers: { Accept: format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      } as Parameters<typeof api.get>[1] & { headers?: Record<string, string> });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `飞行复盘报告.${format === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("导出失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <div className="flex rounded-md border border-gray-200 overflow-hidden">
        <button
          className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
            format === "pdf"
              ? "bg-accent text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
          onClick={() => setFormat("pdf")}
        >
          <FileText className="w-3.5 h-3.5" />
          PDF
        </button>
        <button
          className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors border-l border-gray-200 ${
            format === "excel"
              ? "bg-accent text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
          onClick={() => setFormat("excel")}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Excel
        </button>
      </div>

      <button
        className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        onClick={handleExport}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {loading ? "导出中…" : "导出报告"}
      </button>
    </div>
  );
}
