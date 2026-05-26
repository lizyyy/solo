import { useGameStore } from "@/store/useGameStore";
import {
  Clock,
  DoorOpen,
  DoorClosed,
  Pause,
  Play,
  RotateCcw,
  Send,
  AlertTriangle,
  ThermometerSun,
} from "lucide-react";
import { useEffect } from "react";

export default function HUD({ onSubmit }: { onSubmit: () => void }) {
  const status = useGameStore((s) => s.status);
  const level = useGameStore((s) => s.level);
  const timeLeft = useGameStore((s) => s.timeLeft);
  const placed = useGameStore((s) => s.placed);
  const violations = useGameStore((s) => s.violations);
  const doorOpen = useGameStore((s) => s.doorOpen);
  const selectedCargoId = useGameStore((s) => s.selectedCargoId);
  const pause = useGameStore((s) => s.pause);
  const resume = useGameStore((s) => s.resume);
  const resetLevel = useGameStore((s) => s.resetLevel);
  const toggleDoor = useGameStore((s) => s.toggleDoor);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && (status === "playing" || status === "paused")) {
        e.preventDefault();
        if (status === "playing") pause();
        else resume();
      }
      if (e.key.toLowerCase() === "r") {
        if (confirm("确定重新开始本关？当前进度将丢失。")) resetLevel();
      }
      if (e.key === "Enter" && status === "playing") {
        onSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, pause, resume, resetLevel, onSubmit]);

  if (!level) return null;

  const mins = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const secs = Math.floor(timeLeft % 60).toString().padStart(2, "0");
  const timeWarn = timeLeft <= 15;

  return (
    <div className="panel p-3 flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2 px-2">
        <div className="text-xs text-cold-mute">关卡</div>
        <div className="text-sm font-semibold text-white">{level.name}</div>
      </div>
      <div className="h-6 w-px bg-cold-line" />

      <div className={`flex items-center gap-2 px-2 ${timeWarn ? "text-rose-300 animate-pulseSoft" : "text-sky-200"}`}>
        <Clock className="w-4 h-4" />
        <span className="font-mono text-lg font-bold">{mins}:{secs}</span>
      </div>
      <div className="h-6 w-px bg-cold-line" />

      <div className="flex items-center gap-2 px-2">
        <button
          onClick={() => toggleDoor()}
          className="btn"
          title="车门开/关 (开门计时升温)"
        >
          {doorOpen ? <DoorOpen className="w-4 h-4 text-orange-300" /> : <DoorClosed className="w-4 h-4 text-emerald-300" />}
          {doorOpen ? "开门中" : "已关门"}
        </button>
      </div>

      <div className="flex items-center gap-2 px-2">
        <div className="text-xs text-cold-mute">
          <AlertTriangle className="w-3 h-3 inline" /> 违规 {violations.length}
        </div>
      </div>

      <div className="h-6 w-px bg-cold-line" />

      <div className="flex items-center gap-2 px-2 text-xs text-cold-mute">
        <ThermometerSun className="w-3.5 h-3.5" />
        {selectedCargoId ? "点击车厢空格放置" : "选中货物库中的一件"}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {status === "playing" && (
          <button onClick={pause} className="btn">
            <Pause className="w-4 h-4" /> 暂停 (空格)
          </button>
        )}
        {status === "paused" && (
          <button onClick={resume} className="btn btn-primary">
            <Play className="w-4 h-4" /> 继续 (空格)
          </button>
        )}
        <button
          onClick={() => {
            if (confirm("确定重新开始本关？当前进度将丢失。")) resetLevel();
          }}
          className="btn"
        >
          <RotateCcw className="w-4 h-4" /> 重开 (R)
        </button>
        <button
          onClick={onSubmit}
          className="btn btn-primary"
          disabled={status !== "playing" || placed.length === 0}
        >
          <Send className="w-4 h-4" /> 提交 (回车)
        </button>
      </div>
    </div>
  );
}
