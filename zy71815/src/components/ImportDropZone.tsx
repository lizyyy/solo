import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, X } from "lucide-react";
import { useSettlementStore } from "@/store/settlementStore";
import { api } from "@/utils/api";
import { mapErrorMessage } from "@/utils/errorMessages";

interface ImportDropZoneProps {
  onImportComplete: () => void;
}

export default function ImportDropZone({ onImportComplete }: ImportDropZoneProps) {
  const { setImportResult, importLoading: storeLoading, showToast } = useSettlementStore();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (selected: FileList | null) => {
    if (selected && selected.length > 0) {
      setFile(selected[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFileChange(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await api.imports.upload(file);
      setImportResult(result);
      showToast(`文件解析完成：共 ${result.total} 条记录`);
      onImportComplete();
    } catch (err) {
      showToast(mapErrorMessage(err), "error");
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const isLoading = uploading || storeLoading;

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 transition-colors ${
          dragging
            ? "border-teal-500 bg-teal-50"
            : "border-slate-300 bg-slate-50 hover:border-teal-400 hover:bg-teal-50/50"
        }`}
      >
        <Upload
          className={`h-10 w-10 ${dragging ? "text-teal-600" : "text-slate-400"}`}
        />
        <p className="mt-3 text-sm text-slate-600">
          将 Excel/CSV 文件拖拽到此处，或
          <span className="text-teal-700 underline">点击选择文件</span>
        </p>
        <p className="mt-1 text-xs text-slate-400">
          支持 .xlsx、.xls、.csv 格式
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={(e) => handleFileChange(e.target.files)}
        className="hidden"
      />

      {file && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-teal-600" />
            <div>
              <p className="text-sm font-medium text-slate-800">{file.name}</p>
              <p className="text-xs text-slate-400">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleUpload}
              disabled={isLoading}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {isLoading ? "解析中..." : "开始导入"}
            </button>
            <button
              onClick={clearFile}
              disabled={isLoading}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
