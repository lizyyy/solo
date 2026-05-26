import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Play, Pause, FastForward, Rewind, Download, Home, Package } from "lucide-react";
import { getHistoryRecord } from "@/utils/storage";
import { getLevel } from "@/data/levels";
import { ZONE_META, type ActionFrame, type PlacedCargo } from "@/types";
import { cn } from "@/lib/utils";
import { downloadReportJSON, downloadReportText } from "@/utils/report";

export default function ReplayPage() {
  const { recordId } = useParams<{ recordId: string }>();
  const nav = useNavigate();
  const record = useMemo(() => (recordId ? getHistoryRecord(recordId) : undefined), [recordId]);
  const level = record ? getLevel(record.levelId) : undefined;

  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setCursor(0);
    setPlaying(false);
  }, [recordId]);

  useEffect(() => {
    if (!playing || !record) return;
    const id = window.setInterval(() => {
      setCursor((c) => Math.min(c + 1, record.frames.length - 1));
    }, 400 / speed);
    timerRef.current = id;
    return () => window.clearInterval(id);
  }, [playing, speed, record]);

  useEffect(() => {
    if (!record) return;
    if (cursor >= record.frames.length - 1) setPlaying(false);
  }, [cursor, record]);

  if (!record || !level) {
    return (
      <div className="min-h-full flex flex-col">
        <div className="px-6 py-3 border-b border-cold-line flex items-center gap-3">
          <button className="btn" onClick={() => nav("/history")}>
            <ArrowLeft className="w-4 h-4" /> 返回
          </button>
          <div className="text-sm text-cold-mute">未找到回放记录</div>
        </div>
        <div className="flex-1 flex items-center justify-center text-cold-mute">
          记录不存在或已被清除
        </div>
      </div>
    );
  }

  const frames = record.frames;
  const upto = frames.slice(0, cursor + 1);

  const placed: PlacedCargo[] = [];
  let orderSeq = 0;
  upto.forEach((f) => {
    if (f.type === "place" && f.payload) {
      orderSeq += 1;
      placed.push({ cargoId: f.payload.cargoId, x: f.payload.x, y: f.payload.y, placeOrder: orderSeq });
    } else if (f.type === "unplace" && f.payload) {
      const idx = placed.findIndex((p) => p.cargoId === f.payload.cargoId);
      if (idx >= 0) placed.splice(idx, 1);
    }
  });

  const currentFrame: ActionFrame = frames[cursor] ?? frames[0];

  const cellSize = level.gridW > 8 ? 48 : 56;
  const zoneBg = (z: string) => {
    if (z === "frozen") return "rgba(14,165,233,0.16)";
    if (z === "chilled") return "rgba(101,163,13,0.16)";
    return "rgba(249,115,22,0.12)";
  };

  return (
    <div className="min-h-full flex flex-col">
      <div className="px-6 py-3 border-b border-cold-line flex items-center gap-3">
        <button className="btn" onClick={() => nav("/history")}>
          <ArrowLeft className="w-4 h-4" /> 返回
        </button>
        <div className="text-sm text-cold-mute">
          回放：{level.name} · {new Date(record.finishedAt).toLocaleString()}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="chip border-slate-600 bg-slate-800/40 text-slate-300">
            {record.result === "won" ? "通关" : "失败"}
          </span>
          <span className="chip bg-sky-500/15 border-sky-400/60 text-sky-200">
            得分 {record.score}
          </span>
          <button className="btn" onClick={() => downloadReportText(record.report)}>
            <Download className="w-4 h-4" /> TXT
          </button>
          <button className="btn" onClick={() => downloadReportJSON(record.report)}>
            <Download className="w-4 h-4" /> JSON
          </button>
          <button className="btn" onClick={() => nav("/")}>
            <Home className="w-4 h-4" /> 主菜单
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 py-6 flex flex-col lg:flex-row gap-4 items-start">
        <div className="flex-1 flex flex-col items-center gap-3">
          <div
            className="grid gap-0.5 rounded-md p-2"
            style={{
              gridTemplateColumns: `repeat(${level.gridW}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${level.gridH}, ${cellSize}px)`,
              background:
                "repeating-linear-gradient(45deg, rgba(30,42,68,0.35) 0 12px, rgba(30,42,68,0.15) 12px 24px)",
              border: "1px solid #1e2a44",
            }}
          >
            {level.zoneLayout.map((row, y) =>
              row.map((zone, x) => {
                const p = placed.find((pp) => pp.x === x && pp.y === y);
                const cargo = p ? level.cargos.find((c) => c.id === p.cargoId) : undefined;
                return (
                  <div
                    key={`${x}-${y}`}
                    className="relative rounded-sm flex items-center justify-center"
                    style={{
                      width: cellSize,
                      height: cellSize,
                      background: zoneBg(zone),
                      border: "1px solid rgba(148,163,184,0.15)",
                    }}
                  >
                    <div className="absolute top-0 left-1 text-[9px] text-slate-500 font-mono">
                      {x},{y}
                    </div>
                    {cargo && (
                      <div
                        className={cn(
                          "w-full h-full rounded-sm flex flex-col items-center justify-center text-white shadow-md",
                          ZONE_META[cargo.zone].bg
                        )}
                      >
                        <Package className="w-3.5 h-3.5" />
                        <div className="text-[10px] leading-tight mt-0.5 px-0.5 text-center">
                          {cargo.name}
                        </div>
                        <div className="text-[9px] opacity-80">#{cargo.destOrder}</div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="panel w-full max-w-2xl px-3 py-2 flex items-center gap-2">
            <button className="btn" onClick={() => setCursor(0)}>
              <Rewind className="w-4 h-4" /> 开始
            </button>
            <button className="btn" onClick={() => setPlaying((p) => !p)}>
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {playing ? "暂停" : "播放"}
            </button>
            <button
              className="btn"
              onClick={() => setCursor((c) => Math.min(c + 1, frames.length - 1))}
            >
              <FastForward className="w-4 h-4" />
            </button>
            <select
              className="bg-cold-panel border border-cold-line rounded px-2 py-1 text-xs"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              {[0.5, 1, 2, 4].map((s) => (
                <option key={s} value={s}>
                  {s}x
                </option>
              ))}
            </select>
            <div className="flex-1 flex items-center gap-2 px-2">
              <span className="text-xs font-mono text-cold-mute">帧 {cursor + 1}/{frames.length}</span>
              <input
                type="range"
                min={0}
                max={frames.length - 1}
                value={cursor}
                onChange={(e) => {
                  setPlaying(false);
                  setCursor(Number(e.target.value));
                }}
                className="flex-1 accent-sky-400"
              />
            </div>
          </div>
        </div>

        <div className="w-80 flex flex-col gap-3">
          <div className="panel p-3">
            <div className="text-sm text-cold-mute mb-2">当前动作</div>
            <div className="text-xs font-mono text-cold-text bg-black/30 border border-cold-line rounded px-2 py-1.5">
              t={currentFrame.t}s · {currentFrame.type}
              {currentFrame.payload ? (
                <pre className="whitespace-pre-wrap text-[11px] mt-1 text-sky-200">
                  {JSON.stringify(currentFrame.payload, null, 0)}
                </pre>
              ) : null}
            </div>
          </div>

          <div className="panel p-3">
            <div className="text-sm text-cold-mute mb-2">违规 / 扣分</div>
            {record.report.violations.length === 0 ? (
              <div className="text-xs text-cold-mute">无</div>
            ) : (
              <div className="flex flex-col gap-1 max-h-64 scroll-y">
                {record.report.violations.map((v) => (
                  <div
                    key={v.id}
                    className="text-[11px] font-mono text-amber-200/90 px-2 py-1 rounded bg-amber-500/5 border border-amber-400/20"
                  >
                    {v.message}
                    <span className="ml-1 text-rose-300">-{v.penalty}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel p-3">
            <div className="text-sm text-cold-mute mb-2">关卡信息</div>
            <div className="text-xs text-cold-text">
              难度 {level.difficulty} · 限定时长 {level.timeLimitSec}s · 货物 {level.cargos.length} 件
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
