import { useEffect, useRef, useCallback, useState } from 'react';
import { useAppStore } from '@/store';
import {
  formatTime,
  PROBLEM_TYPE_LABELS,
  Misnote,
  PitchDetectionResult,
  SeparationResult,
  ScoreSection,
} from '@/types';
import { generateWaveformData, generateMockAudioData } from '@/utils/mockData';
import { Play, Pause, ZoomIn, ZoomOut, Maximize2, SkipBack, SkipForward } from 'lucide-react';

interface HoveredMisnote {
  misnote: Misnote;
  x: number;
  y: number;
}

export function WaveformDisplay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pitchCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    audioBuffer,
    audioTrack,
    playbackTime,
    isPlaying,
    viewRange,
    selectionRange,
    misnotes,
    filteredMisnotes,
    pitchResults,
    separationResults,
    scoreSections,
    selectedMisnoteId,
    togglePlayback,
    seekToTime,
    setViewRange,
    setSelectionRange,
    selectMisnote,
    zoomView,
    voiceParts,
  } = useAppStore();

  const [hoveredMisnote, setHoveredMisnote] = useState<HoveredMisnote | null>(null);
  const [waveformData, setWaveformData] = useState<{
    min: number[];
    max: number[];
    peaks: number[];
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);

  useEffect(() => {
    if (audioBuffer) {
      const channelData = audioBuffer.getChannelData(0);
      const data = generateWaveformData(channelData, 100);
      setWaveformData(data);
    } else if (audioTrack) {
      const mockData = generateMockAudioData(audioTrack.duration);
      const data = generateWaveformData(mockData, 100);
      setWaveformData(data);
    }
  }, [audioBuffer, audioTrack]);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveformData || !audioTrack) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const [viewStart, viewEnd] = viewRange;
    const duration = viewEnd - viewStart;

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, width, height);

    const startSample = Math.floor((viewStart / audioTrack.duration) * waveformData.peaks.length);
    const endSample = Math.ceil((viewEnd / audioTrack.duration) * waveformData.peaks.length);
    const visibleSamples = waveformData.peaks.slice(startSample, endSample);

    if (visibleSamples.length === 0) return;

    const samplesPerPixel = visibleSamples.length / width;
    const centerY = height / 2;
    const maxAmplitude = height / 2 - 10;

    ctx.beginPath();
    ctx.moveTo(0, centerY);

    for (let x = 0; x < width; x++) {
      const sampleIndex = Math.floor(x * samplesPerPixel);
      const peak = visibleSamples[sampleIndex] || 0;
      const barHeight = peak * maxAmplitude;

      ctx.fillStyle = '#3b71a8';
      ctx.fillRect(x, centerY - barHeight, 1, barHeight * 2);
    }

    scoreSections.forEach((section) => {
      if (section.endTime < viewStart || section.startTime > viewEnd) return;

      const sectionStartX = ((section.startTime - viewStart) / duration) * width;
      const sectionEndX = ((section.endTime - viewStart) / duration) * width;
      const sectionWidth = sectionEndX - sectionStartX;

      ctx.fillStyle = section.sourceType === 'system' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(249, 115, 22, 0.1)';
      ctx.fillRect(sectionStartX, 0, sectionWidth, height);

      ctx.strokeStyle = section.sourceType === 'system' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(249, 115, 22, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(sectionStartX, 0, sectionWidth, height);
      ctx.setLineDash([]);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Noto Sans SC';
      ctx.fillText(section.name, sectionStartX + 5, 15);
    });

    if (selectionRange) {
      const [selStart, selEnd] = selectionRange;
      const selStartX = ((selStart - viewStart) / duration) * width;
      const selEndX = ((selEnd - viewStart) / duration) * width;
      ctx.fillStyle = 'rgba(59, 113, 168, 0.3)';
      ctx.fillRect(selStartX, 0, selEndX - selStartX, height);
    }

    const playheadX = ((playbackTime - viewStart) / duration) * width;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(playheadX - 6, 0);
    ctx.lineTo(playheadX + 6, 0);
    ctx.lineTo(playheadX, 8);
    ctx.closePath();
    ctx.fill();
  }, [waveformData, audioTrack, viewRange, playbackTime, selectionRange, scoreSections]);

  const drawPitchCurve = useCallback(() => {
    const canvas = pitchCanvasRef.current;
    if (!canvas || !audioTrack) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const [viewStart, viewEnd] = viewRange;
    const duration = viewEnd - viewStart;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    const minFreq = 200;
    const maxFreq = 1000;

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      const freq = maxFreq - ((maxFreq - minFreq) / 5) * i;
      ctx.fillStyle = '#64748b';
      ctx.font = '9px JetBrains Mono';
      ctx.fillText(`${Math.round(freq)}Hz`, 5, y + 12);
    }

    const visiblePitches = pitchResults.filter(
      (p) => p.time >= viewStart && p.time <= viewEnd
    );

    if (visiblePitches.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;

      let started = false;
      for (let i = 0; i < visiblePitches.length; i++) {
        const pitch = visiblePitches[i];
        const x = ((pitch.time - viewStart) / duration) * width;
        const normalizedFreq = (pitch.frequency - minFreq) / (maxFreq - minFreq);
        const y = height - normalizedFreq * height;

        if (y >= 0 && y <= height) {
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }

    const visibleSeparation = separationResults.filter(
      (s) => s.time >= viewStart && s.time <= viewEnd
    );

    if (visibleSeparation.length > 0) {
      for (const sep of visibleSeparation) {
        const x = ((sep.time - viewStart) / duration) * width;
        const barWidth = Math.max(1, width / visibleSeparation.length);

        if (sep.dominantInstrument === 'violin') {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
          ctx.fillRect(x, height - sep.violinEnergy * height * 0.3, barWidth, sep.violinEnergy * height * 0.3);
        } else if (sep.dominantInstrument === 'flute') {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
          ctx.fillRect(x, 0, barWidth, sep.fluteEnergy * height * 0.3);
        } else if (sep.dominantInstrument === 'both') {
          ctx.fillStyle = 'rgba(139, 92, 246, 0.3)';
          ctx.fillRect(x, 0, barWidth, sep.fluteEnergy * height * 0.3);
          ctx.fillRect(x, height - sep.violinEnergy * height * 0.3, barWidth, sep.violinEnergy * height * 0.3);
        }
      }
    }

    filteredMisnotes.forEach((misnote) => {
      if (misnote.time < viewStart || misnote.time > viewEnd) return;

      const x = ((misnote.time - viewStart) / duration) * width;
      const misnoteFreq = 440 * Math.pow(2, (parsePitch(misnote.actualPitch) - 69) / 12);
      const normalizedFreq = (misnoteFreq - minFreq) / (maxFreq - minFreq);
      const y = height - normalizedFreq * height;

      const isSelected = misnote.id === selectedMisnoteId;
      const isHovered = hoveredMisnote?.misnote.id === misnote.id;

      let color = '#f59e0b';
      if (misnote.problemType === 'section_misalignment') color = '#ef4444';
      if (misnote.problemType === 'noise_misjudgment') color = '#8b5cf6';

      if (misnote.confirmationStatus === 'confirmed') color = '#10b981';
      if (misnote.confirmationStatus === 'rejected') color = '#64748b';

      ctx.beginPath();
      const radius = isSelected || isHovered ? 10 : 6;

      if (misnote.sourceType === 'manual') {
        ctx.fillStyle = color;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('+', x, y + 3);
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();

        if (isSelected || isHovered) {
          ctx.fillStyle = color + '40';
          ctx.fill();
        }
      }

      ctx.textAlign = 'left';
    });

    const playheadX = ((playbackTime - viewStart) / duration) * width;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
  }, [pitchResults, separationResults, filteredMisnotes, audioTrack, viewRange, playbackTime, selectedMisnoteId, hoveredMisnote]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  useEffect(() => {
    drawPitchCurve();
  }, [drawPitchCurve]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>, isPitchCanvas: boolean) => {
    const canvas = isPitchCanvas ? pitchCanvasRef.current : canvasRef.current;
    if (!canvas || !audioTrack) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const [viewStart, viewEnd] = viewRange;
    const duration = viewEnd - viewStart;
    const time = viewStart + (x / rect.width) * duration;

    if (isDragging && dragStart !== null) {
      const range: [number, number] = [Math.min(dragStart, time), Math.max(dragStart, time)];
      setSelectionRange(range);
      return;
    }

    const clickedMisnote = findMisnoteAtPosition(x, rect.width, isPitchCanvas);
    if (clickedMisnote) {
      selectMisnote(clickedMisnote.id);
      seekToTime(clickedMisnote.time, true);
    } else {
      seekToTime(time, !isPlaying);
      selectMisnote(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    const canvas = canvasRef.current;
    if (!canvas || !audioTrack) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const [viewStart, viewEnd] = viewRange;
    const duration = viewEnd - viewStart;
    const time = viewStart + (x / rect.width) * duration;
    setDragStart(time);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>, isPitchCanvas: boolean) => {
    const canvas = isPitchCanvas ? pitchCanvasRef.current : canvasRef.current;
    if (!canvas || !audioTrack) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const hovered = findMisnoteAtPosition(x, rect.width, isPitchCanvas);
    if (hovered) {
      setHoveredMisnote({
        misnote: hovered,
        x: e.clientX,
        y: e.clientY,
      });
      canvas.style.cursor = 'pointer';
    } else {
      setHoveredMisnote(null);
      canvas.style.cursor = isDragging ? 'col-resize' : 'crosshair';
    }

    if (isDragging && dragStart !== null) {
      const [viewStart, viewEnd] = viewRange;
      const duration = viewEnd - viewStart;
      const time = viewStart + (x / rect.width) * duration;
      const range: [number, number] = [Math.min(dragStart, time), Math.max(dragStart, time)];
      setSelectionRange(range);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const findMisnoteAtPosition = (
    x: number,
    width: number,
    isPitchCanvas: boolean
  ): Misnote | null => {
    const [viewStart, viewEnd] = viewRange;
    const duration = viewEnd - viewStart;
    const tolerance = 10;

    for (const misnote of filteredMisnotes) {
      if (misnote.time < viewStart || misnote.time > viewEnd) continue;

      const misnoteX = ((misnote.time - viewStart) / duration) * width;
      if (Math.abs(x - misnoteX) < tolerance) {
        return misnote;
      }
    }

    return null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.8 : 1.25;
    zoomView(factor);
  };

  const handleSkipBack = () => {
    const newTime = Math.max(0, playbackTime - 5);
    seekToTime(newTime, isPlaying);
  };

  const handleSkipForward = () => {
    const newTime = Math.min(audioTrack?.duration || 0, playbackTime + 5);
    seekToTime(newTime, isPlaying);
  };

  const handleResetZoom = () => {
    if (audioTrack) {
      setViewRange([0, audioTrack.duration]);
    }
  };

  const getVoicePartName = (voicePartId: string) => {
    const part = voiceParts.find((v) => v.id === voicePartId);
    return part?.name || '未知';
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-primary-950 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-primary-800 border-b border-primary-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-primary-200">波形显示</span>
          <span className="font-mono text-xs text-primary-400">
            {formatTime(viewRange[0])} - {formatTime(viewRange[1])}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSkipBack}
            className="p-1.5 rounded hover:bg-primary-700 text-primary-300 transition-colors"
            title="后退5秒"
          >
            <SkipBack size={16} />
          </button>

          <button
            onClick={togglePlayback}
            className="p-2 rounded-full bg-primary-600 hover:bg-primary-500 text-white transition-colors"
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <button
            onClick={handleSkipForward}
            className="p-1.5 rounded hover:bg-primary-700 text-primary-300 transition-colors"
            title="前进5秒"
          >
            <SkipForward size={16} />
          </button>

          <div className="w-px h-6 bg-primary-600 mx-1" />

          <button
            onClick={() => zoomView(1.5)}
            className="p-1.5 rounded hover:bg-primary-700 text-primary-300 transition-colors"
            title="放大"
          >
            <ZoomIn size={16} />
          </button>

          <button
            onClick={() => zoomView(0.67)}
            className="p-1.5 rounded hover:bg-primary-700 text-primary-300 transition-colors"
            title="缩小"
          >
            <ZoomOut size={16} />
          </button>

          <button
            onClick={handleResetZoom}
            className="p-1.5 rounded hover:bg-primary-700 text-primary-300 transition-colors"
            title="重置视图"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      <div className="relative flex-1" onWheel={handleWheel}>
        <div className="h-1/2 relative">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            onClick={(e) => handleCanvasClick(e, false)}
            onMouseDown={handleMouseDown}
            onMouseMove={(e) => handleMouseMove(e, false)}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 text-xs text-primary-500 font-mono">
            {Array.from({ length: 6 }, (_, i) => {
              const time = viewRange[0] + (viewRange[1] - viewRange[0]) * (i / 5);
              return <span key={i}>{formatTime(time)}</span>;
            })}
          </div>
        </div>

        <div className="h-1/2 relative border-t border-primary-700">
          <canvas
            ref={pitchCanvasRef}
            className="absolute inset-0 w-full h-full"
            onClick={(e) => handleCanvasClick(e, true)}
            onMouseMove={(e) => handleMouseMove(e, true)}
            onMouseLeave={() => setHoveredMisnote(null)}
          />
        </div>

        {hoveredMisnote && (
          <div
            className="fixed z-50 bg-primary-800 border border-primary-600 rounded-lg p-3 shadow-xl pointer-events-none animate-fade-in"
            style={{
              left: hoveredMisnote.x + 15,
              top: hoveredMisnote.y + 15,
              minWidth: '200px',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  hoveredMisnote.misnote.problemType === 'voice_overlap'
                    ? 'bg-problem-overlap'
                    : hoveredMisnote.misnote.problemType === 'section_misalignment'
                    ? 'bg-problem-misalignment'
                    : 'bg-problem-noise'
                }`}
              />
              <span className="font-medium text-sm">
                {PROBLEM_TYPE_LABELS[hoveredMisnote.misnote.problemType]}
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-primary-400">时间:</span>
                <span className="font-mono text-primary-200">
                  {formatTime(hoveredMisnote.misnote.time)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-400">声部:</span>
                <span className="text-primary-200">
                  {getVoicePartName(hoveredMisnote.misnote.voicePartId)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-400">预期音高:</span>
                <span className="font-mono text-primary-200">
                  {hoveredMisnote.misnote.expectedPitch}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-400">实际音高:</span>
                <span className="font-mono text-primary-200">
                  {hoveredMisnote.misnote.actualPitch}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-400">偏差:</span>
                <span className="font-mono text-problem-misalignment">
                  {hoveredMisnote.misnote.deviationCents.toFixed(0)} 音分
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-primary-400">来源:</span>
                <span
                  className={
                    hoveredMisnote.misnote.sourceType === 'system'
                      ? 'text-source-system'
                      : 'text-source-manual'
                  }
                >
                  {hoveredMisnote.misnote.sourceType === 'system' ? '系统检测' : '人工补录'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-2 bg-primary-800 border-t border-primary-700">
        <div className="flex items-center justify-between text-xs text-primary-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full border-2 border-problem-overlap" />
              <span>声部混叠</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full border-2 border-problem-misalignment" />
              <span>段落错位</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full border-2 border-problem-noise" />
              <span>噪声误判</span>
            </div>
            <div className="w-px h-4 bg-primary-600" />
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-status-confirmed" />
              <span>已确认</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-status-rejected" />
              <span>已驳回</span>
            </div>
          </div>
          <div className="font-mono">
            当前: {formatTime(playbackTime)} / {formatTime(audioTrack?.duration || 0)}
          </div>
        </div>
      </div>
    </div>
  );
}

function parsePitch(pitch: string): number {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const match = pitch.match(/^([A-G]#?)(\d)$/);
  if (!match) return 69;

  const [, note, octave] = match;
  const noteIndex = noteNames.indexOf(note);
  return parseInt(octave) * 12 + noteIndex + 12;
}
