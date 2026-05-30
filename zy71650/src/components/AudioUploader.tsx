import { useState, useCallback, useRef } from 'react';
import { Upload, FileAudio, Music } from 'lucide-react';
import { useAppStore } from '@/store';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function AudioUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioFile = useAppStore((s) => s.audioFile);
  const uploadAudio = useAppStore((s) => s.uploadAudio);

  const handleFile = useCallback(
    async (file: File) => {
      const validExts = ['.wav', '.mp3', '.ogg', '.flac'];
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!validExts.includes(ext)) return;
      setIsUploading(true);
      try {
        await uploadAudio(file);
      } finally {
        setIsUploading(false);
      }
    },
    [uploadAudio],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  if (audioFile) {
    return (
      <div className="rounded-xl bg-synth-card border border-synth-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-synth-accent/10 flex items-center justify-center">
            <FileAudio className="w-5 h-5 text-synth-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white font-mono truncate">{audioFile.fileName}</p>
            <p className="text-xs text-synth-muted">
              {formatDuration(audioFile.duration)} · {audioFile.sampleRate}Hz
            </p>
          </div>
        </div>
        {audioFile.bpm != null && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-synth-amber/10">
            <Music className="w-4 h-4 text-synth-amber" />
            <span className="text-sm font-mono text-synth-amber">{audioFile.bpm} BPM</span>
            <span className="text-xs text-synth-muted ml-auto">
              {Math.round(audioFile.bpmConfidence * 100)}%
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`
        rounded-xl border-2 border-dashed cursor-pointer
        flex flex-col items-center justify-center gap-3 p-8
        transition-all duration-200
        ${isDragging
          ? 'border-synth-accent bg-synth-accent/5 shadow-glow-green'
          : 'border-synth-accent/30 bg-synth-card hover:border-synth-accent/50 hover:bg-synth-card/80'}
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".wav,.mp3,.ogg,.flac"
        onChange={onFileSelect}
        className="hidden"
      />
      {isUploading ? (
        <>
          <div className="w-10 h-10 rounded-full border-2 border-synth-accent border-t-transparent animate-spin" />
          <p className="text-sm text-synth-accent animate-pulse-slow">上传中...</p>
        </>
      ) : (
        <>
          <Upload className={`w-8 h-8 ${isDragging ? 'text-synth-accent' : 'text-synth-accent/50'}`} />
          <div className="text-center">
            <p className="text-sm text-white/80">拖放音频文件至此</p>
            <p className="text-xs text-synth-muted mt-1">WAV / MP3 / OGG / FLAC</p>
          </div>
        </>
      )}
    </div>
  );
}
