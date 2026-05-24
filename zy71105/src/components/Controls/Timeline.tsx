import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useSceneStore } from '../../store/useSceneStore';

export default function Timeline() {
  const {
    programSegments,
    currentTime,
    isPlaying,
    setIsPlaying,
    setCurrentTime,
    currentSegmentId,
    setCurrentSegment
  } = useSceneStore();

  const maxTime = programSegments.length > 0
    ? Math.max(...programSegments.map((s) => s.endTime))
    : 100;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    setCurrentTime(percentage * maxTime);
  };

  const skipToSegment = (direction: 'prev' | 'next') => {
    if (programSegments.length === 0) return;
    
    const currentIndex = programSegments.findIndex((s) => s.id === currentSegmentId);
    let newIndex: number;
    
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : programSegments.length - 1;
    } else {
      newIndex = currentIndex < programSegments.length - 1 ? currentIndex + 1 : 0;
    }
    
    setCurrentSegment(programSegments[newIndex].id);
  };

  return (
    <div className="h-28 bg-stage-gray border-t border-white/5 flex flex-col">
      <div className="flex-1 px-4 pt-2 pb-1 flex items-end gap-4">
        {programSegments.map((segment, index) => {
          const isActive = segment.id === currentSegmentId;
          const startPercent = (segment.startTime / maxTime) * 100;
          const widthPercent = ((segment.endTime - segment.startTime) / maxTime) * 100;

          return (
            <button
              key={segment.id}
              className={`segment-btn ${isActive ? 'active' : ''}`}
              style={{
                position: 'absolute',
                left: `${startPercent}%`,
                width: `calc(${widthPercent}% - 4px)`,
                marginLeft: '2px',
                bottom: '36px',
                height: '24px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              onClick={() => setCurrentSegment(segment.id)}
              title={segment.name}
            >
              {segment.name}
            </button>
          );
        })}
      </div>

      <div className="h-10 px-4 flex items-center gap-4">
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-stage-gray-light transition-colors"
            onClick={() => skipToSegment('prev')}
            title="上一段"
          >
            <SkipBack size={16} />
          </button>

          <button
            className="p-2 rounded-md bg-stage-blue text-white hover:bg-stage-blue/90 transition-colors"
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>

          <button
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-stage-gray-light transition-colors"
            onClick={() => skipToSegment('next')}
            title="下一段"
          >
            <SkipForward size={16} />
          </button>
        </div>

        <div className="flex-1">
          <div
            className="h-2 bg-stage-gray-light rounded-full cursor-pointer relative overflow-hidden"
            onClick={handleProgressClick}
          >
            {programSegments.map((segment, index) => {
              const startPercent = (segment.startTime / maxTime) * 100;
              const widthPercent = ((segment.endTime - segment.startTime) / maxTime) * 100;
              const isActive = segment.id === currentSegmentId;

              return (
                <div
                  key={segment.id}
                  className={`absolute top-0 h-full ${
                    isActive ? 'bg-stage-blue' : 'bg-stage-gray-light'
                  }`}
                  style={{
                    left: `${startPercent}%`,
                    width: `${widthPercent}%`,
                    borderRight: index < programSegments.length - 1 ? '1px solid #3a3a3e' : 'none'
                  }}
                />
              );
            })}
            
            <div
              className="absolute top-0 left-0 h-full bg-white/30 pointer-events-none"
              style={{ width: `${(currentTime / maxTime) * 100}%` }}
            />

            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg pointer-events-none"
              style={{ left: `calc(${(currentTime / maxTime) * 100}% - 6px)` }}
            />
          </div>
        </div>

        <div className="text-sm font-mono text-gray-400 w-24 text-right">
          {formatTime(currentTime)} / {formatTime(maxTime)}
        </div>
      </div>
    </div>
  );
}
