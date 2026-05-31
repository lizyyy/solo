import { useState, useCallback } from 'react';
import { Upload, FileAudio, FileText, AlertCircle, X } from 'lucide-react';
import { useAppStore } from '../store';
import { db } from '../db';
import { SegmentStatus, AnomalyType } from '../types';
import { calculateFileHash, parseSRT, parsePlainText } from '../utils/file';
import { detectAnomalies, applyAnomalyMarks } from '../utils/anomaly';

interface UploadedFile {
  audio: File | null;
  subtitle: File | null;
}

export function FileUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedFile>({ audio: null, subtitle: null });
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{ type: 'exact' | 'same_name'; existingName: string } | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    trackData: Omit<import('../types').AudioTrack, 'id' | 'createdAt' | 'updatedAt'>;
    segments: Array<{ startTime: number; endTime: number; text: string; anomalyType: AnomalyType; anomalyNote?: string; status: SegmentStatus; trackId: string }>;
  } | null>(null);

  const { addMessage, showFriendlyMessage, setCurrentTrack, setSegments, setLoading, _pushHistory } = useAppStore();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFiles = async (audioFile: File, subtitleFile?: File) => {
    setLoading(true);
    try {
      const fileHash = await calculateFileHash(audioFile);
      const existingTrack = await db.findTrackByHash(fileHash);

      if (existingTrack) {
        setDuplicateInfo({ type: 'exact', existingName: existingTrack.name });
        setShowDuplicateModal(true);
        return;
      }

      let subtitleText = '';
      let rawSegments: Array<{ startTime: number; endTime: number; text: string }> = [];

      if (subtitleFile) {
        subtitleText = await subtitleFile.text();
        if (subtitleFile.name.endsWith('.srt')) {
          rawSegments = parseSRT(subtitleText);
        } else {
          rawSegments = parsePlainText(subtitleText);
        }
      }

      if (rawSegments.length === 0) {
        const audioDuration = await getAudioDuration(audioFile);
        rawSegments = [{
          startTime: 0,
          endTime: audioDuration,
          text: audioFile.name.replace(/\.[^/.]+$/, '')
        }];
      }

      const anomalies = detectAnomalies(rawSegments);
      const segmentsWithAnomalies = applyAnomalyMarks(
        rawSegments.map(s => ({
          ...s,
          anomalyType: 'normal' as AnomalyType,
          status: 'pending' as SegmentStatus
        })),
        anomalies
      );

      const tempTrackId = crypto.randomUUID();
      const trackData = {
        name: audioFile.name,
        duration: rawSegments[rawSegments.length - 1]?.endTime || 0,
        fileHash,
        subtitleText
      };

      const segments = segmentsWithAnomalies.map(s => ({
        ...s,
        trackId: tempTrackId
      }));

      setPendingImport({ trackData, segments });

      if (anomalies.length > 0) {
        addMessage({
          type: 'warning',
          title: `发现 ${anomalies.length} 个可疑问题`,
          message: '已经自动标记为"待确认"，请仔细检查后再导出'
        });
      }

      const result = await db.saveFullTrack(trackData, segments);
      
      const savedTrack = await db.audioTracks.get(result.trackId);
      const savedSegments = await db.getSegmentsByTrack(result.trackId);
      
      if (savedTrack) {
        setCurrentTrack(savedTrack);
        setSegments(savedSegments);
        _pushHistory('导入音轨');
      }

      addMessage({
        type: 'success',
        title: '导入成功',
        message: `已导入 ${savedSegments.length} 个分段，开始处理吧！`
      });

    } catch (error) {
      console.error('Import error:', error);
      showFriendlyMessage('import_failed', 'error');
    } finally {
      setLoading(false);
      setFiles({ audio: null, subtitle: null });
      setPendingImport(null);
    }
  };

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.onloadedmetadata = () => resolve(audio.duration);
      audio.onerror = () => resolve(600);
      audio.src = URL.createObjectURL(file);
    });
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    const audioFile = droppedFiles.find(f => f.type.startsWith('audio/'));
    const subtitleFile = droppedFiles.find(f => 
      f.type.startsWith('text/') || f.name.endsWith('.srt') || f.name.endsWith('.txt')
    );

    if (audioFile) {
      setFiles(prev => ({
        audio: audioFile || prev.audio,
        subtitle: subtitleFile || prev.subtitle
      }));

      await processFiles(audioFile, subtitleFile);
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const audioFile = selectedFiles.find(f => f.type.startsWith('audio/'));
    const subtitleFile = selectedFiles.find(f => 
      f.type.startsWith('text/') || f.name.endsWith('.srt') || f.name.endsWith('.txt')
    );

    if (audioFile) {
      setFiles(prev => ({
        audio: audioFile || prev.audio,
        subtitle: subtitleFile || prev.subtitle
      }));
      await processFiles(audioFile, subtitleFile);
    }
  };

  const handleDuplicateChoice = async (choice: 'overwrite' | 'new_version' | 'cancel') => {
    setShowDuplicateModal(false);
    if (choice === 'cancel' || !pendingImport) {
      setFiles({ audio: null, subtitle: null });
      setPendingImport(null);
      return;
    }

    if (choice === 'new_version') {
      const versionNum = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
      pendingImport.trackData.name = `${pendingImport.trackData.name}_v${versionNum}`;
    }

    const result = await db.saveFullTrack(pendingImport.trackData, pendingImport.segments);
    const savedTrack = await db.audioTracks.get(result.trackId);
    const savedSegments = await db.getSegmentsByTrack(result.trackId);

    if (savedTrack) {
      setCurrentTrack(savedTrack);
      setSegments(savedSegments);
      _pushHistory('导入音轨');
    }

    addMessage({
      type: 'success',
      title: choice === 'overwrite' ? '已覆盖' : '已创建新版本',
      message: `成功导入 ${savedSegments?.length || 0} 个分段`
    });

    setFiles({ audio: null, subtitle: null });
    setPendingImport(null);
  };

  return (
    <>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 ${
          isDragging 
            ? 'border-sky-400 bg-sky-50 scale-[1.01]' 
            : 'border-slate-300 hover:border-slate-400 bg-slate-50'
        }`}
      >
        <input
          type="file"
          multiple
          accept="audio/*,.srt,.txt"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className="flex flex-col items-center text-center">
          <div className={`p-4 rounded-full mb-4 transition-colors ${
            isDragging ? 'bg-sky-100 text-sky-600' : 'bg-slate-200 text-slate-500'
          }`}>
            <Upload className="w-8 h-8" />
          </div>
          
          <p className="text-slate-700 font-medium text-sm mb-1">
            拖拽音轨文件到这里，或者点击选择
          </p>
          <p className="text-slate-400 text-xs">
            支持同时上传音频 + 字幕草稿（.srt/.txt）
          </p>

          {(files.audio || files.subtitle) && (
            <div className="mt-4 flex items-center gap-4">
              {files.audio && (
                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200">
                  <FileAudio className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-slate-600 truncate max-w-32">{files.audio.name}</span>
                </div>
              )}
              {files.subtitle && (
                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200">
                  <FileText className="w-4 h-4 text-sky-500" />
                  <span className="text-xs text-slate-600 truncate max-w-32">{files.subtitle.name}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showDuplicateModal && duplicateInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-full">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">
                  {duplicateInfo.type === 'exact' ? '这个文件好像导过了' : '发现同名文件'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {duplicateInfo.type === 'exact' 
                    ? `检测到与"${duplicateInfo.existingName}"完全相同的文件`
                    : `库里已经有叫"${duplicateInfo.existingName}"的文件了`
                  }
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => handleDuplicateChoice('cancel')}
                className="flex-1 px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                取消导入
              </button>
              <button
                onClick={() => handleDuplicateChoice('new_version')}
                className="flex-1 px-4 py-2 text-sm text-white bg-sky-500 rounded-lg hover:bg-sky-600 transition-colors"
              >
                新建版本
              </button>
              <button
                onClick={() => handleDuplicateChoice('overwrite')}
                className="flex-1 px-4 py-2 text-sm text-white bg-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
              >
                覆盖原有
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
