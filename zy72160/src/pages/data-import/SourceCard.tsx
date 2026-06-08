import { useRef, useState } from "react";
import { Map, Table, Camera, FileCheck, Upload, X } from "lucide-react";
import type { ImportJob } from "../../../shared/types";

export type SourceType = "gis" | "street_table" | "photo" | "approval";

interface SourceCardProps {
  type: SourceType;
  icon: typeof Map;
  title: string;
  fileCount: number;
  onUpload: (file: File, type: SourceType) => void;
  uploading: boolean;
}

const typeConfig: Record<SourceType, { color: string; accept: string }> = {
  gis: { color: "bg-source", accept: ".csv,.xlsx,.xls,.shp" },
  street_table: { color: "bg-resolved", accept: ".csv,.xlsx,.xls" },
  photo: { color: "bg-purple-600", accept: ".jpg,.jpeg,.png,.heic" },
  approval: { color: "bg-ochre", accept: ".pdf,.xlsx,.xls,.csv" },
};

export default function SourceCard({ type, icon: Icon, title, fileCount, onUpload, uploading }: SourceCardProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cfg = typeConfig[type];

  const handleFile = (files: FileList | null) => {
    if (files && files[0]) {
      onUpload(files[0], type);
    }
  };

  return (
    <div
      className={`card transition-all ${dragOver ? "ring-2 ring-ochre/40" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files); }}
    >
      <div className="card-body">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-9 h-9 rounded-sm flex items-center justify-center ${cfg.color}`}>
            <Icon className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <div className="font-medium text-sm text-ink">{title}</div>
            <div className="text-xs text-gray-500">{fileCount} 个文件</div>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={cfg.accept}
          onChange={(e) => handleFile(e.target.files)}
        />
        <button
          className="btn-primary w-full text-xs py-1.5 flex items-center justify-center gap-1.5"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            "上传中..."
          ) : (
            <>
              <Upload className="w-3.5 h-3.5" /> 上传文件
            </>
          )}
        </button>
      </div>
    </div>
  );
}

interface ImportPreviewProps {
  job: ImportJob;
  onMappingChange: (source: string, target: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
}

const SYSTEM_FIELDS = ["gisId", "address", "businessType", "area", "longitude", "latitude", "notes", "district", "contactPhone", "ownerName"];

export function ImportPreview({ job, onMappingChange, onConfirm, onCancel, confirming }: ImportPreviewProps) {
  const sourceFields = job.rawPreview?.length ? Object.keys(job.rawPreview[0]) : [];

  return (
    <div className="card mt-6">
      <div className="card-header flex items-center justify-between">
        <h3 className="section-title">导入预览: {job.fileName}</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-ink">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="card-body space-y-6">
        <div>
          <h4 className="text-sm font-medium text-ink mb-3">字段映射</h4>
          <div className="grid grid-cols-2 gap-2">
            {sourceFields.map((sf) => (
              <div key={sf} className="flex items-center gap-2">
                <span className="text-sm text-gray-600 w-40 truncate" title={sf}>{sf}</span>
                <span className="text-gray-400">→</span>
                <select
                  className="select-base flex-1"
                  value={job.fieldMapping[sf] || ""}
                  onChange={(e) => onMappingChange(sf, e.target.value)}
                >
                  <option value="">-- 未映射 --</option>
                  {SYSTEM_FIELDS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-ink mb-3">数据预览 (前 20 行)</h4>
          <div className="overflow-x-auto border border-gray-200 rounded-sm">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {sourceFields.map((f) => (
                    <th key={f} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                      {f}
                      {!job.fieldMapping[f] && (
                        <span className="ml-1 text-conflict">*</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(job.rawPreview || []).slice(0, 20).map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    {sourceFields.map((f) => (
                      <td
                        key={f}
                        className={`px-3 py-1.5 whitespace-nowrap font-mono ${
                          !job.fieldMapping[f] ? "bg-amber-50 text-pending" : "text-ink"
                        }`}
                      >
                        {String(row[f] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onCancel}>取消</button>
          <button className="btn-primary" onClick={onConfirm} disabled={confirming}>
            {confirming ? "导入中..." : "确认导入"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ImportJobsListProps {
  jobs: ImportJob[];
}

export function ImportJobsList({ jobs }: ImportJobsListProps) {
  if (jobs.length === 0) return null;

  return (
    <div className="card mt-6">
      <div className="card-header">
        <h3 className="section-title">导入记录</h3>
      </div>
      <div className="card-body">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="pb-2 text-left text-xs font-medium text-gray-500">文件名</th>
              <th className="pb-2 text-left text-xs font-medium text-gray-500">来源</th>
              <th className="pb-2 text-left text-xs font-medium text-gray-500">记录数</th>
              <th className="pb-2 text-left text-xs font-medium text-gray-500">状态</th>
              <th className="pb-2 text-left text-xs font-medium text-gray-500">导入时间</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2 text-ink">{j.fileName}</td>
                <td className="py-2 text-gray-600">{j.sourceType}</td>
                <td className="py-2 font-mono text-ink">{j.recordCount}</td>
                <td className="py-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-sm text-xs font-medium ${
                      j.status === "merged"
                        ? "bg-blue-50 text-blue-700"
                        : j.status === "confirmed"
                        ? "bg-green-50 text-resolved"
                        : j.status === "failed"
                        ? "bg-red-50 text-conflict"
                        : j.status === "previewing"
                        ? "bg-amber-50 text-pending"
                        : "bg-gray-50 text-gray-600"
                    }`}
                  >
                    {j.status === "merged" ? "已归并" : j.status === "confirmed" ? "已确认" : j.status === "failed" ? "失败" : j.status === "previewing" ? "预览中" : "待处理"}
                  </span>
                </td>
                <td className="py-2 text-gray-500 text-xs">
                  {new Date(j.importTime).toLocaleString("zh-CN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
