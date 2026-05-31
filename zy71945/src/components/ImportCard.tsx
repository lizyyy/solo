import { useState, useCallback } from "react";
import { Upload, FileCheck, AlertTriangle } from "lucide-react";

interface ImportCardProps {
  title: string;
  icon: React.ReactNode;
  accept: string;
  onFile: (file: File) => void;
  errors: string[];
  warnings: string[];
  count: number;
}

export default function ImportCard({
  title,
  icon,
  accept,
  onFile,
  errors,
  warnings,
  count,
}: ImportCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
      e.target.value = "";
    },
    [onFile]
  );

  return (
    <div className="rounded-lg border border-slate-700/50 bg-[#0f1a2e] p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-medium text-slate-200">{title}</h3>
        {count > 0 && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400">
            {count} 条
          </span>
        )}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center py-6 rounded-md border-2 border-dashed transition-colors cursor-pointer ${
          isDragOver
            ? "border-amber-400 bg-amber-400/5"
            : "border-slate-600 hover:border-slate-500"
        }`}
        onClick={() => document.getElementById(`file-${title}`)?.click()}
      >
        <Upload className="w-5 h-5 text-slate-500 mb-2" />
        <p className="text-xs text-slate-500">拖拽文件或点击上传</p>
        <p className="text-[10px] text-slate-600 mt-1">{accept}</p>
        <input
          id={`file-${title}`}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {(errors.length > 0 || warnings.length > 0) && (
        <div className="mt-3 space-y-1 max-h-32 overflow-auto">
          {errors.map((e, i) => (
            <div
              key={`e${i}`}
              className="flex items-start gap-1.5 text-[11px] text-red-400"
            >
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{e}</span>
            </div>
          ))}
          {warnings.map((w, i) => (
            <div
              key={`w${i}`}
              className="flex items-start gap-1.5 text-[11px] text-amber-400/80"
            >
              <FileCheck className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
