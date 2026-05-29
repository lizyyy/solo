import { useState, useRef, useCallback } from "react";
import { Upload, X, AlertTriangle, Image } from "lucide-react";
import { useStore } from "@/store/useStore";
import Modal from "@/components/Modal";
import { PHOTO_PHASE_LABELS } from "../../shared/types";
import type { Photo } from "../../shared/types";

interface Props {
  restorationId: string;
}

export default function PhotosPanel({ restorationId }: Props) {
  const { photos, steps, uploadPhoto, deletePhoto, fetchPhotos } = useStore();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<Photo["phase"]>("before");
  const [selectedStep, setSelectedStep] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const groupedPhotos = steps.reduce<Record<string, Photo[]>>((acc, step) => {
    acc[step.id] = photos.filter((p) => p.stepId === step.id);
    return acc;
  }, {});

  const stepsWithoutPhotos = steps.filter((s) => !groupedPhotos[s.id] || groupedPhotos[s.id].length === 0);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selectedStep) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("photo", file);
        formData.append("stepId", selectedStep);
        formData.append("phase", selectedPhase);
        await uploadPhoto(restorationId, formData);
      }
      await fetchPhotos(restorationId);
      setShowUpload(false);
    } catch {}
    setUploading(false);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleUpload(e.dataTransfer.files);
    },
    [selectedStep, selectedPhase]
  );

  const handleDelete = async (photoId: string) => {
    try {
      await deletePhoto(photoId);
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold text-primary-800">照片管理</h3>
        <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-2">
          <Upload size={16} />
          上传照片
        </button>
      </div>

      {stepsWithoutPhotos.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-amber" />
            <span className="text-sm font-medium text-amber">以下步骤缺少照片</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {stepsWithoutPhotos.map((s) => (
              <span key={s.id} className="px-2 py-1 bg-white rounded text-xs text-amber border border-amber-200">
                步骤{s.stepOrder}: {s.description.slice(0, 20)}
              </span>
            ))}
          </div>
        </div>
      )}

      {steps.length === 0 ? (
        <div className="text-center py-12 text-primary-300">
          <p>请先添加修复步骤</p>
        </div>
      ) : (
        <div className="space-y-6">
          {steps.map((step) => {
            const stepPhotos = groupedPhotos[step.id] || [];
            return (
              <div key={step.id}>
                <h4 className="text-sm font-medium text-primary-700 mb-3">
                  步骤 {step.stepOrder} - {step.description.slice(0, 40)}
                  <span className="text-primary-300 ml-2">({stepPhotos.length} 张)</span>
                </h4>
                {stepPhotos.length === 0 ? (
                  <div className="border-2 border-dashed border-primary-100 rounded-lg p-6 text-center">
                    <Image size={24} className="mx-auto text-primary-200 mb-2" />
                    <p className="text-xs text-primary-300">暂无照片</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {stepPhotos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden border border-primary-100 bg-primary-50">
                          <img
                            src={photo.url}
                            alt={photo.phase}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/50 rounded text-white text-[10px]">
                          {PHOTO_PHASE_LABELS[photo.phase]}
                        </div>
                        <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-amber/90 rounded text-white text-[10px] font-bold">
                          v{photo.version}
                        </div>
                        <button
                          onClick={() => handleDelete(photo.id)}
                          className="absolute bottom-1 right-1 p-1 bg-anomaly-red/80 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="上传照片">
        <div className="space-y-4">
          <div>
            <label className="label-field">关联步骤</label>
            <select
              value={selectedStep}
              onChange={(e) => setSelectedStep(e.target.value)}
              className="input-field"
            >
              <option value="">选择步骤</option>
              {steps.map((s) => (
                <option key={s.id} value={s.id}>
                  步骤{s.stepOrder} - {s.description.slice(0, 30)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">阶段</label>
            <select
              value={selectedPhase}
              onChange={(e) => setSelectedPhase(e.target.value as Photo["phase"])}
              className="input-field"
            >
              {Object.entries(PHOTO_PHASE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver ? "border-amber bg-amber-50" : "border-primary-100 hover:border-amber-200"
            }`}
          >
            <Upload size={32} className="mx-auto text-primary-200 mb-2" />
            <p className="text-sm text-primary-400">
              {dragOver ? "释放文件以上传" : "拖拽照片到此处，或点击选择文件"}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </div>
          {uploading && (
            <p className="text-sm text-amber text-center">上传中...</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowUpload(false)} className="btn-secondary">关闭</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
