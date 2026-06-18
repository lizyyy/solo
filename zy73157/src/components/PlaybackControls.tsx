import { Play, Pause, SkipBack, SkipForward, Gauge } from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";

export function PlaybackControls() {
  const { playback, togglePlay, stepForward, stepBackward, setPlayback, getFilteredRecords } = useStore();
  const filteredRecords = getFilteredRecords();
  const currentRecord = filteredRecords[playback.currentIndex];

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={stepBackward}
              disabled={playback.currentIndex === 0}
              className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <SkipBack className="w-5 h-5 text-slate-600" />
            </button>
            <button
              onClick={togglePlay}
              className={cn(
                "p-3 rounded-full transition-all",
                playback.isPlaying
                  ? "bg-rose-500 hover:bg-rose-600 text-white"
                  : "bg-slate-800 hover:bg-slate-900 text-white"
              )}
            >
              {playback.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <button
              onClick={stepForward}
              disabled={playback.currentIndex >= filteredRecords.length - 1}
              className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <SkipForward className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <Gauge className="w-4 h-4 text-slate-500" />
            <select
              value={playback.speed}
              onChange={(e) => setPlayback({ speed: Number(e.target.value) })}
              className="text-sm border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm text-slate-500">
              第 <span className="font-semibold text-slate-700">{playback.currentIndex + 1}</span> / {filteredRecords.length} 条
            </div>
            {currentRecord && (
              <div className="text-xs text-slate-400 mt-0.5">
                {formatTime(currentRecord.timestamp)} · {currentRecord.id}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 relative">
        <input
          type="range"
          min={0}
          max={filteredRecords.length - 1}
          value={playback.currentIndex}
          onChange={(e) => useStore.getState().jumpToIndex(Number(e.target.value))}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between mt-1 text-xs text-slate-400">
          {filteredRecords.length > 0 && (
            <>
              <span>{formatTime(filteredRecords[0].timestamp)}</span>
              <span>{formatTime(filteredRecords[filteredRecords.length - 1].timestamp)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
