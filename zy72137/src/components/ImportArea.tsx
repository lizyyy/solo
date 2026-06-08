import { useStore } from "@/store/useStore";
import { sampleData } from "@/data/sampleData";
import { parseFilesToRecords } from "@/utils/parseFiles";
import { Upload, FolderOpen, Database } from "lucide-react";
import { useCallback, useRef, useState } from "react";

export default function ImportArea() {
  const addRecords = useStore((s) => s.addRecords);
  const setRecords = useStore((s) => s.setRecords);
  const records = useStore((s) => s.records);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setImporting(true);
      setTimeout(() => {
        const fileArray = Array.from(files);
        const { records: newRecords, duplicateGroupMap } = parseFilesToRecords(fileArray, records);
        addRecords(newRecords, duplicateGroupMap);
        setImporting(false);
      }, 300);
    },
    [addRecords, records]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const loadSampleData = useCallback(() => {
    if (records.length > 0) {
      const confirmed = window.confirm("加载样例数据将替换当前所有记录，确定吗？");
      if (!confirmed) return;
    }
    setRecords(sampleData.map((r) => ({ ...r })));
  }, [records.length, setRecords]);

  return (
    <div className="mb-6">
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer ${
          dragging
            ? "border-amber-400 bg-amber-400/10 scale-[1.01]"
            : "border-zinc-600 hover:border-amber-400/60 hover:bg-zinc-800/40"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".wav,.mp3,.flac,.aiff,.ogg,.aac,.wma,.m4a"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-3">
          {importing ? (
            <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload className="w-10 h-10 text-amber-400/70" />
          )}
          <p className="text-zinc-300 text-sm">
            拖拽音频文件到此处，或点击选择文件
          </p>
          <p className="text-zinc-500 text-xs">
            支持 WAV / MP3 / FLAC / AIFF / OGG 等格式
          </p>
        </div>
      </div>

      <div className="flex gap-3 mt-3">
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-600 text-zinc-300 text-sm hover:bg-zinc-700 hover:border-zinc-500 transition-colors"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.webkitdirectory = true;
            input.onchange = (e) => {
              const target = e.target as HTMLInputElement;
              handleFiles(target.files);
            };
            input.click();
          }}
        >
          <FolderOpen className="w-4 h-4" />
          选择文件夹
        </button>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-600 text-zinc-300 text-sm hover:bg-zinc-700 hover:border-zinc-500 transition-colors"
          onClick={loadSampleData}
        >
          <Database className="w-4 h-4" />
          加载样例数据
        </button>
      </div>
    </div>
  );
}
