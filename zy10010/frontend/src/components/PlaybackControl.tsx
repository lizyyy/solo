import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { SystemState } from '../types';

interface PlaybackControlProps {
  onPlaybackState: (state: SystemState | null) => void;
  onPlaybackModeChange: (isPlayback: boolean) => void;
}

export const PlaybackControl: React.FC<PlaybackControlProps> = ({
  onPlaybackState,
  onPlaybackModeChange,
}) => {
  const [isPlaybackMode, setIsPlaybackMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalSnapshots, setTotalSnapshots] = useState(0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    loadSnapshots();
    const interval = setInterval(loadSnapshots, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadSnapshots = async () => {
    if (!isPlaybackMode) {
      try {
        const snapshots = await apiService.getSnapshots();
        setTotalSnapshots(snapshots.length);
      } catch (e) {
        console.error('Failed to load snapshots:', e);
      }
    }
  };

  const handlePlay = async () => {
    try {
      const response = await apiService.playbackControl('play', currentIndex, speed);
      setIsPlaying(true);
      setIsPlaybackMode(true);
      onPlaybackModeChange(true);
      if (response.current_idx !== undefined) {
        setCurrentIndex(response.current_idx);
      }
      if (response.total_idx !== undefined) {
        setTotalSnapshots(response.total_idx);
      }
    } catch (e) {
      console.error('Failed to start playback:', e);
    }
  };

  const handlePause = async () => {
    try {
      const response = await apiService.playbackControl('pause');
      setIsPlaying(false);
      if (response.current_idx !== undefined) {
        setCurrentIndex(response.current_idx);
      }
    } catch (e) {
      console.error('Failed to pause playback:', e);
    }
  };

  const handleStep = async () => {
    try {
      const response = await apiService.playbackControl('step');
      setIsPlaybackMode(true);
      onPlaybackModeChange(true);
      if (response.current_idx !== undefined) {
        setCurrentIndex(response.current_idx);
        const snapshot = await apiService.getSnapshotByIndex(response.current_idx);
        onPlaybackState(snapshot);
      }
      if (response.total_idx !== undefined) {
        setTotalSnapshots(response.total_idx);
      }
    } catch (e) {
      console.error('Failed to step playback:', e);
    }
  };

  const handleStop = async () => {
    try {
      await apiService.playbackControl('stop');
      setIsPlaying(false);
      setIsPlaybackMode(false);
      setCurrentIndex(0);
      onPlaybackModeChange(false);
      onPlaybackState(null);
    } catch (e) {
      console.error('Failed to stop playback:', e);
    }
  };

  const handleJump = async (index: number) => {
    try {
      const response = await apiService.playbackControl('step', index);
      setCurrentIndex(index);
      if (response.current_idx !== undefined) {
        setCurrentIndex(response.current_idx);
        const snapshot = await apiService.getSnapshotByIndex(response.current_idx);
        onPlaybackState(snapshot);
      }
    } catch (e) {
      console.error('Failed to jump to snapshot:', e);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4 text-gray-300">状态回放</h3>
      
      {totalSnapshots === 0 && !isPlaybackMode ? (
        <div className="text-center py-4 text-gray-500">
          <p>暂无快照数据</p>
          <p className="text-xs mt-1">运行场景以生成快照</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={isPlaying ? handlePause : handlePlay}
              disabled={totalSnapshots === 0}
              className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
            >
              {isPlaying ? '⏸ 暂停' : '▶ 播放'}
            </button>
            <button
              onClick={handleStep}
              disabled={totalSnapshots === 0}
              className="py-2 px-3 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
            >
              ⏭ 单步
            </button>
            <button
              onClick={handleStop}
              className="py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
            >
              ⏹ 停止
            </button>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-400 whitespace-nowrap">速度:</span>
            {[0.5, 1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 rounded text-xs transition-colors ${speed === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
              >
                {s}x
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>快照 {currentIndex} / {totalSnapshots > 0 ? totalSnapshots - 1 : 0}</span>
              <span>共 {totalSnapshots} 个快照</span>
            </div>
            <input
              type="range"
              min={0}
              max={totalSnapshots > 0 ? totalSnapshots - 1 : 0}
              value={currentIndex}
              onChange={(e) => handleJump(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              disabled={totalSnapshots === 0}
            />
          </div>

          {isPlaybackMode && (
            <div className="mt-3 p-2 bg-yellow-900/30 border border-yellow-700 rounded">
              <p className="text-xs text-yellow-400">
                ⚠ 回放模式：当前显示的是历史快照
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
