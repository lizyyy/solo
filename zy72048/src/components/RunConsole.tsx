import { useGameStore } from "@/store/useGameStore";
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  Rewind,
} from "lucide-react";

export default function RunConsole() {
  const status = useGameStore((s) => s.status);
  const currentRound = useGameStore((s) => s.currentRound);
  const totalRounds = useGameStore((s) => s.totalRounds);
  const startRun = useGameStore((s) => s.startRun);
  const pauseRun = useGameStore((s) => s.pauseRun);
  const continueRun = useGameStore((s) => s.continueRun);
  const restartRun = useGameStore((s) => s.restartRun);
  const settleRun = useGameStore((s) => s.settleRun);
  const replayRun = useGameStore((s) => s.replayRun);

  const allProcessed = currentRound >= totalRounds && totalRounds > 0;

  const statusLabel: Record<string, { text: string; color: string }> = {
    idle: { text: "待命", color: "bg-gray-200 text-gray-600" },
    running: { text: "校验中", color: "bg-moss text-white" },
    paused: { text: "已暂停", color: "bg-rope text-white" },
    settled: { text: "已结算", color: "bg-cliff text-white" },
  };

  const st = statusLabel[status];

  return (
    <div className="card-warm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-cliff">运行控制台</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            回合 <strong className="text-rock-dark">{currentRound}</strong> / {totalRounds}
          </span>
          <span className={`status-badge ${st.color} ${status === "running" ? "animate-pulse-soft" : ""}`}>
            {st.text}
          </span>
        </div>
      </div>

      {status === "running" && currentRound < totalRounds && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-moss h-2 rounded-full transition-all duration-500"
            style={{ width: `${(currentRound / totalRounds) * 100}%` }}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {status === "idle" && (
          <button
            onClick={startRun}
            className="grip-btn bg-moss text-white px-5 py-2 flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            开始校验
          </button>
        )}

        {status === "running" && (
          <button
            onClick={pauseRun}
            className="grip-btn bg-rope text-white px-5 py-2 flex items-center gap-2"
          >
            <Pause className="w-4 h-4" />
            暂停
          </button>
        )}

        {status === "paused" && (
          <>
            <button
              onClick={continueRun}
              className="grip-btn bg-moss text-white px-5 py-2 flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              继续
            </button>
            <button
              onClick={restartRun}
              className="grip-btn bg-gray-400 text-white px-5 py-2 flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              重开
            </button>
          </>
        )}

        {allProcessed && status === "running" && (
          <button
            onClick={settleRun}
            className="grip-btn bg-cliff text-white px-5 py-2 flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            结算
          </button>
        )}

        {status === "settled" && (
          <>
            <button
              onClick={replayRun}
              className="grip-btn bg-rope text-white px-5 py-2 flex items-center gap-2"
            >
              <Rewind className="w-4 h-4" />
              回放
            </button>
            <button
              onClick={restartRun}
              className="grip-btn bg-gray-400 text-white px-5 py-2 flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              重开
            </button>
          </>
        )}
      </div>
    </div>
  );
}
