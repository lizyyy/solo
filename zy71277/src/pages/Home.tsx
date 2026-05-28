import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore, defaultAnalysisConfig } from '../store/appStore';
import Waveform from '../components/Waveform';
import BeatPointPanel from '../components/BeatPointPanel';
import { cn } from '../lib/utils';
import type { TempoMark, ClassNote, DriftAnalysis, BeatPoint } from '../../shared/types';
import { Upload, Music, Clock, Users, Plus, Play, FileText } from 'lucide-react';

const VOICE_PARTS = [
  { key: 'soprano', label: 'Soprano', color: 'bg-pink-500 hover:bg-pink-400 text-white' },
  { key: 'alto', label: 'Alto', color: 'bg-purple-500 hover:bg-purple-400 text-white' },
  { key: 'tenor', label: 'Tenor', color: 'bg-blue-500 hover:bg-blue-400 text-white' },
  { key: 'bass', label: 'Bass', color: 'bg-green-500 hover:bg-green-400 text-white' },
  { key: 'default', label: 'Default', color: 'bg-gray-500 hover:bg-gray-400 text-white' },
];

const ACCEPTED_FORMATS = ['audio/wav', 'audio/mpeg', 'audio/flac', '.wav', '.mp3', '.flac'];

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor((totalSeconds % 1) * 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

export default function Home() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    audioFile,
    waveform,
    voicePart,
    tempoMarks,
    classNotes,
    currentAnalysis,
    setAudioFile,
    setBeatPoints,
    setTempoMarks,
    addTempoMark,
    addClassNote,
    setWaveform,
    setCurrentAnalysis,
    setVoicePart,
    resetAll,
  } = useAppStore();

  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [referenceBpm, setReferenceBpm] = useState(defaultAnalysisConfig.referenceBpm);
  const [driftThreshold, setDriftThreshold] = useState(defaultAnalysisConfig.driftThreshold);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showTempoModal, setShowTempoModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [tempoType, setTempoType] = useState<'accelerando' | 'ritardando'>('accelerando');
  const [tempoBpm, setTempoBpm] = useState(120);
  const [noteStart, setNoteStart] = useState('0:00.000');
  const [noteEnd, setNoteEnd] = useState('0:00.000');
  const [noteContent, setNoteContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateFile = (file: File): boolean => {
    const isValidType = ACCEPTED_FORMATS.some(
      (format) => file.type === format || file.name.toLowerCase().endsWith(format)
    );
    if (!isValidType) {
      setError('不支持的文件格式，请上传 WAV、MP3 或 FLAC 格式的音频文件');
      return false;
    }
    setError(null);
    return true;
  };

  const uploadFile = async (file: File) => {
    if (!validateFile(file)) return;

    resetAll();
    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('audio', file);

    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      interface UploadResponse {
        success: boolean;
        data: {
          audioFile: typeof audioFile;
          beatPoints: BeatPoint[];
          tempoMarks: TempoMark[];
        };
        error?: string;
      }

      const uploadPromise = new Promise<UploadResponse>((resolve, reject) => {
        xhr.open('POST', '/api/audio/upload');
        xhr.onload = () => {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch {
            reject(new Error('Invalid response'));
          }
        };
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(formData);
      });

      const response = await uploadPromise;

      if (response.success) {
        const { audioFile, beatPoints, tempoMarks } = response.data;
        setAudioFile(audioFile);
        setBeatPoints(beatPoints);
        setTempoMarks(tempoMarks);
        setUploadProgress(100);

        setTimeout(async () => {
          await fetchWaveform(audioFile.id);
        }, 300);
      } else {
        setError(response.error || '上传失败');
      }
    } catch {
      setError('上传失败，请重试');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  }, [uploadFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const fetchWaveform = async (audioId: string) => {
    try {
      const response = await fetch(`/api/audio/${audioId}/waveform`);
      const result = await response.json();
      if (result.success) {
        setWaveform(result.data);
      }
    } catch (e) {
      console.error('Failed to fetch waveform:', e);
    }
  };

  const handleStartAnalysis = async () => {
    if (!audioFile) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioId: audioFile.id,
          voicePart,
          referenceBpm,
          driftThreshold,
          minSegmentLength: defaultAnalysisConfig.minSegmentLength,
          confidenceThreshold: defaultAnalysisConfig.confidenceThreshold,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const analysis: DriftAnalysis = result.data;
        setCurrentAnalysis(analysis);
        navigate(`/analysis/${analysis.id}`);
      } else {
        setError(result.error || '分析失败');
      }
    } catch {
      setError('分析失败，请重试');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddTempoMark = () => {
    if (!audioFile) return;

    const newMark: TempoMark = {
      id: uuidv4(),
      audioId: audioFile.id,
      timeMs: 0,
      bpm: tempoBpm,
      type: tempoType,
      label: tempoType === 'accelerando' ? '渐快' : '渐慢',
    };

    addTempoMark(newMark);
    setShowTempoModal(false);
    setTempoBpm(120);
  };

  const parseTimeToMs = (timeStr: string): number => {
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      const secParts = parts[1].split('.');
      const seconds = parseInt(secParts[0], 10);
      const ms = secParts[1] ? parseInt(secParts[1].padEnd(3, '0'), 10) : 0;
      return minutes * 60000 + seconds * 1000 + ms;
    }
    return 0;
  };

  const handleAddClassNote = () => {
    if (!audioFile || !noteContent.trim()) return;

    const newNote: ClassNote = {
      id: uuidv4(),
      audioId: audioFile.id,
      timeMsStart: parseTimeToMs(noteStart),
      timeMsEnd: parseTimeToMs(noteEnd),
      content: noteContent,
      type: 'text',
    };

    addClassNote(newNote);
    setShowNoteModal(false);
    setNoteStart('0:00.000');
    setNoteEnd('0:00.000');
    setNoteContent('');
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  if (!audioFile) {
    return (
      <div className="min-h-screen bg-charcoal-900 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl">
          <h1 className="text-3xl font-bold text-white text-center mb-2">分析工作台</h1>
          <p className="text-charcoal-400 text-center mb-8">上传音频文件开始节拍漂移分析</p>

          <div
            className={cn(
              'border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 cursor-pointer',
              isDragging
                ? 'border-cyan-400 bg-cyan-400/10'
                : 'border-charcoal-600 hover:border-charcoal-500 bg-charcoal-800/50'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleUploadClick}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".wav,.mp3,.flac,audio/wav,audio/mpeg,audio/flac"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Upload className={cn('w-16 h-16 mx-auto mb-4', isDragging ? 'text-cyan-400' : 'text-charcoal-400')} />
            <p className="text-lg text-white mb-2">
              {isDragging ? '释放文件以上传' : '拖拽文件到此处或点击选择'}
            </p>
            <p className="text-sm text-charcoal-400">支持格式：WAV / MP3 / FLAC</p>

            {isUploading && (
              <div className="mt-6 w-full max-w-xs mx-auto">
                <div className="h-2 bg-charcoal-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-charcoal-400 mt-2">上传中... {uploadProgress}%</p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-center">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal-900">
      <div className={cn('transition-all duration-300', useAppStore.getState().isSidebarOpen ? 'mr-80' : '')}>
        <div className="max-w-6xl mx-auto p-6">
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-white">分析工作台</h1>
            <p className="text-charcoal-400 text-sm">音频节拍漂移分析</p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-charcoal-800 rounded-xl p-4 border border-charcoal-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-cyan-500/20 rounded-lg">
                  <Music className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs text-charcoal-400">文件名</p>
                  <p className="text-white font-medium truncate max-w-48">{audioFile.filename}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-charcoal-400">时长</p>
                  <p className="text-white font-mono">{formatDuration(audioFile.duration)}</p>
                </div>
                <div>
                  <p className="text-xs text-charcoal-400">采样率</p>
                  <p className="text-white font-mono">{audioFile.sampleRate} Hz</p>
                </div>
              </div>
            </div>

            <div className="bg-charcoal-800 rounded-xl p-4 border border-charcoal-700">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-charcoal-400" />
                <span className="text-sm text-charcoal-300">声部选择</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {VOICE_PARTS.map((part) => (
                  <button
                    key={part.key}
                    onClick={() => setVoicePart(part.key)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                      voicePart === part.key
                        ? part.color
                        : 'bg-charcoal-700 text-charcoal-300 hover:bg-charcoal-600'
                    )}
                  >
                    {part.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-charcoal-800 rounded-xl p-4 border border-charcoal-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-charcoal-400" />
                  <span className="text-sm text-charcoal-300">速度标记</span>
                </div>
                <button
                  onClick={() => setShowTempoModal(true)}
                  className="flex items-center gap-1 px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30 transition-colors text-xs"
                >
                  <Plus className="w-3 h-3" />
                  添加
                </button>
              </div>
              <div className="space-y-2 max-h-24 overflow-y-auto">
                {tempoMarks.length === 0 ? (
                  <p className="text-xs text-charcoal-500 text-center py-2">暂无速度标记</p>
                ) : (
                  tempoMarks.map((mark) => (
                    <div key={mark.id} className="flex items-center justify-between text-xs bg-charcoal-700/50 rounded px-2 py-1">
                      <span className="text-charcoal-300">{mark.label}</span>
                      <span className="text-cyan-400 font-mono">{mark.bpm} BPM</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <button
              onClick={() => setShowNoteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-white rounded-lg border border-charcoal-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              添加课堂备注
            </button>
            {classNotes.length > 0 && (
              <div className="mt-3 space-y-2">
                {classNotes.map((note) => (
                  <div key={note.id} className="bg-charcoal-800/50 border border-charcoal-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-cyan-400 font-mono">
                        {formatTime(note.timeMsStart)} - {formatTime(note.timeMsEnd)}
                      </span>
                    </div>
                    <p className="text-sm text-charcoal-300">{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-charcoal-800 rounded-xl p-4 border border-charcoal-700 mb-6">
            <Waveform waveform={waveform} duration={audioFile.duration} />
          </div>

          <div className="bg-charcoal-800 rounded-xl p-4 border border-charcoal-700">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-charcoal-300 whitespace-nowrap">参考 BPM</label>
                <input
                  type="number"
                  value={referenceBpm}
                  onChange={(e) => setReferenceBpm(Math.max(1, parseInt(e.target.value) || 120))}
                  className="w-24 px-3 py-2 bg-charcoal-700 border border-charcoal-600 rounded-lg text-white text-center focus:outline-none focus:border-cyan-400"
                  min="1"
                  max="300"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-charcoal-300 whitespace-nowrap">漂移阈值</label>
                <input
                  type="number"
                  value={driftThreshold}
                  onChange={(e) => setDriftThreshold(Math.max(1, parseInt(e.target.value) || 50))}
                  className="w-24 px-3 py-2 bg-charcoal-700 border border-charcoal-600 rounded-lg text-white text-center focus:outline-none focus:border-cyan-400"
                  min="1"
                  max="500"
                />
                <span className="text-sm text-charcoal-400">ms</span>
              </div>

              <div className="flex-1" />

              <button
                onClick={handleStartAnalysis}
                disabled={isAnalyzing}
                className={cn(
                  'flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all',
                  isAnalyzing
                    ? 'bg-charcoal-600 text-charcoal-400 cursor-not-allowed'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-white'
                )}
              >
                <Play className="w-4 h-4" />
                {isAnalyzing ? '分析中...' : '开始分析'}
              </button>

              <button
                disabled={!currentAnalysis}
                className={cn(
                  'flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all',
                  currentAnalysis
                    ? 'bg-charcoal-700 hover:bg-charcoal-600 text-white'
                    : 'bg-charcoal-700/50 text-charcoal-500 cursor-not-allowed'
                )}
                onClick={() => currentAnalysis && navigate(`/analysis/${currentAnalysis.id}`)}
              >
                <FileText className="w-4 h-4" />
                查看报告
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      <BeatPointPanel />

      {showTempoModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-charcoal-800 rounded-xl p-6 w-full max-w-md border border-charcoal-700">
            <h3 className="text-lg font-semibold text-white mb-4">添加速度标记</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-charcoal-300 mb-2">类型</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTempoType('accelerando')}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                      tempoType === 'accelerando'
                        ? 'bg-cyan-500 text-white'
                        : 'bg-charcoal-700 text-charcoal-300 hover:bg-charcoal-600'
                    )}
                  >
                    渐快 (Accelerando)
                  </button>
                  <button
                    onClick={() => setTempoType('ritardando')}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                      tempoType === 'ritardando'
                        ? 'bg-cyan-500 text-white'
                        : 'bg-charcoal-700 text-charcoal-300 hover:bg-charcoal-600'
                    )}
                  >
                    渐慢 (Ritardando)
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-charcoal-300 mb-2">目标 BPM</label>
                <input
                  type="number"
                  value={tempoBpm}
                  onChange={(e) => setTempoBpm(Math.max(1, parseInt(e.target.value) || 120))}
                  className="w-full px-3 py-2 bg-charcoal-700 border border-charcoal-600 rounded-lg text-white focus:outline-none focus:border-cyan-400"
                  min="1"
                  max="300"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowTempoModal(false)}
                className="flex-1 py-2 bg-charcoal-700 text-white rounded-lg hover:bg-charcoal-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddTempoMark}
                className="flex-1 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-400 transition-colors"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {showNoteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-charcoal-800 rounded-xl p-6 w-full max-w-md border border-charcoal-700">
            <h3 className="text-lg font-semibold text-white mb-4">添加课堂备注</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-charcoal-300 mb-2">开始时间</label>
                  <input
                    type="text"
                    value={noteStart}
                    onChange={(e) => setNoteStart(e.target.value)}
                    placeholder="0:00.000"
                    className="w-full px-3 py-2 bg-charcoal-700 border border-charcoal-600 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-sm text-charcoal-300 mb-2">结束时间</label>
                  <input
                    type="text"
                    value={noteEnd}
                    onChange={(e) => setNoteEnd(e.target.value)}
                    placeholder="0:00.000"
                    className="w-full px-3 py-2 bg-charcoal-700 border border-charcoal-600 rounded-lg text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-charcoal-300 mb-2">备注内容</label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="输入备注内容..."
                  rows={4}
                  className="w-full px-3 py-2 bg-charcoal-700 border border-charcoal-600 rounded-lg text-white focus:outline-none focus:border-cyan-400 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNoteModal(false)}
                className="flex-1 py-2 bg-charcoal-700 text-white rounded-lg hover:bg-charcoal-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddClassNote}
                disabled={!noteContent.trim()}
                className={cn(
                  'flex-1 py-2 rounded-lg transition-colors',
                  noteContent.trim()
                    ? 'bg-cyan-500 text-white hover:bg-cyan-400'
                    : 'bg-charcoal-600 text-charcoal-400 cursor-not-allowed'
                )}
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
