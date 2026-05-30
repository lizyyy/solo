import { useGameStore } from "@/store/gameStore";
import type { WaveCard } from "@/types";
import { Lock, Unlock, Copy, Trash2, Plus } from "lucide-react";
import { COLORS } from "@/utils/colors";

function PhaseControl({
  card,
  disabled,
  onUpdate,
}: {
  card: WaveCard;
  disabled: boolean;
  onUpdate: (updates: Partial<WaveCard>) => void;
}) {
  const maxPhase = card.phaseUnit === "radian" ? 12.56 : 720;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs" style={{ color: COLORS.textSecondary }}>
          相位
        </label>
        <div className="flex gap-1">
          <button
            disabled={disabled}
            onClick={() => {
              if (card.phaseUnit !== "radian") {
                const converted = (card.phase * Math.PI) / 180;
                onUpdate({ phaseUnit: "radian", phase: Math.round(converted * 100) / 100 });
              }
            }}
            className="px-2 py-0.5 text-xs rounded"
            style={{
              backgroundColor: card.phaseUnit === "radian" ? COLORS.waveTeal : "transparent",
              color: card.phaseUnit === "radian" ? "#fff" : COLORS.textMuted,
              border: `1px solid ${card.phaseUnit === "radian" ? COLORS.waveTeal : COLORS.cardBorder}`,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            rad
          </button>
          <button
            disabled={disabled}
            onClick={() => {
              if (card.phaseUnit !== "degree") {
                const converted = (card.phase * 180) / Math.PI;
                onUpdate({ phaseUnit: "degree", phase: Math.round(converted * 100) / 100 });
              }
            }}
            className="px-2 py-0.5 text-xs rounded"
            style={{
              backgroundColor: card.phaseUnit === "degree" ? COLORS.waveTeal : "transparent",
              color: card.phaseUnit === "degree" ? "#fff" : COLORS.textMuted,
              border: `1px solid ${card.phaseUnit === "degree" ? COLORS.waveTeal : COLORS.cardBorder}`,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            deg
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={maxPhase}
          step={0.01}
          value={card.phase}
          disabled={disabled}
          onChange={(e) => onUpdate({ phase: parseFloat(e.target.value) })}
          className="flex-1"
          style={{ accentColor: COLORS.waveTeal, opacity: disabled ? 0.5 : 1 }}
        />
        <input
          type="number"
          min={0}
          max={maxPhase}
          step={0.01}
          value={card.phase}
          disabled={disabled}
          onChange={(e) => onUpdate({ phase: parseFloat(e.target.value) || 0 })}
          className="w-16 px-1 py-0.5 text-xs rounded text-center"
          style={{
            backgroundColor: "rgba(5, 14, 26, 0.8)",
            color: COLORS.textPrimary,
            border: `1px solid ${COLORS.cardBorder}`,
            opacity: disabled ? 0.5 : 1,
          }}
        />
      </div>
    </div>
  );
}

function WaveCardItem({
  card,
  canDelete,
}: {
  card: WaveCard;
  canDelete: boolean;
}) {
  const { updateCard, removeCard, duplicateCard, toggleCardLock } = useGameStore();
  const disabled = card.locked;

  return (
    <div
      className="p-3 mb-2 rounded-lg"
      style={{
        backgroundColor: COLORS.cardBg,
        borderLeft: `4px solid ${card.color}`,
        border: `1px solid ${COLORS.cardBorder}`,
        borderLeftWidth: "4px",
        borderLeftColor: card.color,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: card.color }}
          />
          <span className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>
            波形卡
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleCardLock(card.id)}
            className="p-1 rounded hover:opacity-80"
            style={{ color: card.locked ? COLORS.waveTeal : COLORS.textMuted }}
          >
            {card.locked ? <Lock size={14} /> : <Unlock size={14} />}
          </button>
          <button
            onClick={() => duplicateCard(card.id)}
            className="p-1 rounded hover:opacity-80"
            style={{ color: COLORS.textMuted }}
          >
            <Copy size={14} />
          </button>
          <button
            onClick={() => removeCard(card.id)}
            disabled={!canDelete}
            className="p-1 rounded hover:opacity-80"
            style={{
              color: canDelete ? COLORS.textMuted : COLORS.textMuted,
              cursor: canDelete ? "pointer" : "not-allowed",
              opacity: canDelete ? 1 : 0.3,
            }}
            onMouseEnter={(e) => {
              if (canDelete) e.currentTarget.style.color = COLORS.dangerRed;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = COLORS.textMuted;
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mb-2">
        <label className="text-xs mb-1 block" style={{ color: COLORS.textSecondary }}>
          振幅
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={5}
            step={0.1}
            value={card.amplitude}
            disabled={disabled}
            onChange={(e) => updateCard(card.id, { amplitude: parseFloat(e.target.value) })}
            className="flex-1"
            style={{ accentColor: COLORS.waveTeal, opacity: disabled ? 0.5 : 1 }}
          />
          <input
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={card.amplitude}
            disabled={disabled}
            onChange={(e) => updateCard(card.id, { amplitude: parseFloat(e.target.value) || 0 })}
            className="w-16 px-1 py-0.5 text-xs rounded text-center"
            style={{
              backgroundColor: "rgba(5, 14, 26, 0.8)",
              color: COLORS.textPrimary,
              border: `1px solid ${COLORS.cardBorder}`,
              opacity: disabled ? 0.5 : 1,
            }}
          />
        </div>
      </div>

      <div className="mb-2">
        <label className="text-xs mb-1 block" style={{ color: COLORS.textSecondary }}>
          频率
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={5}
            step={0.1}
            value={card.frequency}
            disabled={disabled}
            onChange={(e) => updateCard(card.id, { frequency: parseFloat(e.target.value) })}
            className="flex-1"
            style={{ accentColor: COLORS.waveTeal, opacity: disabled ? 0.5 : 1 }}
          />
          <input
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={card.frequency}
            disabled={disabled}
            onChange={(e) => updateCard(card.id, { frequency: parseFloat(e.target.value) || 0 })}
            className="w-16 px-1 py-0.5 text-xs rounded text-center"
            style={{
              backgroundColor: "rgba(5, 14, 26, 0.8)",
              color: COLORS.textPrimary,
              border: `1px solid ${COLORS.cardBorder}`,
              opacity: disabled ? 0.5 : 1,
            }}
          />
        </div>
      </div>

      <PhaseControl
        card={card}
        disabled={disabled}
        onUpdate={(updates) => updateCard(card.id, updates)}
      />
    </div>
  );
}

export default function WaveCardEditor() {
  const { playerWave, addCard } = useGameStore();

  return (
    <div className="flex flex-col h-full overflow-y-auto p-2">
      {playerWave.map((card) => (
        <WaveCardItem
          key={card.id}
          card={card}
          canDelete={playerWave.length > 1}
        />
      ))}
      <button
        onClick={addCard}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-white text-sm font-medium mt-1 hover:opacity-90"
        style={{
          background: `linear-gradient(to right, ${COLORS.waveTeal}, ${COLORS.oceanMid})`,
        }}
      >
        <Plus size={16} />
        添加波形
      </button>
    </div>
  );
}
