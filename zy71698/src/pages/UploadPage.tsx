import React, { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Upload,
  FileText,
  Music,
  MessageSquare,
  ListChecks,
  StickyNote,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  Info,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { readFileAsText, formatFileSize } from '@/utils/helpers';
import { MATERIAL_TYPE_LABELS, MATERIAL_TYPE_COLORS, type MaterialType } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

const materialConfig: Record<MaterialType, { icon: React.ReactNode; color: string; description: string }> = {
  timeline: {
    icon: <Clock size={24} />,
    color: 'track-timeline',
    description: '导演剪辑版时间轴，包含Cue点的入点出点',
  },
  dialog: {
    icon: <MessageSquare size={24} />,
    color: 'track-dialog',
    description: '对白轨时间码，用于检测对白与音乐的重叠',
  },
  music: {
    icon: <Music size={24} />,
    color: 'track-music',
    description: '音乐文件清单，包含每首音乐的起止时间',
  },
  cue: {
    icon: <ListChecks size={24} />,
    color: 'track-cue',
    description: 'Cue清单，音乐部门提供的配乐列表',
  },
  note: {
    icon: <StickyNote size={24} />,
    color: 'track-note',
    description: '导演备注，包含对音乐的具体要求',
  },
};

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: projectId } = useParams<{ id: string }>();
  const {
    getProjectMaterials,
    addMaterial,
    removeMaterial,
    parseAllMaterials,
    isLoading,
    setCurrentProject,
  } = useAppStore();
  const [dragOverType, setDragOverType] = useState<MaterialType | null>(null);

  React.useEffect(() => {
    if (projectId) {
      setCurrentProject(projectId);
    }
  }, [projectId, setCurrentProject]);

  const materials = projectId ? getProjectMaterials(projectId) : [];

  const handleFileUpload = useCallback(async (type: MaterialType, files: FileList | null) => {
    if (!projectId || !files || files.length === 0) return;

    const file = files[0];
    try {
      const content = await readFileAsText(file);
      await addMaterial(projectId, type, file, content);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '文件读取失败';
      alert(`上传失败：${errorMessage}`);
    }
  }, [projectId, addMaterial]);

  const handleParseAll = async () => {
    if (!projectId) return;
    await parseAllMaterials(projectId);
  };

  const handleGoToProcess = () => {
    if (!projectId) return;
    navigate(`/project/${projectId}/process`);
  };

  const getMaterialOfType = (type: MaterialType) => materials.filter(m => m.type === type);

  const allParsed = materials.length > 0 && materials.every(m => m.parseStatus === 'success');
  const hasAnyParsed = materials.some(m => m.parseStatus === 'success');

  return (
    <div className="min-h-full p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">材料上传与解析</h2>
          <p className="text-text-muted">
            上传剪辑时间轴、对白轨、音乐文件、Cue清单和导演备注，系统将自动解析并核对数据一致性
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          {(Object.keys(MATERIAL_TYPE_LABELS) as MaterialType[]).map(type => {
            const config = materialConfig[type];
            const typeMaterials = getMaterialOfType(type);
            const hasMaterial = typeMaterials.length > 0;
            const isDragOver = dragOverType === type;

            return (
              <div
                key={type}
                className={cn(
                  'card transition-all',
                  isDragOver && 'ring-2 ring-accent-success ring-offset-2 ring-offset-bg-primary'
                )}
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', `bg-${config.color}/20`)}>
                    <div className={cn(`text-${config.color}`)}>{config.icon}</div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{MATERIAL_TYPE_LABELS[type]}</h3>
                    <p className="text-sm text-text-muted">{config.description}</p>
                  </div>
                </div>

                {!hasMaterial ? (
                  <div
                    onDragOver={e => {
                      e.preventDefault();
                      setDragOverType(type);
                    }}
                    onDragLeave={() => setDragOverType(null)}
                    onDrop={e => {
                      e.preventDefault();
                      setDragOverType(null);
                      handleFileUpload(type, e.dataTransfer.files);
                    }}
                    className="border-2 border-dashed border-bg-tertiary rounded-lg p-6 text-center hover:border-accent-success/50 transition-colors cursor-pointer"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.txt,.csv,.xml,.json';
                      input.onchange = e => handleFileUpload(type, (e.target as HTMLInputElement).files);
                      input.click();
                    }}
                  >
                    <Upload className="mx-auto text-text-muted mb-2" size={24} />
                    <p className="text-sm text-text-primary mb-1">拖拽文件到此处</p>
                    <p className="text-xs text-text-muted">或点击选择文件</p>
                    <p className="text-xs text-text-muted mt-2">支持 TXT, CSV, XML, JSON</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {typeMaterials.map(mat => (
                      <div key={mat.id} className="bg-bg-tertiary rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{mat.fileName}</p>
                            <p className="text-xs text-text-muted">
                              {mat.fileFormat?.toUpperCase()} · {formatFileSize(mat.fileSize)}
                            </p>
                          </div>
                          <button
                            onClick={() => removeMaterial(mat.id)}
                            className="p-1 hover:bg-bg-secondary rounded transition-colors flex-shrink-0"
                          >
                            <X size={16} className="text-text-muted" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <StatusBadge status={mat.parseStatus}>
                            {mat.parseStatus === 'pending' && '待解析'}
                            {mat.parseStatus === 'parsing' && '解析中'}
                            {mat.parseStatus === 'success' && '解析成功'}
                            {mat.parseStatus === 'failed' && '解析失败'}
                          </StatusBadge>
                          {mat.parsedData?.cuePoints && (
                            <span className="text-xs text-text-muted">
                              {mat.parsedData.cuePoints.length} 个Cue
                            </span>
                          )}
                        </div>

                        {mat.parseErrors.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {mat.parseErrors.slice(0, 3).map(err => (
                              <div key={err.id} className="bg-accent-error/10 border border-accent-error/30 rounded p-2">
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="text-accent-error flex-shrink-0 mt-0.5" size={14} />
                                  <div className="text-xs">
                                    <p className="text-accent-error font-medium">{err.detectionStep}</p>
                                    <p className="text-text-primary mt-0.5">{err.friendlyMessage}</p>
                                    <p className="text-text-muted mt-0.5">{err.suggestion}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {mat.parseErrors.length > 3 && (
                              <p className="text-xs text-text-muted text-center">
                                还有 {mat.parseErrors.length - 3} 个错误
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    <button
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.txt,.csv,.xml,.json';
                        input.onchange = e => handleFileUpload(type, (e.target as HTMLInputElement).files);
                        input.click();
                      }}
                      className="w-full text-sm text-text-muted hover:text-text-primary transition-colors py-2"
                    >
                      + 添加更多文件
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between bg-bg-secondary rounded-lg p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {materials.length > 0 ? (
                <>
                  {allParsed ? (
                    <CheckCircle2 className="text-accent-success" size={20} />
                  ) : hasAnyParsed ? (
                    <AlertCircle className="text-accent-warning" size={20} />
                  ) : (
                    <Clock className="text-text-muted" size={20} />
                  )}
                  <span className="text-sm">
                    已上传 {materials.length} 份材料
                    {allParsed && '，全部解析成功'}
                    {hasAnyParsed && !allParsed && '，部分材料需要注意'}
                  </span>
                </>
              ) : (
                <>
                  <Info className="text-text-muted" size={20} />
                  <span className="text-sm text-text-muted">请至少上传一份材料开始核对</span>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleParseAll}
              disabled={materials.length === 0 || isLoading}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? '解析中...' : '解析全部材料'}
            </button>
            <button
              onClick={handleGoToProcess}
              disabled={!hasAnyParsed}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Play size={16} />
              开始核对
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
