import { useState, type DragEvent } from "react";
import { Upload, FileSearch } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { mockRecords } from "../../data/mockData";

export default function ImportZone() {
  const [dragOver, setDragOver] = useState(false);
  const importRecords = useAppStore((s) => s.importRecords);
  const rerunDetection = useAppStore((s) => s.rerunDetection);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        if (Array.isArray(raw)) importRecords(raw);
      } catch {
        /* invalid file */
      }
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    importRecords(mockRecords);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={[
        "flex flex-col items-center justify-center gap-3 p-10 rounded-xl transition-colors",
        dragOver
          ? "border-2 border-coral-400 bg-coral-50/20"
          : "border-2 border-dashed border-deep-100",
      ].join(" ")}
      style={{ borderRadius: 12 }}
    >
      <Upload
        size={32}
        className={dragOver ? "text-coral-400" : "text-deep-200"}
      />
      <p className="text-deep-300 text-sm">
        拖拽船上记录本文件至此，或点击导入
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleLoadSample}
          className="px-4 py-1.5 text-sm rounded-lg bg-coral-400 text-white hover:bg-coral-500 transition-colors"
        >
          加载示例数据包
        </button>
        <button
          onClick={rerunDetection}
          className="px-4 py-1.5 text-sm rounded-lg border border-deep-100 text-deep-300 hover:bg-deep-50 transition-colors flex items-center gap-1"
        >
          <FileSearch size={14} />
          重新检测
        </button>
      </div>
    </div>
  );
}
