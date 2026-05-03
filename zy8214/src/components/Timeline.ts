import { AppState, Cue } from '../types';
import { store } from '../store';

let animationFrameId: number | null = null;
let lastUpdateTime: number = 0;
const PLAY_SPEED = 1;

export function renderTimeline(state: AppState): string {
  const { cues, timeline } = state;
  const maxTime = cues.length > 0 
    ? Math.max(...cues.map((c) => c.startTime + c.duration + c.fadeOut)) + 5
    : 60;
  const zoomLevel = timeline.zoomLevel;
  const totalWidth = Math.max(800, maxTime * 50 * zoomLevel);

  return `
    <div class="timeline-header">
      <div class="timeline-controls">
        <button class="btn btn-secondary btn-sm" id="play-btn">
          ${timeline.isPlaying ? '⏸️ 暂停' : '▶️ 播放'}
        </button>
        <button class="btn btn-secondary btn-sm" id="restart-btn">
          ⏮️ 重置
        </button>
        <div class="time-display">${formatTime(timeline.currentTime)}</div>
        <div class="zoom-controls">
          <button class="btn btn-secondary btn-sm" id="zoom-out">-</button>
          <div class="zoom-label">${Math.round(zoomLevel * 100)}%</div>
          <button class="btn btn-secondary btn-sm" id="zoom-in">+</button>
        </div>
      </div>
    </div>
    <div class="timeline-container" id="timeline-container">
      <div style="min-width: ${totalWidth}px; position: relative;">
        <div class="timeline-ruler">
          <div class="ruler-marks">
            ${renderRulerMarks(maxTime, zoomLevel)}
          </div>
        </div>
        <div class="timeline-track" id="timeline-track">
          ${renderCueBlocks(cues, zoomLevel, timeline.selectedCueId)}
          <div class="playhead" id="playhead" style="left: ${timeline.currentTime * 50 * zoomLevel}px;"></div>
        </div>
      </div>
    </div>
  `;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

function renderRulerMarks(maxTime: number, zoomLevel: number): string {
  const marks: string[] = [];
  const interval = zoomLevel >= 2 ? 1 : zoomLevel >= 1 ? 5 : 10;
  
  for (let t = 0; t <= maxTime; t += interval) {
    const left = t * 50 * zoomLevel;
    marks.push(`
      <div class="ruler-mark" style="left: ${left}px;">
        ${formatTimeShort(t)}
      </div>
    `);
  }
  
  return marks.join('');
}

function formatTimeShort(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${secs}s`;
}

function renderCueBlocks(cues: Cue[], zoomLevel: number, selectedCueId: string | null): string {
  if (cues.length === 0) {
    return '';
  }

  return cues
    .sort((a, b) => a.startTime - b.startTime)
    .map((cue) => {
      const left = cue.startTime * 50 * zoomLevel;
      const totalDuration = cue.fadeIn + cue.duration + cue.fadeOut;
      const width = Math.max(30, totalDuration * 50 * zoomLevel);
      const isSelected = cue.id === selectedCueId;
      
      const fadeInWidth = (cue.fadeIn / totalDuration) * 100;
      const fadeOutWidth = (cue.fadeOut / totalDuration) * 100;

      return `
        <div 
          class="timeline-cue ${isSelected ? 'selected' : ''}" 
          data-cue-id="${cue.id}"
          style="left: ${left}px; width: ${width}px;"
        >
          ${cue.fadeIn > 0 ? `<div class="cue-fade-in" style="width: ${fadeInWidth}%;"></div>` : ''}
          ${cue.fadeOut > 0 ? `<div class="cue-fade-out" style="width: ${fadeOutWidth}%;"></div>` : ''}
          <span class="cue-number">${cue.number}</span>
          <span class="cue-name">${cue.name}</span>
        </div>
      `;
    })
    .join('');
}

export function handleTimelineInteraction(_state: AppState): void {
  document.getElementById('play-btn')?.addEventListener('click', () => {
    const { timeline } = store.getState();
    if (timeline.isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  });

  document.getElementById('restart-btn')?.addEventListener('click', () => {
    stopPlayback();
    store.setTimelineCurrentTime(0);
  });

  document.getElementById('zoom-in')?.addEventListener('click', () => {
    const { timeline } = store.getState();
    store.setZoomLevel(Math.min(5, timeline.zoomLevel + 0.5));
  });

  document.getElementById('zoom-out')?.addEventListener('click', () => {
    const { timeline } = store.getState();
    store.setZoomLevel(Math.max(0.5, timeline.zoomLevel - 0.5));
  });

  const cueBlocks = document.querySelectorAll('.timeline-cue');
  cueBlocks.forEach((block) => {
    block.addEventListener('click', (e) => {
      e.stopPropagation();
      const cueId = block.getAttribute('data-cue-id');
      if (cueId) {
        store.setSelectedCue(cueId);
      }
    });
  });

  const timelineTrack = document.getElementById('timeline-track');
  if (timelineTrack) {
    timelineTrack.addEventListener('click', (e) => {
      const track = e.currentTarget as HTMLElement;
      const rect = track.getBoundingClientRect();
      const { timeline } = store.getState();
      const zoomLevel = timeline.zoomLevel;
      const clickX = e.clientX - rect.left;
      const time = clickX / (50 * zoomLevel);
      
      stopPlayback();
      store.setTimelineCurrentTime(Math.max(0, time));
    });
  }
}

function startPlayback(): void {
  const state = store.getState();
  store.setTimelinePlaying(true);
  lastUpdateTime = performance.now();
  
  const maxTime = state.cues.length > 0 
    ? Math.max(...state.cues.map((c) => c.startTime + c.duration + c.fadeOut))
    : 60;

  function animate(timestamp: number) {
    const deltaTime = (timestamp - lastUpdateTime) / 1000;
    lastUpdateTime = timestamp;

    const state = store.getState();
    const newTime = state.timeline.currentTime + deltaTime * PLAY_SPEED;

    if (newTime >= maxTime) {
      stopPlayback();
      store.setTimelineCurrentTime(maxTime);
      return;
    }

    store.setTimelineCurrentTime(newTime);
    animationFrameId = requestAnimationFrame(animate);
  }

  animationFrameId = requestAnimationFrame(animate);
}

function stopPlayback(): void {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  store.setTimelinePlaying(false);
}
