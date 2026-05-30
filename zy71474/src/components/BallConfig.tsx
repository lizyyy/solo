import { Plus, Trash2, Play, RotateCcw } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { CollisionType } from '@/types';

const COLLISION_TYPES: { value: CollisionType; label: string }[] = [
  { value: 'elastic', label: '弹性' },
  { value: 'inelastic', label: '非弹性' },
  { value: 'perfectly_inelastic', label: '完全非弹性' },
];

export default function BallConfig() {
  const balls = useStore((s) => s.balls);
  const collisionType = useStore((s) => s.collisionType);
  const restitution = useStore((s) => s.restitution);
  const simulationStatus = useStore((s) => s.simulationStatus);
  const addBall = useStore((s) => s.addBall);
  const removeBall = useStore((s) => s.removeBall);
  const updateBall = useStore((s) => s.updateBall);
  const setCollisionType = useStore((s) => s.setCollisionType);
  const setRestitution = useStore((s) => s.setRestitution);
  const startSimulation = useStore((s) => s.startSimulation);
  const resetSimulation = useStore((s) => s.resetSimulation);

  const isPaused = simulationStatus === 'paused';
  const isIdle = simulationStatus === 'idle';

  return (
    <div className="bg-brand-card rounded-xl border border-brand-border p-4 space-y-4 font-body">
      <h2 className="font-display text-sm text-brand-cyan">小球配置</h2>

      <div className="space-y-3">
        {balls.map((ball) => (
          <div
            key={ball.id}
            className="bg-brand-surface rounded-lg border border-brand-border p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: ball.color }}
                />
                <span className="text-xs text-brand-muted">ID:{ball.id.slice(0, 6)}</span>
              </div>
              {balls.length > 1 && isIdle && (
                <button
                  onClick={() => removeBall(ball.id)}
                  className="text-brand-red hover:text-brand-red/80 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div>
              <div className="flex justify-between text-xs text-brand-muted mb-1">
                <span>质量</span>
                <span className="font-display text-brand-text">{ball.mass.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                step={0.1}
                value={ball.mass}
                onChange={(e) => updateBall(ball.id, { mass: Number(e.target.value) })}
                disabled={!isIdle}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-brand-muted mb-1">
                <span>速度</span>
                <span className="font-display text-brand-text">{ball.velocity.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={-20}
                max={20}
                step={0.1}
                value={ball.velocity}
                onChange={(e) => updateBall(ball.id, { velocity: Number(e.target.value) })}
                disabled={!isIdle}
                className="w-full"
              />
            </div>
          </div>
        ))}
      </div>

      {isIdle && (
        <button
          onClick={addBall}
          disabled={balls.length >= 5}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-brand-border text-sm text-brand-muted hover:text-brand-text hover:border-brand-cyan transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} />
          添加小球
        </button>
      )}

      <div>
        <h3 className="text-xs text-brand-muted mb-2">碰撞类型</h3>
        <div className="flex gap-1">
          {COLLISION_TYPES.map((ct) => (
            <button
              key={ct.value}
              onClick={() => setCollisionType(ct.value)}
              disabled={!isIdle}
              className={`flex-1 py-1.5 rounded text-xs font-body transition-colors ${
                collisionType === ct.value
                  ? 'bg-brand-cyan text-brand-bg'
                  : 'bg-brand-surface text-brand-muted hover:text-brand-text'
              } disabled:opacity-40`}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {collisionType === 'inelastic' && (
        <div>
          <div className="flex justify-between text-xs text-brand-muted mb-1">
            <span>恢复系数</span>
            <span className="font-display text-brand-text">{restitution.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={restitution}
            onChange={(e) => setRestitution(Number(e.target.value))}
            disabled={!isIdle}
            className="w-full"
          />
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={startSimulation}
          disabled={!isIdle && !isPaused}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-brand-orange text-white text-sm font-body hover:bg-brand-orange/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play size={14} />
          {isPaused ? '继续' : '开始'}
        </button>
        <button
          onClick={resetSimulation}
          disabled={isIdle}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-brand-border text-sm text-brand-muted hover:text-brand-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw size={14} />
          重置
        </button>
      </div>
    </div>
  );
}
