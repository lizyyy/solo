import { useState, useCallback } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2, FileAudio, Plus, ClipboardPaste, Trash2, Table2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useAppStore } from '@/store';
import {
  parseFileName,
  validateAudioFile,
  generateId,
  matchToChannelTable,
  detectConflicts,
  findMissingEntries,
  formatFileSize,
} from '@/utils/fileParser';
import { cn } from '@/lib/utils';
import type { Track, ImportRecord, Conflict, ChannelTableEntry } from '@/types';

interface FileItem {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'success' | 'failed';
  progress: number;
  errorReason?: string;
  parsedData?: any;
}

const BATCH_EXAMPLE = `1	夜曲	周杰伦	3:45	微信聊天记录
2	稻香	周杰伦	3:43	林老师手写
3	晴天	周杰伦	4:29	
4	七里香	周杰伦	4:59	
5	青花瓷	周杰伦	3:52	邮件附件`;

export const ImportPage = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'channel' | 'files'>('channel');

  const [newEntry, setNewEntry] = useState({ channelNo: '', trackName: '', artist: '', duration: '', source: '', note: '' });
  const [batchText, setBatchText] = useState('');
  const [showBatch, setShowBatch] = useState(false);

  const {
    channelTable,
    addChannelEntry,
    addChannelEntries,
    deleteChannelEntry,
    addTrack,
    addImportRecord,
    addConflict,
    tracks,
  } = useAppStore();

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, []);
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
    e.target.value = '';
  }, []);

  const addFiles = (newFiles: File[]) => {
    setFiles((prev) => [
      ...prev,
      ...newFiles.map((file) => ({ id: generateId(), file, status: 'pending' as const, progress: 0 })),
    ]);
  };

  const handleAddEntry = () => {
    if (!newEntry.trackName.trim()) return;
    const now = new Date().toISOString();
    addChannelEntry({
      id: generateId(),
      channelNo: newEntry.channelNo.trim(),
      trackName: newEntry.trackName.trim(),
      artist: newEntry.artist.trim() || undefined,
      duration: newEntry.duration.trim() || undefined,
      source: newEntry.source.trim() || undefined,
      note: newEntry.note.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
    setNewEntry({ channelNo: '', trackName: '', artist: '', duration: '', source: '', note: '' });
  };

  const handleBatchImport = () => {
    const lines = batchText.trim().split('\n').filter((l) => l.trim());
    const entries: ChannelTableEntry[] = [];
    const now = new Date().toISOString();
    for (const line of lines) {
      const parts = line.split(/[\t,，]/).map((s) => s.trim());
      if (parts.length < 2) continue;
      entries.push({
        id: generateId(),
        channelNo: parts[0] || '',
        trackName: parts[1] || '',
        artist: parts[2] || undefined,
        duration: parts[3] || undefined,
        source: parts[4] || undefined,
        note: parts[5] || undefined,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (entries.length > 0) {
      addChannelEntries(entries);
      setBatchText('');
      setShowBatch(false);
    }
  };

  const processFiles = async () => {
    if (files.length === 0 || isProcessing) return;
    setIsProcessing(true);

    const usedChannelIds = new Set<string>();

    for (let i = 0; i < files.length; i++) {
      const fileItem = files[i];

      setFiles((prev) => prev.map((f) => f.id === fileItem.id ? { ...f, status: 'processing', progress: 10 } : f));
      await new Promise((r) => setTimeout(r, 150));

      const validation = validateAudioFile(fileItem.file);
      if (!validation.valid) {
        setFiles((prev) => prev.map((f) => f.id === fileItem.id ? { ...f, status: 'failed', progress: 100, errorReason: validation.reason } : f));
        addImportRecord({ id: generateId(), fileName: fileItem.file.name, fileSize: fileItem.file.size, status: 'failed', errorReason: validation.reason, importedAt: new Date().toISOString() });
        continue;
      }

      setFiles((prev) => prev.map((f) => f.id === fileItem.id ? { ...f, progress: 30 } : f));
      await new Promise((r) => setTimeout(r, 100));

      const parsedData = parseFileName(fileItem.file.name);

      setFiles((prev) => prev.map((f) => f.id === fileItem.id ? { ...f, progress: 50, parsedData } : f));
      await new Promise((r) => setTimeout(r, 100));

      const availableTable = channelTable.filter((e) => !usedChannelIds.has(e.id));
      const matched = matchToChannelTable(parsedData, availableTable);

      const trackId = generateId();
      const now = new Date().toISOString();
      let trackStatus: Track['status'] = 'normal';
      let channelTableId: string | undefined;

      if (matched) {
        channelTableId = matched.id;
        usedChannelIds.add(matched.id);

        const detected = detectConflicts(matched, { ...parsedData, fileName: fileItem.file.name });

        if (detected.length > 0) {
          trackStatus = 'conflict';
          for (const c of detected) {
            addConflict({
              id: generateId(),
              trackId,
              channelEntryId: matched.id,
              conflictType: 'value_mismatch',
              sourceA: '舞台通道表',
              sourceB: '导入文件',
              field: c.field,
              valueA: c.valueA,
              valueB: c.valueB,
              originalValueA: c.valueA,
              originalValueB: c.valueB,
              status: 'pending',
              suggestedAction: c.suggestedAction,
              createdAt: now,
            });
          }
        }
      } else {
        trackStatus = 'error';
        addConflict({
          id: generateId(),
          trackId,
          conflictType: 'extra_file',
          sourceA: '舞台通道表',
          sourceB: '导入文件',
          field: 'trackName',
          valueA: '无匹配记录',
          valueB: parsedData.trackName,
          originalValueA: '无匹配记录',
          originalValueB: parsedData.trackName,
          status: 'pending',
          suggestedAction: `文件"${fileItem.file.name}"在舞台通道表中找不到匹配项。可能是多余文件，或通道表尚未录入，建议人工确认`,
          createdAt: now,
        });
      }

      setFiles((prev) => prev.map((f) => f.id === fileItem.id ? { ...f, progress: 80 } : f));
      await new Promise((r) => setTimeout(r, 100));

      const track: Track = {
        id: trackId,
        channelNo: matched?.channelNo || parsedData.channelNo || '',
        trackName: matched?.trackName || parsedData.trackName,
        artist: matched?.artist || parsedData.artist,
        duration: matched?.duration || parsedData.duration,
        fileName: fileItem.file.name,
        fileSize: fileItem.file.size,
        status: trackStatus,
        metadata: { version: parsedData.version, originalName: fileItem.file.name },
        channelTableId,
        createdAt: now,
        updatedAt: now,
      };

      addTrack(track);
      addImportRecord({ id: generateId(), fileName: fileItem.file.name, fileSize: fileItem.file.size, status: 'success', importedAt: now, trackId });

      setFiles((prev) => prev.map((f) => f.id === fileItem.id ? { ...f, status: 'success', progress: 100 } : f));
    }

    const allTracks = useAppStore.getState().tracks;
    const missing = findMissingEntries(channelTable, allTracks);
    const nowOuter = new Date().toISOString();
    for (const entry of missing) {
      const alreadyFlagged = useAppStore.getState().conflicts.some(
        (c) => c.valueA === entry.trackName && c.field === 'trackName' && c.sourceA === '缺失检测'
      );
      if (!alreadyFlagged) {
        addConflict({
          id: generateId(),
          channelEntryId: entry.id,
          conflictType: 'missing_file',
          sourceA: '缺失检测',
          sourceB: '舞台通道表',
          field: 'trackName',
          valueA: entry.trackName,
          valueB: '未找到对应文件',
          originalValueA: entry.trackName,
          originalValueB: '未找到对应文件',
          status: 'pending',
          suggestedAction: `通道表第${entry.channelNo}通道"${entry.trackName}"没有对应的导入文件。可能漏传文件，或文件名无法匹配，建议人工确认`,
          createdAt: nowOuter,
        });
      }
    }

    setIsProcessing(false);
  };

  const successCount = files.filter((f) => f.status === 'success').length;
  const failedCount = files.filter((f) => f.status === 'failed').length;

  return (
    <div>
      <PageHeader
        title="导入面板"
        subtitle="先录入舞台通道表作为对账基准，再批量导入音频文件进行比对。坏文件自动隔离不影响整批处理"
        action={
          <div className="flex items-center gap-3">
            <button
              onClick={() => useAppStore.getState().loadMockData()}
              className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors font-medium text-sm"
            >
              加载示例数据
            </button>
            {files.length > 0 && (
              <button onClick={() => setFiles([])} className="px-4 py-2 text-olive-600 hover:text-olive-800 transition-colors">
                清空文件列表
              </button>
            )}
          </div>
        }
      />

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('channel')}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors',
            activeTab === 'channel' ? 'bg-olive-700 text-white' : 'bg-white text-olive-600 hover:bg-olive-50'
          )}
        >
          <Table2 size={18} />
          舞台通道表 ({channelTable.length})
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors',
            activeTab === 'files' ? 'bg-olive-700 text-white' : 'bg-white text-olive-600 hover:bg-olive-50'
          )}
        >
          <Upload size={18} />
          音频文件导入
        </button>
      </div>

      {activeTab === 'channel' && (
        <div className="animate-fade-in">
          <div className="bg-white rounded-xl shadow-soft p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-lg font-semibold text-olive-900">逐条录入</h3>
            </div>
            <div className="grid grid-cols-6 gap-3">
              <input
                type="text" placeholder="通道号" value={newEntry.channelNo}
                onChange={(e) => setNewEntry({ ...newEntry, channelNo: e.target.value })}
                className="px-3 py-2 border border-olive-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
              <input
                type="text" placeholder="曲目名称 *" value={newEntry.trackName}
                onChange={(e) => setNewEntry({ ...newEntry, trackName: e.target.value })}
                className="px-3 py-2 border border-olive-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
              <input
                type="text" placeholder="艺术家" value={newEntry.artist}
                onChange={(e) => setNewEntry({ ...newEntry, artist: e.target.value })}
                className="px-3 py-2 border border-olive-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
              <input
                type="text" placeholder="时长" value={newEntry.duration}
                onChange={(e) => setNewEntry({ ...newEntry, duration: e.target.value })}
                className="px-3 py-2 border border-olive-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
              <input
                type="text" placeholder="来源(如:微信)" value={newEntry.source}
                onChange={(e) => setNewEntry({ ...newEntry, source: e.target.value })}
                className="px-3 py-2 border border-olive-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
              <button
                onClick={handleAddEntry}
                disabled={!newEntry.trackName.trim()}
                className={cn(
                  'flex items-center justify-center gap-1 px-4 py-2 rounded-lg font-medium transition-colors',
                  newEntry.trackName.trim()
                    ? 'bg-olive-700 text-white hover:bg-olive-800'
                    : 'bg-olive-200 text-olive-400 cursor-not-allowed'
                )}
              >
                <Plus size={16} /> 添加
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="text" placeholder="备注(可选)" value={newEntry.note}
                onChange={(e) => setNewEntry({ ...newEntry, note: e.target.value })}
                className="flex-1 px-3 py-2 border border-olive-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
              <button
                onClick={() => setShowBatch(!showBatch)}
                className="flex items-center gap-1 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm font-medium"
              >
                <ClipboardPaste size={16} /> 批量粘贴
              </button>
            </div>

            {showBatch && (
              <div className="mt-4 animate-fade-in">
                <p className="text-sm text-olive-500 mb-2">
                  每行一条，用 Tab 或逗号分隔：通道号, 曲目名称, 艺术家, 时长, 来源
                </p>
                <textarea
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder={BATCH_EXAMPLE}
                  className="w-full px-3 py-2 border border-olive-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 h-40 font-mono text-sm"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => { setShowBatch(false); setBatchText(''); }} className="px-3 py-1.5 text-sm text-olive-600 hover:bg-olive-50 rounded-lg">取消</button>
                  <button
                    onClick={handleBatchImport}
                    disabled={!batchText.trim()}
                    className={cn(
                      'px-4 py-1.5 text-sm rounded-lg font-medium',
                      batchText.trim() ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-amber-200 text-amber-400 cursor-not-allowed'
                    )}
                  >
                    导入
                  </button>
                </div>
              </div>
            )}
          </div>

          {channelTable.length > 0 && (
            <div className="bg-white rounded-xl shadow-soft overflow-hidden">
              <div className="px-6 py-3 bg-olive-50 border-b border-olive-100">
                <h3 className="font-semibold text-olive-800">已录入的舞台通道表 ({channelTable.length} 条)</h3>
              </div>
              <table className="w-full">
                <thead className="bg-cream-50">
                  <tr>
                    {['通道号', '曲目名称', '艺术家', '时长', '来源', '备注', ''].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-olive-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {channelTable.map((entry) => (
                    <tr key={entry.id} className="hover:bg-olive-50/30 transition-colors">
                      <td className="px-4 py-2.5 text-sm font-medium text-olive-900">{entry.channelNo || '-'}</td>
                      <td className="px-4 py-2.5 text-sm font-medium text-olive-900">{entry.trackName}</td>
                      <td className="px-4 py-2.5 text-sm text-olive-600">{entry.artist || '-'}</td>
                      <td className="px-4 py-2.5 text-sm text-olive-600">{entry.duration || '-'}</td>
                      <td className="px-4 py-2.5 text-sm text-amber-600">{entry.source || '-'}</td>
                      <td className="px-4 py-2.5 text-sm text-olive-500">{entry.note || '-'}</td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => deleteChannelEntry(entry.id)}
                          className="p-1 hover:bg-brick-100 rounded transition-colors text-brick-500 hover:text-brick-700"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {channelTable.length === 0 && (
            <div className="bg-white rounded-xl shadow-soft p-10 text-center">
              <Table2 size={40} className="mx-auto text-olive-300 mb-3" />
              <p className="text-olive-500">请先录入舞台通道表数据</p>
              <p className="text-sm text-olive-400 mt-1">通道表是对账基准，导入音频文件时将与通道表逐条比对</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'files' && (
        <div className="animate-fade-in">
          {channelTable.length === 0 && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm text-amber-700">
                ⚠ 舞台通道表为空，导入文件后将无法对账。建议先在「舞台通道表」标签页录入数据，或点击"加载示例数据"。
              </p>
            </div>
          )}

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 bg-white/50',
              isDragging ? 'border-amber-500 bg-amber-50 scale-[1.02]' : 'border-olive-300 hover:border-olive-400'
            )}
          >
            <input type="file" id="file-input" multiple accept=".mp3,.wav,.flac,.aac,.m4a,.ogg" onChange={handleFileSelect} className="hidden" />
            <label htmlFor="file-input" className="cursor-pointer flex flex-col items-center">
              <div className="w-16 h-16 bg-olive-100 rounded-full flex items-center justify-center mb-4">
                <Upload size={32} className="text-olive-600" />
              </div>
              <p className="text-lg font-medium text-olive-800 mb-2">拖拽文件到此处，或点击选择文件</p>
              <p className="text-sm text-olive-500">支持 MP3、WAV、FLAC、AAC、M4A、OGG 格式，单文件最大 500MB</p>
            </label>
          </div>

          {files.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-xl font-semibold text-olive-900">文件列表 ({files.length})</h3>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-moss-600"><CheckCircle size={16} /> {successCount} 成功</span>
                  <span className="flex items-center gap-1 text-brick-600"><AlertCircle size={16} /> {failedCount} 失败</span>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-soft overflow-hidden">
                {files.map((fileItem, index) => (
                  <div
                    key={fileItem.id}
                    className={cn(
                      'flex items-center gap-4 p-4 border-b border-cream-200 last:border-b-0 animate-slide-in',
                      { 'bg-brick-50': fileItem.status === 'failed' }
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="w-10 h-10 bg-olive-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileAudio size={20} className="text-olive-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-olive-900 truncate">{fileItem.file.name}</p>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-olive-500">{formatFileSize(fileItem.file.size)}</span>
                        {fileItem.parsedData && (
                          <span className="text-amber-600">
                            解析: {fileItem.parsedData.trackName}
                            {fileItem.parsedData.artist && ` - ${fileItem.parsedData.artist}`}
                          </span>
                        )}
                        {fileItem.errorReason && <span className="text-brick-600">{fileItem.errorReason}</span>}
                      </div>
                      {fileItem.status === 'processing' && (
                        <div className="mt-2 h-1 bg-cream-200 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${fileItem.progress}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {fileItem.status === 'processing' && <Loader2 size={20} className="text-amber-500 animate-spin" />}
                      {fileItem.status === 'success' && <CheckCircle size={20} className="text-moss-500" />}
                      {fileItem.status === 'failed' && <AlertCircle size={20} className="text-brick-500" />}
                      {fileItem.status === 'pending' && (
                        <button onClick={() => setFiles((prev) => prev.filter((f) => f.id !== fileItem.id))} className="p-1 hover:bg-cream-200 rounded transition-colors">
                          <X size={20} className="text-olive-400" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end gap-4">
                <button
                  onClick={processFiles}
                  disabled={isProcessing || files.every((f) => f.status !== 'pending')}
                  className={cn(
                    'px-8 py-3 rounded-lg font-medium transition-all duration-200',
                    isProcessing || files.every((f) => f.status !== 'pending')
                      ? 'bg-olive-300 text-white cursor-not-allowed'
                      : 'bg-olive-700 text-white hover:bg-olive-800 hover:shadow-lg active:scale-95'
                  )}
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin" />处理中...</span>
                  ) : '开始处理'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
