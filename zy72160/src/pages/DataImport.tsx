import { useState, useEffect, useCallback } from "react";
import { Map, Table, Camera, FileCheck } from "lucide-react";
import SourceCard, { ImportPreview, ImportJobsList } from "./data-import/SourceCard";
import { api } from "@/utils/api";
import { useAppStore } from "@/store/app.store";
import type { SourceType } from "./data-import/SourceCard";

const SOURCES: { type: SourceType; icon: typeof Map; title: string }[] = [
  { type: "gis", icon: Map, title: "GIS点位" },
  { type: "street_table", icon: Table, title: "街道表格" },
  { type: "photo", icon: Camera, title: "现场照片" },
  { type: "approval", icon: FileCheck, title: "审批记录" },
];

export default function DataImport() {
  const { currentBatch, importJobs, currentPreview, fetchImports, setPreview, addToast } = useAppStore();
  const [uploadingType, setUploadingType] = useState<SourceType | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (currentBatch) fetchImports(currentBatch.id);
  }, [currentBatch, fetchImports]);

  const handleUpload = useCallback(
    async (file: File, type: SourceType) => {
      if (!currentBatch) {
        addToast("error", "请先选择批次");
        return;
      }
      setUploadingType(type);
      try {
        const job = await api.imports.upload(currentBatch.id, file, type);
        setPreview(job);
        fetchImports(currentBatch.id);
        addToast("success", `${file.name} 上传成功`);
      } catch (e) {
        addToast("error", `上传失败: ${(e as Error).message}`);
      } finally {
        setUploadingType(null);
      }
    },
    [currentBatch, fetchImports, setPreview, addToast]
  );

  const handleMappingChange = useCallback(
    async (source: string, target: string) => {
      if (!currentPreview) return;
      try {
        const updated = await api.imports.updateMapping(currentPreview.id, {
          ...currentPreview.fieldMapping,
          [source]: target,
        });
        setPreview(updated);
      } catch (e) {
        addToast("error", "更新映射失败");
      }
    },
    [currentPreview, setPreview, addToast]
  );

  const handleConfirm = useCallback(async () => {
    if (!currentPreview || !currentBatch) return;
    setConfirming(true);
    try {
      await api.imports.confirm(currentPreview.id);
      setPreview(null);
      fetchImports(currentBatch.id);
      addToast("success", "导入确认成功");
    } catch (e) {
      addToast("error", "确认导入失败");
    } finally {
      setConfirming(false);
    }
  }, [currentPreview, currentBatch, fetchImports, setPreview, addToast]);

  const handleCancel = useCallback(() => setPreview(null), [setPreview]);

  const fileCount = (type: SourceType) =>
    importJobs.filter((j) => j.sourceType === type).length;

  return (
    <div className="space-y-6">
      <h2 className="section-title">数据导入</h2>

      <div className="grid grid-cols-4 gap-4">
        {SOURCES.map(({ type, icon, title }) => (
          <SourceCard
            key={type}
            type={type}
            icon={icon}
            title={title}
            fileCount={fileCount(type)}
            onUpload={handleUpload}
            uploading={uploadingType === type}
          />
        ))}
      </div>

      {currentPreview && (
        <ImportPreview
          job={currentPreview}
          onMappingChange={handleMappingChange}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          confirming={confirming}
        />
      )}

      <ImportJobsList jobs={importJobs} />
    </div>
  );
}
