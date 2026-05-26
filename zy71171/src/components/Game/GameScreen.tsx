import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Play, Pause } from "lucide-react";
import HUD from "@/components/Game/HUD";
import TruckGrid from "@/components/Game/TruckGrid";
import CargoPallet from "@/components/Game/CargoPallet";
import ResultModal from "@/components/Game/ResultModal";
import { useGameStore } from "@/store/useGameStore";
import { checkPlacement, finalize, PENALTIES } from "@/rules/engine";
import { ZONE_META, type Zone } from "@/types";
import { cn } from "@/lib/utils";

export default function GameScreen() {
  const { levelId } = useParams<{ levelId: string }>();
  const nav = useNavigate();
  const startLevel = useGameStore((s) => s.startLevel);
  const tick = useGameStore((s) => s.tick);
  const status = useGameStore((s) => s.status);
  const timeLeft = useGameStore((s) => s.timeLeft);
  const level = useGameStore((s) => s.level);
  const placed = useGameStore((s) => s.placed);
  const unplaced = useGameStore((s) => s.unplaced);
  const doorOpen = useGameStore((s) => s.doorOpen);
  const violations = useGameStore((s) => s.violations);
  const addViolation = useGameStore((s) => s.addViolation);
  const submit = useGameStore((s) => s.submit);
  const elapsedSec = useGameStore((s) => s.elapsedSec);
  const selectedCargoId = useGameStore((s) => s.selectedCargoId);
  const placeCargo = useGameStore((s) => s.placeCargo);
  const unplaceCargo = useGameStore((s) => s.unplaceCargo);
  const resume = useGameStore((s) => s.resume);

  const [hoverXY, setHoverXY] = useState<{ x: number; y: number } | null>(null);
  const [flashXY, setFlashXY] = useState<{ x: number; y: number } | null>(null);
  const [notice, setNotice] = useState<{ id: number; text: string; type: "warn" | "ok" } | null>(null);

  const startedRef = useRef(false);
  useEffect(() => {
    if (!levelId || startedRef.current) return;
    startLevel(levelId);
    startedRef.current = true;
  }, [levelId, startLevel]);

  useEffect(() => {
    if (status !== "playing") return;
    const id = window.setInterval(() => tick(1), 1000);
    return () => window.clearInterval(id);
  }, [status, tick]);

  const showNotice = (text: string, type: "warn" | "ok" = "warn") => {
    setNotice({ id: Date.now(), text, type });
    window.setTimeout(() => {
      setNotice((n) => (n && Date.now() - n.id >= 2000 ? null : n));
    }, 2400);
  };

  const handleSubmit = (timeout = false) => {
    if (!level) return;
    const result = finalize(level, placed, violations, timeLeft, timeout, Date.now());
    submit(result.won, result.reason, result.score, result.violations, {
      baseScore: result.baseScore,
      timeBonus: result.timeBonus,
      penaltyTotal: result.penaltyTotal,
    });
  };

  useEffect(() => {
    if (status === "playing" && timeLeft <= 0) {
      handleSubmit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, status]);

  const selectedCargo = useMemo(
    () => unplaced.find((c) => c.id === selectedCargoId),
    [unplaced, selectedCargoId]
  );

  const preview = useMemo(() => {
    if (!selectedCargo || !hoverXY || !level) return null;
    const check = checkPlacement(level, selectedCargo, hoverXY.x, hoverXY.y, placed, Date.now());
    return { ok: check.allowed, violations: check.violations.map((v) => v.message) };
  }, [selectedCargo, hoverXY, level, placed]);

  const onCellClick = (x: number, y: number) => {
    if (!level) return;
    const occupied = placed.find((p) => p.x === x && p.y === y);
    if (occupied) {
      unplaceCargo(occupied.cargoId);
      return;
    }
    if (!selectedCargo) {
      showNotice("请先在左侧货物库中选择一件货物");
      return;
    }
    const check = checkPlacement(level, selectedCargo, x, y, placed, Date.now());
    if (!check.allowed && check.violations.some((v) => v.message === "该格已占用")) {
      showNotice("该格已占用");
      return;
    }
    const ok = placeCargo(x, y);
    if (!ok) return;
    check.violations.forEach((v) => addViolation(v));
    if (check.violations.length > 0) {
      setFlashXY({ x, y });
      window.setTimeout(() => setFlashXY(null), 700);
      showNotice(check.violations[0].message);
    }
  };

  useEffect(() => {
    if (status !== "playing" || !level || !doorOpen) return;
    if (elapsedSec > 0 && elapsedSec % 30 === 0) {
      const hasSensitive = placed.some((p) => {
        const c = level.cargos.find((x) => x.id === p.cargoId);
        return c && (c.zone === "frozen" || c.zone === "chilled");
      });
      if (hasSensitive) showNotice("车门持续开启，敏感货物有升温风险");
    }
  }, [elapsedSec, status, level, doorOpen, placed]);

  if (!level) {
    return (
      <div className="min-h-full flex items-center justify-center text-cold-mute">
        加载关卡 {levelId} ...
      </div>
    );
  }

  const cellSize = level.gridW > 8 ? 48 : 56;

  return (
    <div className="min-h-full flex flex-col">
      <div className="px-6 py-3 border-b border-cold-line flex items-center gap-3">
        <button className="btn" onClick={() => nav("/")}>
          <ArrowLeft className="w-4 h-4" /> 返回
        </button>
        <div className="text-sm text-cold-mute">关卡说明：{level.description}</div>
      </div>

      <div className="px-6 py-3">
        <HUD onSubmit={() => handleSubmit(false)} />
      </div>

      <div className="flex-1 px-6 pb-6 flex flex-col lg:flex-row gap-4 items-start">
        <CargoPallet />

        <div className="flex-1 flex flex-col gap-3 items-center">
          <TruckGrid
            cellSize={cellSize}
            onHoverCell={(x, y) => setHoverXY(x < 0 ? null : { x, y })}
            onCellClick={onCellClick}
            hoverXY={hoverXY}
            flashXY={flashXY}
          />

          {selectedCargo && preview && (
            <div
              className={cn(
                "panel px-3 py-2 text-xs font-mono w-fit max-w-xl",
                preview.ok ? "text-emerald-300" : "text-amber-300"
              )}
            >
              {preview.ok ? (
                <>放置 {selectedCargo.name} ({ZONE_META[selectedCargo.zone].label}) 预览：合规</>
              ) : (
                <>
                  <AlertTriangle className="inline w-3 h-3 mr-1" />
                  放置 {selectedCargo.name} 将导致：{preview.violations.join("；")}
                </>
              )}
            </div>
          )}

          {notice && (
            <div
              className={cn(
                "panel px-3 py-2 text-xs",
                notice.type === "warn" ? "text-amber-300" : "text-emerald-300"
              )}
            >
              {notice.text}
            </div>
          )}

          <div className="panel px-3 py-2 text-[11px] text-cold-mute w-fit">
            操作：先点选左侧货物 → 点击车厢空格放置；点击已放货物可卸回。
          </div>
        </div>

        <div className="w-64 flex flex-col gap-3">
          <div className="panel p-3">
            <div className="text-sm text-cold-mute mb-2">实时判责</div>
            {violations.length === 0 ? (
              <div className="text-xs text-cold-mute">暂无违规</div>
            ) : (
              <div className="flex flex-col gap-1 max-h-64 scroll-y">
                {violations.slice(-20).map((v) => (
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

          <div className="panel p-3 text-xs text-cold-text/80">
            <div className="text-cold-mute mb-1">温层规则</div>
            <ul className="space-y-1 list-disc pl-4">
              <li>货物须放入匹配温区格（扣 {PENALTIES.zone_mismatch}）</li>
              <li>冻品不可与常温相邻（扣 {PENALTIES.adjacent_zone}）</li>
              <li>先卸货 (# 小) 须靠近车门一侧（扣 {PENALTIES.unload_blocked}）</li>
              <li>开门超时，冻/冷藏判损（扣 {PENALTIES.temp_rise}）</li>
            </ul>
          </div>

          <div className="panel p-3 text-xs text-cold-text/80">
            <div className="text-cold-mute mb-1">温层色板</div>
            <div className="flex flex-col gap-1">
              {(Object.keys(ZONE_META) as Zone[]).map((z) => (
                <div key={z} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded" style={{ background: ZONE_META[z].color }} />
                  <span>{ZONE_META[z].label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ResultModal />

      {status === "paused" && (
        <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="panel px-8 py-6 text-center">
            <div className="text-2xl font-display font-bold text-white mb-2">已暂停</div>
            <div className="text-sm text-cold-mute mb-4">按空格或点击下方继续</div>
            <button className="btn btn-primary" onClick={resume}>
              <Play className="w-4 h-4" /> 继续
            </button>
            <button
              className="btn ml-2"
              onClick={() => {
                if (confirm("确定重新开始本关？")) useGameStore.getState().resetLevel();
              }}
            >
              <Pause className="w-4 h-4" /> 重开
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
