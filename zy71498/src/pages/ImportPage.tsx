import { useState, useCallback, useEffect } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Plus,
  Edit3,
  Minus,
  Download,
  History,
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import LoadingSpinner from '@/components/LoadingSpinner';
import { ChangeTypeBadge, EmotionTagBadge } from '@/components/StatusBadge';
import { useAppStore, importData, fetchImportBatches } from '@/store';
import type { Track, ImportBatch } from '@/../shared/types';
import { cn } from '@/lib/utils';

export default function ImportPage() {
  const [dragOver, setDragOver] = useState(false);
  const [operator, setOperator] = useState('运营专员');
  const { importPreview, loading, importBatches } = useAppStore();

  useEffect(() => {
    fetchImportBatches();
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    if (file) {
      await importData(file, operator);
    }
  }, [operator]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    onDragEnter: () => setDragOver(true),
    onDragLeave: () => setDragOver(false),
    onDropAccepted: () => setDragOver(false),
    onDropRejected: () => setDragOver(false),
  });

  const previewGroups = importPreview ? [
    { key: 'new' as const, label: '新增曲目', icon: Plus, color: 'emerald-green', data: importPreview.new },
    { key: 'updated' as const, label: '更新曲目', icon: Edit3, color: 'neon-purple', data: importPreview.updated },
    { key: 'unchanged' as const, label: '无变化', icon: Minus, color: 'deep-blue-400', data: importPreview.unchanged },
  ] : [];

  const downloadTemplate = () => {
    const templateContent = [
      ['trackId', 'title', 'artist', 'album', 'algorithmTags', 'manualTags', 'copyrightStatus', 'isRecommended'],
      ['TRK000001', '夜曲', '周杰伦', '十一月的萧邦', 'sad,nostalgic,calm', 'sad,romantic', 'active', 'true'],
      ['TRK000002', '稻香', '周杰伦', '魔杰座', 'happy,hopeful', 'happy,calm,hopeful', 'active', 'false'],
    ];
    const csvContent = templateContent.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '情绪标签导入模板.csv';
    link.click();
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="mb-8 animate-fade-in">
        <h1 className="font-display text-3xl font-bold text-white mb-2">数据导入</h1>
        <p className="text-deep-blue-300">上传曲库情绪标签数据，系统自动识别重复提交和冲突</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <div className="card p-6 animate-stagger">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-semibold text-white text-lg">上传文件</h2>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 text-sm text-neon-purple-400 hover:text-neon-purple-300 transition-colors"
              >
                <Download className="w-4 h-4" />
                下载模板
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-deep-blue-300 mb-2">操作人</label>
              <input
                type="text"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="input-field"
                placeholder="请输入操作人姓名"
              />
            </div>

            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 cursor-pointer',
                isDragActive || dragOver
                  ? 'border-neon-purple-500 bg-neon-purple-500/10'
                  : 'border-deep-blue-400/30 hover:border-deep-blue-400/50 bg-deep-blue-600/20'
              )}
            >
              <input {...getInputProps()} />
              {loading.import ? (
                <div className="flex flex-col items-center">
                  <LoadingSpinner size="lg" className="mb-4" />
                  <p className="text-deep-blue-200">正在解析数据...</p>
                </div>
              ) : (
                <>
                  <div className={cn(
                    'w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center transition-colors',
                    isDragActive ? 'bg-neon-purple-500/20' : 'bg-deep-blue-500/30'
                  )}>
                    <Upload className={cn(
                      'w-8 h-8 transition-colors',
                      isDragActive ? 'text-neon-purple-400' : 'text-deep-blue-300'
                    )} />
                  </div>
                  <p className="text-lg text-white mb-2">
                    {isDragActive ? '释放以上传文件' : '拖拽文件到此处，或点击选择'}
                  </p>
                  <p className="text-sm text-deep-blue-400">
                    支持 CSV、Excel (.xlsx, .xls) 格式
                  </p>
                </>
              )}
            </div>

            <div className="mt-4 flex items-start gap-2 p-4 bg-amber-yellow-500/10 border border-amber-yellow-500/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-yellow-200">
                <p className="font-medium mb-1">导入说明</p>
                <ul className="list-disc list-inside space-y-1 text-amber-yellow-200/80">
                  <li>系统将自动检测重复提交的曲目，区分新增、更新、无变化</li>
                  <li>标签不一致或版权下架仍推荐的曲目将标记为冲突</li>
                  <li>人工标签将作为补充证据留存，用于后续复盘</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-6 animate-stagger" style={{ animationDelay: '100ms' }}>
          <h2 className="font-display font-semibold text-white text-lg mb-6 flex items-center gap-2">
            <History className="w-5 h-5 text-neon-purple-400" />
            导入历史
          </h2>
          <div className="space-y-3">
            {importBatches.length === 0 ? (
              <p className="text-deep-blue-400 text-sm text-center py-8">暂无导入记录</p>
            ) : (
              importBatches.map((batch: ImportBatch, index) => (
                <div
                  key={batch.id}
                  className="p-4 bg-deep-blue-600/30 rounded-lg border border-deep-blue-400/10"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <FileSpreadsheet className="w-5 h-5 text-neon-purple-400" />
                    <span className="font-medium text-white text-sm truncate flex-1">
                      {batch.fileName}
                    </span>
                    {batch.status === 'completed' && (
                      <CheckCircle className="w-4 h-4 text-emerald-green-400" />
                    )}
                  </div>
                  <div className="text-xs text-deep-blue-400 space-y-1">
                    <p>批次: {batch.id} | 操作人: {batch.operator}</p>
                    <p>{new Date(batch.importedAt).toLocaleString()}</p>
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-emerald-green-400">新增 {batch.newCount}</span>
                      <span className="text-neon-purple-400">更新 {batch.updatedCount}</span>
                      <span className="text-deep-blue-400">无变 {batch.unchangedCount}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {importPreview && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display font-semibold text-white text-xl flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-neon-purple-400" />
              导入预览
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-deep-blue-300">共 {importPreview.new.length + importPreview.updated.length + importPreview.unchanged.length} 条</span>
                <span className="text-emerald-green-400">新增 {importPreview.new.length}</span>
                <span className="text-neon-purple-400">更新 {importPreview.updated.length}</span>
                <span className="text-deep-blue-400">无变化 {importPreview.unchanged.length}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {previewGroups.map((group) => {
              const Icon = group.icon;
              return (
                <div key={group.key} className="card p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-lg bg-${group.color}/20`}>
                      <Icon className={`w-5 h-5 text-${group.color}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{group.label}</h3>
                      <p className="text-sm text-deep-blue-400">{group.data.length} 条</p>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {group.data.length === 0 ? (
                      <p className="text-deep-blue-400 text-sm text-center py-4">暂无数据</p>
                    ) : (
                      group.data.map((track: Track, index) => (
                        <div
                          key={track.id}
                          className="p-3 bg-deep-blue-600/30 rounded-lg border border-deep-blue-400/10 animate-fade-in-up"
                          style={{ animationDelay: `${index * 30}ms` }}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium text-white text-sm">{track.title}</p>
                              <p className="text-xs text-deep-blue-400">{track.artist} · {track.trackId}</p>
                            </div>
                            <ChangeTypeBadge changeType={group.key} />
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <span className="text-xs text-deep-blue-400 mr-1">算法:</span>
                            {track.algorithmTags.map(tag => (
                              <EmotionTagBadge key={`algo-${tag}`} emotion={tag} />
                            ))}
                          </div>
                          {track.manualTags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              <span className="text-xs text-deep-blue-400 mr-1">人工:</span>
                              {track.manualTags.map(tag => (
                                <EmotionTagBadge key={`manual-${tag}`} emotion={tag} />
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
