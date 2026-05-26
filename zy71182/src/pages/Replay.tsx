import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../game/store";
import { ArrowLeft, Play, Pause, SkipForward, SkipBack } from "lucide-react";

export default function Replay() {
  const nav = useNavigate();
  const history = useGameStore((s) => s.history);
  const replayId = useGameStore((s) => s.replayId);
  const record = useMemo(() => history.find((h) => h.id === replayId), [history, replayId]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!record) {
      nav("/");
    } else {
      setIdx(record.logs.length - 1);
    }
  }, [record, nav]);

  useEffect(() => {
    if (!playing || !record) return;
    const t = setInterval(() => {
      setIdx((i) => {
        if (!record) return i;
        if (i >= record.logs.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 800);
    return () => clearInterval(t);
  }, [playing, record]);

  if (!record) return null;
  const logs = record.logs;
  const current = logs.slice(0, idx + 1);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-3 border-b border-[#0A1F44]/10 bg-white/70 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="text-xs text-[#0A1F44]/70 hover:text-[#0A1F44]" onClick={() => nav("/")}>
            <ArrowLeft className="w-3 h-3 inline mr-1" /> 菜单
          </button>
          <div className="font-mono text-lg">回放 · {record.levelName}</div>
        </div>
        <div className="text-xs text-[#0A1F44]/70">
          最终分数 <span className="font-semibold text-[#0A1F44]">{record.score}</span> / 结果{" "}
          <span className={record.result === "win" ? "text-[#2e7a4e]" : "text-[#E60012]"}>
            {record.result === "win" ? "达标" : "未达标"}
          </span>
        </div>
      </header>
      <div className="flex-1 p-6 flex flex-col gap-4">
        <div className="card p-3 flex items-center gap-2">
          <button className="btn-ghost text-xs" onClick={() => setIdx(0)}>
            <SkipBack className="w-3 h-3" />
          </button>
          <button
            className="btn-ghost text-xs"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
          >
            ◀
          </button>
          <button className="btn-secondary text-xs" onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
          <button
            className="btn-ghost text-xs"
            onClick={() => setIdx((i) => Math.min(logs.length - 1, i + 1))}
          >
            ▶
          </button>
          <button className="btn-ghost text-xs" onClick={() => setIdx(logs.length - 1)}>
            <SkipForward className="w-3 h-3" />
          </button>
          <div className="text-xs text-[#0A1F44]/60 ml-2">
            {idx + 1} / {logs.length}
          </div>
          <div className="flex-1" />
          <div className="text-[11px] text-[#0A1F44]/60">
            用时：{record.days} 天 · 现金：¥{record.cash}
          </div>
        </div>
        <div className="card p-4 flex-1 overflow-y-auto text-sm">
          {current.map((l, i) => (
            <div key={i} className="flex gap-3 py-1 border-b border-dashed border-[#0A1F44]/10 last:border-0">
              <span className="font-mono text-[11px] text-[#0A1F44]/50">
                D{l.day}
              </span>
              <span className="text-[11px] px-1 rounded bg-[#0A1F44]/5 uppercase tracking-wider">
                {l.kind}
              </span>
              <span className="flex-1">{l.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
