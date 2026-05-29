import { useStore } from "@/store"
import { CHANNEL_TYPE_LABELS, ANOMALY_TYPE_LABELS } from "@/types"
import WaveformCanvas from "@/components/WaveformCanvas"
import StatCard from "@/components/StatCard"
import TimelineBar from "@/components/TimelineBar"
import { Activity, Clock, AlertTriangle, Copy } from "lucide-react"
import { formatDuration } from "@/utils/hash"

const TRACK_COLORS: Record<string, string> = {
  drums: "#E8A838",
  bass: "#3498DB",
  vocals: "#2ECC71",
  other: "#9B59B6",
}

export default function AlignmentPanel() {
  const { currentSessionId, tracks, anomalies, runDetection, isProcessing } = useStore()

  const offsetAnomalies = anomalies.filter((a) => a.type === "offset_error")
  const driftAnomalies = anomalies.filter((a) => a.type === "beat_drift")
  const dupAnomalies = anomalies.filter((a) => a.type === "duplicate_clip")
  const maxDuration = tracks.length > 0 ? Math.max(...tracks.map((t) => t.duration)) : 0

  if (!currentSessionId) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center py-20">
        <Activity size={40} className="mx-auto text-gray-600 mb-4" />
        <h3 className="text-base text-gray-400">请先在导入工作台创建或选择排练场次</h3>
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center py-20">
        <Activity size={40} className="mx-auto text-gray-600 mb-4" />
        <h3 className="text-base text-gray-400">请先导入分轨音频</h3>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-100">对齐检测面板</h1>
          <p className="text-sm text-gray-500 mt-1">波形可视化、起点偏移检测、节拍漂移检测、重复剪辑识别</p>
        </div>
        <button
          onClick={runDetection}
          disabled={isProcessing}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-md text-sm font-medium hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              检测中...
            </>
          ) : (
            <>
              <Activity size={16} />
              运行检测
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="起点偏移"
          value={offsetAnomalies.length}
          unit="处"
          color="amber"
          icon={<Clock size={16} />}
        />
        <StatCard
          label="节拍漂移"
          value={driftAnomalies.length}
          unit="段"
          color="red"
          icon={<AlertTriangle size={16} />}
        />
        <StatCard
          label="重复剪辑"
          value={dupAnomalies.length}
          unit="处"
          color="purple"
          icon={<Copy size={16} />}
        />
        <StatCard
          label="总时长"
          value={formatDuration(maxDuration)}
          color="blue"
        />
      </div>

      {anomalies.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-300 mb-3">异常时间轴</h3>
          <TimelineBar duration={maxDuration} anomalies={anomalies} />
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-gray-300">多轨波形</h3>
        {tracks.map((track) => {
          const trackAnomalies = anomalies.filter((a) => a.trackId === track.id)
          const color = TRACK_COLORS[track.channelType] || TRACK_COLORS.other

          return (
            <div key={track.id} className="bg-[#12122A] border border-[#2A2A4A] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm font-medium text-gray-200">{track.fileName}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ backgroundColor: `${color}20`, color }}
                  >
                    {CHANNEL_TYPE_LABELS[track.channelType]}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
                  <span>时长 {formatDuration(track.duration)}</span>
                  <span>采样率 {track.sampleRate}Hz</span>
                  <span>起点偏移 {Math.round(track.startOffset * 1000)}ms</span>
                </div>
              </div>

              <WaveformCanvas
                peaks={track.waveformPeaks}
                duration={track.duration}
                color={color}
                label={CHANNEL_TYPE_LABELS[track.channelType]}
                offsetMs={Math.round(track.startOffset * 1000)}
                anomalies={trackAnomalies}
                height={90}
              />

              {trackAnomalies.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {trackAnomalies.map((a) => (
                    <span
                      key={a.id}
                      className="text-[10px] px-2 py-0.5 rounded border"
                      style={{
                        borderColor: `${ANOMALY_TYPE_LABELS[a.type] ? "#E8A83840" : "#2A2A4A"}`,
                        color: "#999",
                      }}
                    >
                      {ANOMALY_TYPE_LABELS[a.type]} {a.startTime.toFixed(1)}s
                      {a.severity === "error" && " ⚠"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
