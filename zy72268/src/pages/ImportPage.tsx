import React, { useCallback, useState } from 'react';
import { Upload, FileText, Database, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';

export const ImportPage: React.FC = () => {
  const {
    currentSketch,
    pointCloudLogs,
    isLoading,
    importFloorSketch,
    importPointCloudLog,
  } = useAppStore();

  const [dragActive1, setDragActive1] = useState(false);
  const [dragActive2, setDragActive2] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSketchDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive1(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handlePcDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive2(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleSketchDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive1(false);
    setError(null);
    setSuccess(null);

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/json') {
      try {
        await importFloorSketch(files[0]);
        setSuccess('楼层剖面草图导入成功！');
        setTimeout(() => setSuccess(null), 3000);
      } catch {
        setError('导入失败，请检查文件格式');
      }
    } else {
      setError('请上传JSON格式的文件');
    }
  }, [importFloorSketch]);

  const handlePcDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive2(false);
    setError(null);
    setSuccess(null);

    if (!currentSketch) {
      setError('请先导入楼层剖面草图');
      return;
    }

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/json') {
      try {
        await importPointCloudLog(currentSketch.id, files[0]);
        setSuccess('点云抽稀日志补录成功！');
        setTimeout(() => setSuccess(null), 3000);
      } catch {
        setError('导入失败，请检查文件格式');
      }
    } else {
      setError('请上传JSON格式的文件');
    }
  }, [currentSketch, importPointCloudLog]);

  const handleSketchFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setError(null);
      setSuccess(null);
      try {
        await importFloorSketch(file);
        setSuccess('楼层剖面草图导入成功！');
        setTimeout(() => setSuccess(null), 3000);
      } catch {
        setError('导入失败，请检查文件格式');
      }
    }
  }, [importFloorSketch]);

  const handlePcFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!currentSketch) {
        setError('请先导入楼层剖面草图');
        return;
      }
      setError(null);
      setSuccess(null);
      try {
        await importPointCloudLog(currentSketch.id, file);
        setSuccess('点云抽稀日志补录成功！');
        setTimeout(() => setSuccess(null), 3000);
      } catch {
        setError('导入失败，请检查文件格式');
      }
    }
  }, [currentSketch, importPointCloudLog]);

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-100 mb-2">数据导入</h1>
          <p className="text-zinc-500">
            导入楼层剖面草图和点云抽稀日志，系统将自动检测冲突
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3 text-green-400">
            <CheckCircle size={20} />
            <span>{success}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            onDragEnter={handleSketchDrag}
            onDragLeave={handleSketchDrag}
            onDragOver={handleSketchDrag}
            onDrop={handleSketchDrop}
            className={cn(
              'relative p-8 border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer',
              dragActive1
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-600'
            )}
          >
            <input
              type="file"
              accept=".json"
              onChange={handleSketchFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 flex items-center justify-center">
                {isLoading ? (
                  <Loader2 size={28} className="text-blue-400 animate-spin" />
                ) : (
                  <FileText size={28} className="text-blue-400" />
                )}
              </div>
              <h3 className="text-lg font-semibold mb-2">楼层剖面草图</h3>
              <p className="text-sm text-zinc-500 mb-4">
                拖拽或点击上传 JSON 格式的草图数据
              </p>
              <div className="text-xs text-zinc-600">
                支持格式：.json
              </div>
            </div>
          </div>

          <div
            onDragEnter={handlePcDrag}
            onDragLeave={handlePcDrag}
            onDragOver={handlePcDrag}
            onDrop={handlePcDrop}
            className={cn(
              'relative p-8 border-2 border-dashed rounded-xl transition-all duration-200',
              !currentSketch && 'opacity-50 cursor-not-allowed',
              dragActive2
                ? 'border-orange-500 bg-orange-500/10 cursor-pointer'
                : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-600 cursor-pointer'
            )}
          >
            <input
              type="file"
              accept=".json"
              onChange={handlePcFileInput}
              disabled={!currentSketch}
              className={cn(
                'absolute inset-0 w-full h-full opacity-0',
                currentSketch ? 'cursor-pointer' : 'cursor-not-allowed'
              )}
            />
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-500/10 flex items-center justify-center">
                {isLoading ? (
                  <Loader2 size={28} className="text-orange-400 animate-spin" />
                ) : (
                  <Database size={28} className="text-orange-400" />
                )}
              </div>
              <h3 className="text-lg font-semibold mb-2">点云抽稀日志</h3>
              <p className="text-sm text-zinc-500 mb-4">
                {currentSketch ? '拖拽或点击上传补录数据' : '请先导入楼层剖面草图'}
              </p>
              <div className="text-xs text-zinc-600">
                支持格式：.json
              </div>
            </div>
          </div>
        </div>

        {currentSketch && (
          <div className="mt-8 p-6 bg-zinc-900 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-3 mb-4">
              <Upload size={20} className="text-blue-400" />
              <h3 className="font-semibold">已导入数据</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <p className="text-xs text-zinc-500 mb-1">草图名称</p>
                <p className="font-medium text-zinc-200">{currentSketch.name}</p>
              </div>
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <p className="text-xs text-zinc-500 mb-1">楼层</p>
                <p className="font-medium text-zinc-200">{currentSketch.floor}</p>
              </div>
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <p className="text-xs text-zinc-500 mb-1">障碍物数量</p>
                <p className="font-medium text-zinc-200">{currentSketch.obstacles?.length || 0}</p>
              </div>
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <p className="text-xs text-zinc-500 mb-1">点云日志</p>
                <p className="font-medium text-zinc-200">{pointCloudLogs.length} 份</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 p-6 bg-zinc-900/50 rounded-xl border border-zinc-800">
          <h3 className="font-semibold mb-4 text-zinc-300">三步标准流程</h3>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center text-blue-400 font-bold text-sm">
              1
            </div>
            <div className="flex-1">
              <p className="font-medium text-zinc-200">导入楼层剖面草图</p>
              <p className="text-sm text-zinc-500">上传包含障碍物标注的楼层剖面JSON文件</p>
            </div>
          </div>
          <div className="my-2 ml-4 w-px h-6 bg-zinc-700" />
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/50 flex items-center justify-center text-orange-400 font-bold text-sm">
              2
            </div>
            <div className="flex-1">
              <p className="font-medium text-zinc-200">补看点云抽稀日志</p>
              <p className="text-sm text-zinc-500">上传点云处理日志，系统自动比对检测冲突</p>
            </div>
          </div>
          <div className="my-2 ml-4 w-px h-6 bg-zinc-700" />
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center text-green-400 font-bold text-sm">
              3
            </div>
            <div className="flex-1">
              <p className="font-medium text-zinc-200">三维视图更新</p>
              <p className="text-sm text-zinc-500">查看冲突标记，确认或驳回后等待学员复核</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
