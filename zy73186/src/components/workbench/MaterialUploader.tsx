import React, { useState, useRef } from 'react';
import { Upload, FileText, FileWarning, Hash, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Material, MaterialType } from '@/types';
import { MATERIAL_TYPE_LABELS, SUSPENDED_REASON_LABELS } from '@/types';
import { shortHash } from '@/utils/hash';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Tooltip } from '@/components/common/Tooltip';

interface MaterialUploaderProps {
  sessionId: string;
  materials: Material[];
  onUpload: (
    type: MaterialType,
    content: string,
    name: string
  ) => Promise<{
    material: Material;
    duplicateCheck: { isDuplicate: boolean; similarity: number; existingSessionId?: string };
  }>;
  onCreateSuspendedTask: (
    sessionId: string,
    reason: 'duplicate_sample' | 'caliber_change',
    duplicateInfo?: any
  ) => Promise<any>;
  disabled?: boolean;
}

const MATERIAL_TYPES: { type: MaterialType; icon: React.ReactNode; description: string }[] = [
  {
    type: 'historical_answer',
    icon: <FileText className="w-5 h-5" />,
    description: '历史答案文档',
  },
  {
    type: 'boundary_sample',
    icon: <FileWarning className="w-5 h-5" />,
    description: '边界样本数据',
  },
  {
    type: 'verbal_note',
    icon: <FileText className="w-5 h-5" />,
    description: '临时口头说明',
  },
];

export const MaterialUploader: React.FC<MaterialUploaderProps> = ({
  sessionId,
  materials,
  onUpload,
  onCreateSuspendedTask,
  disabled,
}) => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedType, setSelectedType] = useState<MaterialType | null>(null);
  const [uploadContent, setUploadContent] = useState('');
  const [uploadName, setUploadName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    similarity: number;
    existingSessionId: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setUploadContent(content);
      setUploadName(file.name);
    };
    reader.readAsText(file);
  };

  const handleTypeSelect = (type: MaterialType) => {
    setSelectedType(type);
    setUploadContent('');
    setUploadName('');
  };

  const handleUpload = async () => {
    if (!selectedType || !uploadContent.trim() || disabled) return;

    setIsUploading(true);
    try {
      const result = await onUpload(selectedType, uploadContent, uploadName || `未命名_${selectedType}`);

      if (result.duplicateCheck.isDuplicate && selectedType === 'boundary_sample') {
        setDuplicateInfo({
          similarity: result.duplicateCheck.similarity,
          existingSessionId: result.duplicateCheck.existingSessionId || '',
        });
        setShowDuplicateWarning(true);
      }

      setShowUploadModal(false);
      setSelectedType(null);
      setUploadContent('');
      setUploadName('');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSuspend = async () => {
    if (!duplicateInfo) return;

    await onCreateSuspendedTask(sessionId, 'duplicate_sample', {
      similarity: duplicateInfo.similarity,
      existingSessionId: duplicateInfo.existingSessionId,
      existingSampleHash: '',
      newSampleHash: '',
    });

    setShowDuplicateWarning(false);
    setDuplicateInfo(null);
  };

  const getMaterialsByType = (type: MaterialType) => {
    return materials.filter((m) => m.type === type);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-mono text-sm text-[#e2e8f0] tracking-wide">材料清单</h3>
        <Button
          size="sm"
          variant="secondary"
          icon={<Upload className="w-3.5 h-3.5" />}
          onClick={() => setShowUploadModal(true)}
          disabled={disabled || !sessionId}
        >
          上传材料
        </Button>
      </div>

      <div className="space-y-3">
        {MATERIAL_TYPES.map(({ type, icon, description }) => {
          const typeMaterials = getMaterialsByType(type);
          return (
            <div
              key={type}
              className={cn(
                'p-4 rounded-lg border transition-colors',
                typeMaterials.length > 0
                  ? 'bg-[#1a202c] border-[#4a5568]'
                  : 'bg-[#0d1117] border-[#2d3748] border-dashed'
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'p-2 rounded',
                    typeMaterials.length > 0 ? 'bg-[#1a365d]' : 'bg-[#2d3748]'
                  )}
                >
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-[#e2e8f0]">
                      {MATERIAL_TYPE_LABELS[type]}
                    </span>
                    <span className="text-xs text-[#718096]">{description}</span>
                    {typeMaterials.some((m) => m.hasCaliberChanged) && (
                      <Tooltip content="检测到口径变更">
                        <AlertTriangle className="w-4 h-4 text-[#dd6b20]" />
                      </Tooltip>
                    )}
                  </div>

                  {typeMaterials.length === 0 ? (
                    <p className="mt-1 text-xs text-[#718096]">尚未上传</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {typeMaterials.map((material) => (
                        <div
                          key={material.id}
                          className="flex items-center justify-between p-2 bg-[#0d1117] rounded border border-[#2d3748]"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-[#e2e8f0] truncate">
                                {material.name}
                              </span>
                              <span className="text-xs text-[#718096]">v{material.version}</span>
                              {material.hasCaliberChanged && (
                                <span className="px-1.5 py-0.5 text-xs bg-[#dd6b20]/20 text-[#dd6b20] rounded">
                                  口径变更
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs font-mono text-[#718096]">
                              <Hash className="w-3 h-3" />
                              {shortHash(material.contentHash, 8)}
                              <span className="mx-1">·</span>
                              {material.versions.length} 个版本
                            </div>
                          </div>
                          <CheckCircle2 className="w-4 h-4 text-[#38a169] flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={showUploadModal}
        onClose={() => !isUploading && setShowUploadModal(false)}
        title="上传材料"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowUploadModal(false)}
              disabled={isUploading}
            >
              取消
            </Button>
            <Button
              variant="primary"
              onClick={handleUpload}
              loading={isUploading}
              disabled={!selectedType || !uploadContent.trim()}
            >
              确认上传
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-mono text-[#a0aec0] mb-2">选择材料类型</label>
            <div className="grid grid-cols-3 gap-3">
              {MATERIAL_TYPES.map(({ type, icon, description }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeSelect(type)}
                  className={cn(
                    'p-4 rounded-lg border-2 text-left transition-all',
                    selectedType === type
                      ? 'border-[#3182ce] bg-[#1a365d]/30'
                      : 'border-[#4a5568] bg-[#1a202c] hover:border-[#718096]'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {icon}
                    <span className="font-mono text-sm text-[#e2e8f0]">
                      {MATERIAL_TYPE_LABELS[type]}
                    </span>
                  </div>
                  <p className="text-xs text-[#718096]">{description}</p>
                </button>
              ))}
            </div>
          </div>

          {selectedType && (
            <>
              <div>
                <label className="block text-sm font-mono text-[#a0aec0] mb-2">
                  选择文件或粘贴内容
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="flex gap-2 mb-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Upload className="w-3.5 h-3.5" />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    选择文件
                  </Button>
                  {uploadName && (
                    <span className="flex items-center text-sm text-[#a0aec0]">
                      已选择: {uploadName}
                    </span>
                  )}
                </div>
                <textarea
                  value={uploadContent}
                  onChange={(e) => setUploadContent(e.target.value)}
                  placeholder="在此粘贴材料内容..."
                  className="w-full h-48 px-3 py-2 bg-[#0d1117] border border-[#4a5568] rounded font-mono text-sm text-[#e2e8f0] focus:outline-none focus:border-[#3182ce] resize-none"
                />
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showDuplicateWarning}
        onClose={() => setShowDuplicateWarning(false)}
        title="检测到重复样本"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowDuplicateWarning(false)}>
              忽略继续
            </Button>
            <Button variant="warning" onClick={handleSuspend}>
              挂起等待确认
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-[#dd6b20]/10 border border-[#dd6b20]/50 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-[#dd6b20] flex-shrink-0" />
            <div>
              <p className="font-mono text-[#e2e8f0]">检测到高相似度样本</p>
              <p className="text-sm text-[#a0aec0] mt-1">
                与历史会话 #{duplicateInfo ? shortHash(duplicateInfo.existingSessionId, 8) : ''} 的相似度为{' '}
                <span className="text-[#dd6b20] font-bold">
                  {duplicateInfo ? (duplicateInfo.similarity * 100).toFixed(1) : 0}%
                </span>
              </p>
            </div>
          </div>
          <p className="text-sm text-[#a0aec0]">
            系统检测到当前边界样本与历史记录高度相似。为避免给出假稳定结论，建议挂起此任务，等待现场老师人工确认后再继续处理。
          </p>
          <div className="p-3 bg-[#0d1117] rounded border border-[#4a5568]">
            <p className="text-xs text-[#718096]">
              <span className="text-[#dd6b20]">●</span> 挂起后，该任务将进入
              {SUSPENDED_REASON_LABELS.duplicate_sample}队列，等待确认
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
