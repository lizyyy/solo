import React, { useState, useRef } from 'react';
import { Upload, FileText, FileWarning, Hash, AlertTriangle, CheckCircle2, Edit3, History, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Material, MaterialType, DiffChunk } from '@/types';
import { MATERIAL_TYPE_LABELS, SUSPENDED_REASON_LABELS } from '@/types';
import { shortHash } from '@/utils/hash';
import { versionHashService } from '@/services/versionHash';
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
  onUpdateMaterial?: (
    materialId: string,
    newContent: string,
    operator?: string
  ) => Promise<{ material: Material; hasCaliberChanged: boolean } | null>;
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
  onUpdateMaterial,
  onCreateSuspendedTask,
  disabled,
}) => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVersionHistoryModal, setShowVersionHistoryModal] = useState(false);
  const [selectedType, setSelectedType] = useState<MaterialType | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [uploadContent, setUploadContent] = useState('');
  const [uploadName, setUploadName] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [showCaliberWarning, setShowCaliberWarning] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    similarity: number;
    existingSessionId: string;
  } | null>(null);
  const [caliberChangeInfo, setCaliberChangeInfo] = useState<{
    materialId: string;
    diff: DiffChunk[];
  } | null>(null);
  const [selectedVersionIndex, setSelectedVersionIndex] = useState<number>(0);
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

  const handleEditStart = (material: Material) => {
    setSelectedMaterial(material);
    setEditContent(material.content);
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (!selectedMaterial || !onUpdateMaterial || !editContent.trim()) return;

    setIsEditing(true);
    try {
      const result = await onUpdateMaterial(selectedMaterial.id, editContent, '现场老师');
      
      if (result && result.hasCaliberChanged) {
        const diff = versionHashService.compareVersions(selectedMaterial.content, editContent);
        setCaliberChangeInfo({
          materialId: selectedMaterial.id,
          diff,
        });
        setShowCaliberWarning(true);
      }

      setShowEditModal(false);
      setSelectedMaterial(null);
      setEditContent('');
    } finally {
      setIsEditing(false);
    }
  };

  const handleViewVersionHistory = (material: Material) => {
    setSelectedMaterial(material);
    setSelectedVersionIndex(material.versions.length - 1);
    setShowVersionHistoryModal(true);
  };

  const handleSuspendDuplicate = async () => {
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

  const handleSuspendCaliberChange = async () => {
    if (!caliberChangeInfo) return;

    await onCreateSuspendedTask(sessionId, 'caliber_change', {
      materialId: caliberChangeInfo.materialId,
      diff: caliberChangeInfo.diff,
    });

    setShowCaliberWarning(false);
    setCaliberChangeInfo(null);
  };

  const formatVersionDiff = (material: Material, versionIndex: number): string => {
    if (versionIndex === 0) return material.versions[0].content;
    return versionHashService.getVersionDiff(material, versionIndex);
  };

  const getMaterialsByType = (type: MaterialType) => {
    return materials.filter((m) => m.type === type);
  };

  const renderDiffContent = (content: string): React.ReactNode => {
    return content.split('\n').map((line, i) => (
      <div
        key={i}
        className={cn(
          'font-mono text-sm px-2 py-0.5',
          line.startsWith('[+') ? 'bg-[#276749]/20 text-[#68d391]' :
          line.startsWith('[-') ? 'bg-[#c53030]/20 text-[#fc8181]' :
          line.startsWith('[*') ? 'bg-[#dd6b20]/20 text-[#fbd38d]' :
          'text-[#a0aec0]'
        )}
      >
        {line}
      </div>
    ));
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
                              <span className="mx-1">·</span>
                              {new Date(material.updatedAt).toLocaleString('zh-CN')}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Tooltip content="查看版本历史">
                              <button
                                onClick={() => handleViewVersionHistory(material)}
                                className="p-1.5 hover:bg-[#2d3748] rounded transition-colors"
                                disabled={disabled}
                              >
                                <History className="w-3.5 h-3.5 text-[#718096]" />
                              </button>
                            </Tooltip>
                            {onUpdateMaterial && (
                              <Tooltip content="编辑材料">
                                <button
                                  onClick={() => handleEditStart(material)}
                                  className="p-1.5 hover:bg-[#2d3748] rounded transition-colors"
                                  disabled={disabled}
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-[#718096]" />
                                </button>
                              </Tooltip>
                            )}
                            <CheckCircle2 className="w-4 h-4 text-[#38a169] flex-shrink-0" />
                          </div>
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
        isOpen={showEditModal}
        onClose={() => !isEditing && setShowEditModal(false)}
        title="编辑材料内容"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowEditModal(false)}
              disabled={isEditing}
            >
              取消
            </Button>
            <Button
              variant="primary"
              onClick={handleEditSave}
              loading={isEditing}
              disabled={!editContent.trim() || editContent === selectedMaterial?.content}
            >
              保存修改
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {selectedMaterial && (
            <>
              <div className="p-3 bg-[#dd6b20]/10 border border-[#dd6b20]/30 rounded">
                <div className="flex items-center gap-2 text-sm text-[#dd6b20]">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-mono">修改材料内容将自动检测口径变更</span>
                </div>
                <p className="text-xs text-[#a0aec0] mt-1">
                  如果系统检测到内容有显著变化（超过10%），将自动挂起任务等待人工确认
                </p>
              </div>
              <div>
                <label className="block text-sm font-mono text-[#a0aec0] mb-2">
                  材料名称: {selectedMaterial.name}
                </label>
                <label className="block text-sm font-mono text-[#a0aec0] mb-2">
                  当前版本: v{selectedMaterial.version}
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="在此编辑材料内容..."
                  className="w-full h-64 px-3 py-2 bg-[#0d1117] border border-[#4a5568] rounded font-mono text-sm text-[#e2e8f0] focus:outline-none focus:border-[#dd6b20] resize-none"
                />
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showVersionHistoryModal}
        onClose={() => setShowVersionHistoryModal(false)}
        title="版本历史记录"
        size="lg"
      >
        <div className="space-y-4">
          {selectedMaterial && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <span className="font-mono text-sm text-[#e2e8f0]">{selectedMaterial.name}</span>
                <span className="text-xs text-[#718096]">
                  共 {selectedMaterial.versions.length} 个版本
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {selectedMaterial.versions.map((version, index) => (
                  <button
                    key={version.id}
                    onClick={() => setSelectedVersionIndex(index)}
                    className={cn(
                      'px-3 py-1 rounded text-xs font-mono transition-colors',
                      selectedVersionIndex === index
                        ? 'bg-[#3182ce] text-white'
                        : 'bg-[#2d3748] text-[#a0aec0] hover:bg-[#4a5568]'
                    )}
                  >
                    v{version.version}
                    {index === selectedMaterial.versions.length - 1 && ' (最新)'}
                  </button>
                ))}
              </div>

              <div className="p-3 bg-[#0d1117] rounded border border-[#4a5568]">
                <div className="flex items-center justify-between mb-2 text-xs text-[#718096]">
                  <span>版本 v{selectedMaterial.versions[selectedVersionIndex].version}</span>
                  <span>
                    {new Date(selectedMaterial.versions[selectedVersionIndex].timestamp).toLocaleString('zh-CN')}
                  </span>
                </div>
                <div className="max-h-64 overflow-auto">
                  {renderDiffContent(formatVersionDiff(selectedMaterial, selectedVersionIndex))}
                </div>
              </div>

              {selectedVersionIndex > 0 && (
                <div className="p-3 bg-[#dd6b20]/10 border border-[#dd6b20]/30 rounded">
                  <div className="text-xs font-mono text-[#dd6b20] mb-1">变更说明</div>
                  <p className="text-xs text-[#a0aec0]">
                    该版本相对于上一版本有 {selectedMaterial.versions[selectedVersionIndex].diff.length} 处修改
                  </p>
                </div>
              )}
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
            <Button variant="warning" onClick={handleSuspendDuplicate}>
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

      <Modal
        isOpen={showCaliberWarning}
        onClose={() => setShowCaliberWarning(false)}
        title="检测到口径变更"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCaliberWarning(false)}>
              忽略继续
            </Button>
            <Button variant="warning" onClick={handleSuspendCaliberChange}>
              挂起等待确认
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-[#dd6b20]/10 border border-[#dd6b20]/50 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-[#dd6b20] flex-shrink-0" />
            <div>
              <p className="font-mono text-[#e2e8f0]">检测到材料口径变更</p>
              <p className="text-sm text-[#a0aec0] mt-1">
                该材料内容发生显著变化，可能影响复核结论的准确性
              </p>
            </div>
          </div>
          <p className="text-sm text-[#a0aec0]">
            系统检测到该材料的新版本与历史版本相比，内容变化超过10%的阈值。为确保复核结论的准确性，建议挂起任务等待人工确认口径变更的合理性。
          </p>
          <div className="p-3 bg-[#0d1117] rounded border border-[#4a5568] max-h-32 overflow-auto">
            <p className="text-xs text-[#718096] mb-2">变更摘要:</p>
            {caliberChangeInfo && renderDiffContent(versionHashService.formatDiff(caliberChangeInfo.diff))}
          </div>
          <div className="p-3 bg-[#0d1117] rounded border border-[#4a5568]">
            <p className="text-xs text-[#718096]">
              <span className="text-[#dd6b20]">●</span> 挂起后，该任务将进入
              {SUSPENDED_REASON_LABELS.caliber_change}队列，等待确认
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
