import React, { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Image as ImageIcon,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  Copy,
  Clock,
  Plus,
  X,
  Info,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';

export const ImportCenter: React.FC = () => {
  const {
    screenshots,
    samplingIntervals,
    loadScreenshots,
    loadSamplingIntervals,
    uploadScreenshot,
    addNotification,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'screenshots' | 'intervals'>('screenshots');
  const [isDragging, setIsDragging] = useState(false);
  const [showIntervalModal, setShowIntervalModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newInterval, setNewInterval] = useState({
    pumpId: '',
    startTime: '',
    endTime: '',
    intervalMinutes: 30,
    description: '',
  });
  const [currentBatchHashes, setCurrentBatchHashes] = useState<string[]>([]);
  const [uploadResults, setUploadResults] = useState<{fileName: string; repeatType: string; message: string}[]>([]);

  useEffect(() => {
    loadScreenshots();
    loadSamplingIntervals();
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
    );
    if (files.length === 0) {
      addNotification('error', '请选择图片文件');
      return;
    }

    setUploadResults([]);
    const batchHashes: string[] = [];
    
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fileHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      
      const result = await uploadScreenshot(file, batchHashes);
      if (result) {
        const repeatType = (result as any).repeatType || 'new';
        const message = (result as any).duplicateCheckResult?.message || 
          (repeatType === 'new' ? '新记录导入成功' : '重复记录已处理');
        
        setUploadResults(prev => [...prev, {
          fileName: file.name,
          repeatType,
          message,
        }]);
      }
      
      batchHashes.push(fileHash);
      setCurrentBatchHashes([...batchHashes]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setUploadResults([]);
    const batchHashes: string[] = [];
    
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fileHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      
      const result = await uploadScreenshot(file, batchHashes);
      if (result) {
        const repeatType = (result as any).repeatType || 'new';
        const message = (result as any).duplicateCheckResult?.message || 
          (repeatType === 'new' ? '新记录导入成功' : '重复记录已处理');
        
        setUploadResults(prev => [...prev, {
          fileName: file.name,
          repeatType,
          message,
        }]);
      }
      
      batchHashes.push(fileHash);
      setCurrentBatchHashes([...batchHashes]);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreateInterval = async () => {
    if (!newInterval.pumpId || !newInterval.startTime || !newInterval.endTime) {
      addNotification('error', '请填写完整信息');
      return;
    }

    try {
      const res = await fetch('/api/sampling-intervals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newInterval,
          creator: 'user-1',
        }),
      });
      if (res.ok) {
        addNotification('success', '采样间隔说明已创建');
        setShowIntervalModal(false);
        setNewInterval({
          pumpId: '',
          startTime: '',
          endTime: '',
          intervalMinutes: 30,
          description: '',
        });
        loadSamplingIntervals();
      }
    } catch (error) {
      addNotification('error', '创建失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">数据导入中心</h1>
          <p className="text-slate-400 text-sm">
            导入维修群截图和采样间隔说明，智能去重不翻倍
          </p>
        </div>
        {activeTab === 'intervals' && (
          <button
            onClick={() => setShowIntervalModal(true)}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建采样间隔
          </button>
        )}
      </div>

      <div className="flex gap-2 p-1 bg-slate-900/50 rounded-xl border border-slate-800 w-fit">
        <button
          onClick={() => setActiveTab('screenshots')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
            activeTab === 'screenshots'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          )}
        >
          <ImageIcon className="w-4 h-4" />
          维修群截图 ({screenshots.length})
        </button>
        <button
          onClick={() => setActiveTab('intervals')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
            activeTab === 'intervals'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          )}
        >
          <FileSpreadsheet className="w-4 h-4" />
          采样间隔说明 ({samplingIntervals.length})
        </button>
      </div>

      {activeTab === 'screenshots' && (
        <div className="space-y-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 group',
              isDragging
                ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
                : 'border-slate-700 hover:border-slate-600 bg-slate-900/30 hover:bg-slate-900/50'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <div
              className={cn(
                'w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-all',
                isDragging
                  ? 'bg-cyan-500/30'
                  : 'bg-slate-800 group-hover:bg-slate-700'
              )}
            >
              <Upload
                className={cn(
                  'w-8 h-8 transition-all',
                  isDragging ? 'text-cyan-400 scale-110' : 'text-slate-400'
                )}
              />
            </div>
            <h3 className="text-lg font-medium mb-2">拖拽维修群截图到此处</h3>
            <p className="text-sm text-slate-400 mb-4">
              支持 JPG、PNG 格式，系统自动检测重复，不会创建重复计算任务
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg text-sm">
              <Info className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-300">点击选择文件</span>
            </div>

            {isDragging && (
              <div className="absolute inset-0 bg-cyan-500/5 rounded-2xl flex items-center justify-center pointer-events-none">
                <div className="text-cyan-300 font-medium">松开鼠标上传</div>
              </div>
            )}
          </div>

          {uploadResults.length > 0 && (
            <div className="p-4 bg-slate-900/50 border border-slate-700 rounded-xl">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-cyan-400" />
                本次导入结果
              </h4>
              <div className="space-y-2">
                {uploadResults.map((result, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg text-sm',
                      result.repeatType === 'new' && 'bg-emerald-500/10 border border-emerald-500/20',
                      result.repeatType === 'current_batch' && 'bg-amber-500/10 border border-amber-500/20',
                      result.repeatType === 'historical' && 'bg-purple-500/10 border border-purple-500/20'
                    )}
                  >
                    <div className="shrink-0 mt-0.5">
                      {result.repeatType === 'new' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                      {result.repeatType === 'current_batch' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                      {result.repeatType === 'historical' && <Copy className="w-4 h-4 text-purple-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{result.fileName}</span>
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full shrink-0',
                          result.repeatType === 'new' && 'bg-emerald-500/20 text-emerald-300',
                          result.repeatType === 'current_batch' && 'bg-amber-500/20 text-amber-300',
                          result.repeatType === 'historical' && 'bg-purple-500/20 text-purple-300'
                        )}>
                          {result.repeatType === 'new' && '新记录'}
                          {result.repeatType === 'current_batch' && '本次重复'}
                          {result.repeatType === 'historical' && '历史重复'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{result.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-300">智能去重机制</p>
              <p className="text-sm text-slate-400 mt-1">
                系统通过文件哈希值检测重复截图。重复导入同一批截图时，仅记录上传记录，
                <span className="text-amber-300">不会新增"泵站汽蚀风险计算"数量</span>，
                避免数据膨胀。
              </p>
              <div className="flex gap-4 mt-2 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="text-slate-400">新记录：首次导入</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span className="text-slate-400">本次重复：同一批次重复</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  <span className="text-slate-400">历史重复：与历史文件重复</span>
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold">已导入截图</h3>
            {screenshots.length === 0 ? (
              <div className="text-center py-16 text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800">
                <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>暂无截图</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {screenshots.map((shot) => (
                  <div
                    key={shot.id}
                    className={cn(
                      'rounded-xl border overflow-hidden transition-all group',
                      shot.status === 'duplicate'
                        ? 'bg-purple-500/5 border-purple-500/20'
                        : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                    )}
                  >
                    <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 relative">
                      {shot.status === 'duplicate' && (
                        <div className="absolute inset-0 bg-purple-900/60 backdrop-blur-sm flex items-center justify-center z-10">
                          <div className="text-center">
                            <Copy className="w-8 h-8 mx-auto mb-2 text-purple-300" />
                            <p className="text-sm text-purple-300 font-medium">重复截图</p>
                          </div>
                        </div>
                      )}
                      {shot.imageUrl ? (
                        <img
                          src={shot.imageUrl}
                          alt={shot.fileName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML = `
                              <div class="w-full h-full flex items-center justify-center">
                                <div class="text-center">
                                  <div class="w-12 h-12 mx-auto mb-2 rounded-xl bg-slate-700/50 flex items-center justify-center">
                                    <svg class="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                  <p class="text-xs text-slate-500 px-4 break-all">${shot.fileName}</p>
                                </div>
                              </div>
                            `;
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-10 h-10 text-slate-600" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-medium truncate flex-1">{shot.fileName}</p>
                        <StatusBadge status={shot.status} size="sm" />
                      </div>
                      {shot.extractedData && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-500">压力</span>
                            <p className="text-slate-300 font-mono">{shot.extractedData.pressure} MPa</p>
                          </div>
                          <div>
                            <span className="text-slate-500">流量</span>
                            <p className="text-slate-300 font-mono">{shot.extractedData.flowRate} m³/h</p>
                          </div>
                        </div>
                      )}
                      <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                        <span>{new Date(shot.uploadTime).toLocaleDateString('zh-CN')}</span>
                        {shot.calculationIds.length > 0 && (
                          <span>关联 {shot.calculationIds.length} 个计算</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'intervals' && (
        <div className="space-y-4">
          <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-start gap-3">
            <Clock className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-cyan-300">采样间隔说明</p>
              <p className="text-sm text-slate-400 mt-1">
                实验老师林老师补看采样间隔说明后，系统自动核对采样时间完整性。
                发现缺失半小时以上时，<span className="text-cyan-300">自动流转至质检员复核</span>。
              </p>
            </div>
          </div>

          {samplingIntervals.length === 0 ? (
            <div className="text-center py-16 text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="mb-4">暂无采样间隔说明</p>
              <button
                onClick={() => setShowIntervalModal(true)}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg text-sm font-medium inline-flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                新建采样间隔
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {samplingIntervals.map((interval) => (
                <div
                  key={interval.id}
                  className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-medium mb-1">{interval.pumpId}</h4>
                      <p className="text-sm text-slate-400">{interval.description}</p>
                    </div>
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
                      v{interval.version}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-slate-500">开始时间</span>
                      <p className="text-slate-200">
                        {new Date(interval.startTime).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">结束时间</span>
                      <p className="text-slate-200">
                        {new Date(interval.endTime).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">采样间隔</span>
                      <p className="text-slate-200">每 {interval.intervalMinutes} 分钟</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">关联计算</span>
                      <p className="text-slate-200">{interval.calculationIds.length} 个</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showIntervalModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="w-full max-w-lg bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-lg font-semibold">新建采样间隔说明</h3>
              <button
                onClick={() => setShowIntervalModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">泵站编号</label>
                <input
                  type="text"
                  value={newInterval.pumpId}
                  onChange={(e) => setNewInterval({ ...newInterval, pumpId: e.target.value })}
                  placeholder="例如：pump-a01"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">开始时间</label>
                  <input
                    type="datetime-local"
                    value={newInterval.startTime}
                    onChange={(e) => setNewInterval({ ...newInterval, startTime: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">结束时间</label>
                  <input
                    type="datetime-local"
                    value={newInterval.endTime}
                    onChange={(e) => setNewInterval({ ...newInterval, endTime: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">采样间隔（分钟）</label>
                <input
                  type="number"
                  value={newInterval.intervalMinutes}
                  onChange={(e) => setNewInterval({ ...newInterval, intervalMinutes: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">说明</label>
                <textarea
                  value={newInterval.description}
                  onChange={(e) => setNewInterval({ ...newInterval, description: e.target.value })}
                  placeholder="描述本次采样的背景和特殊说明"
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-800">
              <button
                onClick={() => setShowIntervalModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateInterval}
                className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg text-sm font-medium transition-colors"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
