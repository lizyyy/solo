import { Play, Pause, SkipBack, SkipForward, Flag } from 'lucide-react'

interface TimelineProps {
  currentFrame: number
  totalFrames: number
  isPlaying: boolean
  keyframeIndices: number[]
  onFrameChange: (frame: number) => void
  onPlayToggle: () => void
  onAddKeyframe: () => void
}

export default function Timeline({
  currentFrame,
  totalFrames,
  isPlaying,
  keyframeIndices,
  onFrameChange,
  onPlayToggle,
  onAddKeyframe,
}: TimelineProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 border-t border-gray-800">
      <button onClick={() => onFrameChange(Math.max(0, currentFrame - 1))} className="p-1.5 rounded hover:bg-gray-700 text-gray-300">
        <SkipBack size={16} />
      </button>
      <button onClick={onPlayToggle} className="p-2 rounded-full bg-teal-600 hover:bg-teal-500 text-white">
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button onClick={() => onFrameChange(Math.min(totalFrames - 1, currentFrame + 1))} className="p-1.5 rounded hover:bg-gray-700 text-gray-300">
        <SkipForward size={16} />
      </button>
      <span className="text-xs font-mono text-gray-400 w-24 text-center">
        {currentFrame + 1} / {totalFrames}
      </span>
      <div className="flex-1 relative h-8">
        <input
          type="range"
          min={0}
          max={Math.max(0, totalFrames - 1)}
          value={currentFrame}
          onChange={(e) => onFrameChange(Number(e.target.value))}
          className="w-full h-1.5 appearance-none bg-gray-700 rounded-full cursor-pointer accent-teal-500"
        />
        <div className="absolute top-0 left-0 right-0 h-full pointer-events-none">
          {keyframeIndices.map((fi) => (
            <div
              key={fi}
              className="absolute top-1 w-1 h-3 bg-orange-500 rounded-full"
              style={{ left: `${(fi / Math.max(1, totalFrames - 1)) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <button onClick={onAddKeyframe} className="p-1.5 rounded hover:bg-gray-700 text-orange-400" title="标记关键帧">
        <Flag size={16} />
      </button>
    </div>
  )
}
