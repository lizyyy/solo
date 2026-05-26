import { useGameStore } from "../game/store";
import { COLOR_LABELS, SheetFormat, SHEET_SIZES } from "../game/types";
import { Play, Square, RotateCcw } from "lucide-react";

export default function ActionBar() {
  const state = useGameStore((s) => s.state);
  const addSheet = useGameStore((s) => s.addSheet);
  const setInk = useGameStore((s) => s.setInk);
  const imposeSelected = useGameStore((s) => s.imposeSelectedOnSheet);
  const endDay = useGameStore((s) => s.endDay);
  const resetGame = useGameStore((s) => s.resetGame);
  const togglePause = useGameStore((s) => s.togglePause);

  if (!state) return null;
  const selectedSheet = state.sheets.find((s) => s.id === state.selectedSheetId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="text-[11px] text-[#0A1F44]/70">新版：</div>
      {state.level.formats.map((f) => (
        <button
          key={f}
          className="btn-secondary text-xs"
          onClick={() => addSheet(f as SheetFormat)}
          disabled={state.sheets.length >= 6}
        >
          +{SHEET_SIZES[f].label}
        </button>
      ))}
      <div className="h-6 w-px bg-[#0A1F44]/20 mx-2" />
      <button
        className="btn-primary text-xs"
        disabled={!state.selectedOrderId || !selectedSheet || selectedSheet.used}
        onClick={() => selectedSheet && imposeSelected(selectedSheet.id)}
      >
        拼版到选中版
      </button>
      <div className="h-6 w-px bg-[#0A1F44]/20 mx-2" />
      <div className="text-[11px] text-[#0A1F44]/70">上墨：</div>
      {state.level.allowedColors.map((c) => (
        <button
          key={c}
          className="btn-ghost text-xs"
          style={{ borderColor: COLOR_LABELS[c].css }}
          disabled={!selectedSheet || selectedSheet.used}
          onClick={() => selectedSheet && setInk(selectedSheet.id, c)}
        >
          {COLOR_LABELS[c].label}
        </button>
      ))}
      <div className="flex-1" />
      <button
        className="btn-secondary text-xs"
        onClick={togglePause}
        disabled={state.finished}
      >
        {state.paused ? "继续" : "暂停"}
      </button>
      <button className="btn-secondary text-xs" onClick={resetGame}>
        <RotateCcw className="w-3 h-3 inline mr-1" />
        重开
      </button>
      <button
        className="btn-primary text-xs"
        onClick={endDay}
        disabled={state.finished}
      >
        <Play className="w-3 h-3 inline mr-1" />
        结束回合
      </button>
      <button
        className="btn-danger text-xs"
        onClick={() => useGameStore.getState().quitGame()}
      >
        <Square className="w-3 h-3 inline mr-1" />
        退出
      </button>
    </div>
  );
}
