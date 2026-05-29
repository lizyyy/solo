import { useState, useMemo } from 'react';
import { Plus, Trash2, Calculator, AlertTriangle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useExhibitionStore } from '@/store/useExhibitionStore';
import type { ObstacleType } from '@/types';

const OBSTACLE_TYPES: { value: ObstacleType; label: string }[] = [
  { value: 'switch', label: '开关' },
  { value: 'fire_extinguisher', label: '灭火器' },
  { value: 'pipe', label: '管道' },
  { value: 'outlet', label: '插座' },
  { value: 'other', label: '其他' },
];

function WallCanvasPreview() {
  const { wall, artworks, obstacles } = useExhibitionStore();

  const previewScale = 4;
  const canvasW = wall.width / previewScale;
  const canvasH = wall.height / previewScale;

  const toCanvasX = (cm: number) => cm / previewScale;
  const toCanvasY = (cm: number) => (wall.height - cm) / previewScale;

  return (
    <div className="rounded-lg border border-[#D4CFC4]/60 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#2C2C2C]">墙面预览</h3>
        <span className="text-xs text-[#2C2C2C]/40 font-mono">
          {wall.width} × {wall.height} cm
        </span>
      </div>
      <div className="flex justify-center overflow-auto">
        <svg
          width={canvasW}
          height={canvasH}
          className="rounded border border-[#D4CFC4]/40 bg-[#FAFAF7]"
          style={{ minWidth: canvasW }}
        >
          {Array.from({ length: Math.floor(wall.height / 50) + 1 }).map((_, i) => (
            <line
              key={`h-${i}`}
              x1={0}
              y1={toCanvasY(i * 50)}
              x2={canvasW}
              y2={toCanvasY(i * 50)}
              stroke="#D4CFC4"
              strokeWidth={0.3}
              strokeDasharray="2,2"
            />
          ))}
          {Array.from({ length: Math.floor(wall.width / 50) + 1 }).map((_, i) => (
            <line
              key={`v-${i}`}
              x1={toCanvasX(i * 50)}
              y1={0}
              x2={toCanvasX(i * 50)}
              y2={canvasH}
              stroke="#D4CFC4"
              strokeWidth={0.3}
              strokeDasharray="2,2"
            />
          ))}

          <line
            x1={0}
            y1={toCanvasY(wall.sightLineHeight)}
            x2={canvasW}
            y2={toCanvasY(wall.sightLineHeight)}
            stroke="#C4623A"
            strokeWidth={0.8}
            strokeDasharray="4,2"
            opacity={0.7}
          />
          <text
            x={5}
            y={toCanvasY(wall.sightLineHeight) - 3}
            fill="#C4623A"
            fontSize={8}
            fontFamily="monospace"
            opacity={0.7}
          >
            视线 {wall.sightLineHeight}cm
          </text>

          {obstacles.map((obs) => (
            <g key={obs.id}>
              <defs>
                <pattern
                  id={`hatch-${obs.id}`}
                  patternUnits="userSpaceOnUse"
                  width={6}
                  height={6}
                  patternTransform="rotate(45)"
                >
                  <line x1={0} y1={0} x2={0} y2={6} stroke="#888" strokeWidth={0.5} />
                </pattern>
              </defs>
              <rect
                x={toCanvasX(obs.posX)}
                y={toCanvasY(obs.posY + obs.height)}
                width={obs.width / previewScale}
                height={obs.height / previewScale}
                fill={`url(#hatch-${obs.id})`}
                stroke="#555"
                strokeWidth={0.5}
              />
              <text
                x={toCanvasX(obs.posX) + 2}
                y={toCanvasY(obs.posY + obs.height) + 10}
                fill="#555"
                fontSize={8}
                fontFamily="monospace"
              >
                {obs.name}
              </text>
            </g>
          ))}

          {artworks.map((art) => (
            <g key={art.id}>
              <rect
                x={toCanvasX(art.posX)}
                y={toCanvasY(art.posY + art.frameHeight)}
                width={art.frameWidth / previewScale}
                height={art.frameHeight / previewScale}
                fill="#FAFAF7"
                stroke={art.hasCollision ? '#C4623A' : '#2C2C2C'}
                strokeWidth={art.hasCollision ? 1.2 : 0.6}
              />
              <text
                x={toCanvasX(art.posX) + 3}
                y={toCanvasY(art.posY + art.frameHeight / 2)}
                fill="#2C2C2C"
                fontSize={8}
                fontFamily="sans-serif"
                textAnchor="start"
              >
                {art.name}
              </text>
              {art.hasCollision && (
                <rect
                  x={toCanvasX(art.posX)}
                  y={toCanvasY(art.posY + art.frameHeight)}
                  width={art.frameWidth / previewScale}
                  height={art.frameHeight / previewScale}
                  fill="none"
                  stroke="#C4623A"
                  strokeWidth={2}
                  className="animate-pulse"
                />
              )}
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#2C2C2C]/50">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 border border-[#2C2C2C] bg-[#FAFAF7]" />
          <span>作品</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 border border-[#C4623A] bg-[#FAFAF7]" />
          <span>碰撞</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 border border-[#555] bg-[repeating-linear-gradient(45deg,#ccc,#ccc_1px,transparent_1px,transparent_3px)]" />
          <span>障碍物</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-[1px] w-4 bg-[#C4623A]" style={{ borderStyle: 'dashed' }} />
          <span>视线</span>
        </div>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  step,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-[#2C2C2C]/60">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        className="mt-1 w-full rounded border border-[#D4CFC4] bg-[#FAFAF7] px-3 py-1.5 text-sm text-[#2C2C2C] outline-none focus:border-[#C4623A]/60 placeholder:text-[#2C2C2C]/20"
      />
    </label>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-['Playfair_Display',serif] text-base font-semibold text-[#2C2C2C]">
        {title}
      </h3>
      {subtitle && <p className="mt-0.5 text-xs text-[#2C2C2C]/40">{subtitle}</p>}
    </div>
  );
}

export default function Workspace() {
  const {
    wall,
    artworks,
    obstacles,
    updateWall,
    addArtwork,
    removeArtwork,
    addObstacle,
    removeObstacle,
    calculateAll,
  } = useExhibitionStore();

  const [artworkForm, setArtworkForm] = useState({
    name: '',
    frameWidth: '80',
    frameHeight: '60',
    orderIndex: String(artworks.length + 1),
  });

  const [obstacleForm, setObstacleForm] = useState({
    name: '',
    obstacleType: 'switch' as ObstacleType,
    posX: '100',
    posY: '100',
    width: '20',
    height: '30',
  });

  const [showPreview, setShowPreview] = useState(true);

  const collisionCount = useMemo(
    () => artworks.filter((a) => a.hasCollision).length,
    [artworks]
  );

  const sortedArtworks = useMemo(
    () => [...artworks].sort((a, b) => a.orderIndex - b.orderIndex),
    [artworks]
  );

  const handleAddArtwork = () => {
    if (!artworkForm.name.trim()) return;
    addArtwork({
      name: artworkForm.name.trim(),
      frameWidth: Number(artworkForm.frameWidth),
      frameHeight: Number(artworkForm.frameHeight),
      orderIndex: Number(artworkForm.orderIndex),
    });
    setArtworkForm({
      name: '',
      frameWidth: '80',
      frameHeight: '60',
      orderIndex: String(artworks.length + 2),
    });
  };

  const handleAddObstacle = () => {
    if (!obstacleForm.name.trim()) return;
    addObstacle({
      name: obstacleForm.name.trim(),
      obstacleType: obstacleForm.obstacleType,
      posX: Number(obstacleForm.posX),
      posY: Number(obstacleForm.posY),
      width: Number(obstacleForm.width),
      height: Number(obstacleForm.height),
    });
    setObstacleForm({
      name: '',
      obstacleType: 'switch',
      posX: '100',
      posY: '100',
      width: '20',
      height: '30',
    });
  };

  const handleWallChange = (key: keyof typeof wall, value: string) => {
    updateWall({ [key]: Number(value) });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="space-y-8 lg:col-span-5">
        <section className="rounded-lg border border-[#D4CFC4]/60 bg-white p-5">
          <SectionHeader title="墙面配置" subtitle="定义墙面尺寸和视线参数" />
          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="墙面宽度 (cm)"
              value={wall.width}
              onChange={(v) => handleWallChange('width', v)}
              type="number"
              step="1"
            />
            <InputField
              label="墙面高度 (cm)"
              value={wall.height}
              onChange={(v) => handleWallChange('height', v)}
              type="number"
              step="1"
            />
            <InputField
              label="地面偏移 (cm)"
              value={wall.floorOffset}
              onChange={(v) => handleWallChange('floorOffset', v)}
              type="number"
              step="1"
              placeholder="如地台高度"
            />
            <InputField
              label="视线高度 (cm)"
              value={wall.sightLineHeight}
              onChange={(v) => handleWallChange('sightLineHeight', v)}
              type="number"
              step="1"
              placeholder="默认 160cm"
            />
          </div>
        </section>

        <section className="rounded-lg border border-[#D4CFC4]/60 bg-white p-5">
          <SectionHeader title="作品录入" subtitle="按展线顺序录入作品画框尺寸" />
          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="作品名称"
              value={artworkForm.name}
              onChange={(v) => setArtworkForm((f) => ({ ...f, name: v }))}
              placeholder="如《泉》"
            />
            <InputField
              label="展线顺序"
              value={artworkForm.orderIndex}
              onChange={(v) => setArtworkForm((f) => ({ ...f, orderIndex: v }))}
              type="number"
              step="1"
            />
            <InputField
              label="画框宽度 (cm)"
              value={artworkForm.frameWidth}
              onChange={(v) => setArtworkForm((f) => ({ ...f, frameWidth: v }))}
              type="number"
              step="1"
            />
            <InputField
              label="画框高度 (cm)"
              value={artworkForm.frameHeight}
              onChange={(v) => setArtworkForm((f) => ({ ...f, frameHeight: v }))}
              type="number"
              step="1"
            />
          </div>
          <button
            onClick={handleAddArtwork}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#2C2C2C] bg-[#2C2C2C] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2C2C2C]/90"
          >
            <Plus size={16} />
            添加作品
          </button>

          {sortedArtworks.length > 0 && (
            <div className="mt-5 border-t border-[#D4CFC4]/40 pt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-[#2C2C2C]/40">
                  共 {sortedArtworks.length} 件作品
                </span>
                {collisionCount > 0 ? (
                  <span className="flex items-center gap-1 text-xs text-[#C4623A]">
                    <AlertTriangle size={12} />
                    {collisionCount} 处碰撞
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 size={12} />
                    无碰撞
                  </span>
                )}
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {sortedArtworks.map((art) => (
                  <div
                    key={art.id}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${
                      art.hasCollision
                        ? 'border-orange-200 bg-orange-50/30'
                        : 'border-[#D4CFC4]/40 bg-[#FAFAF7]/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[#2C2C2C]/30">
                          #{art.orderIndex}
                        </span>
                        <span className="truncate text-sm font-medium text-[#2C2C2C]">
                          {art.name}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-[11px] text-[#2C2C2C]/50">
                        <span className="font-mono">
                          {art.frameWidth}×{art.frameHeight}
                        </span>
                        <span className="font-mono">
                          Y={art.posY}
                        </span>
                        <span
                          className={`font-mono ${
                            Math.abs(art.sightLineDeviation) > 20
                              ? 'text-[#C4623A]'
                              : ''
                          }`}
                        >
                          Δ{art.sightLineDeviation > 0 ? '+' : ''}
                          {art.sightLineDeviation}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeArtwork(art.id)}
                      className="ml-2 rounded p-1.5 text-[#2C2C2C]/20 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-[#D4CFC4]/60 bg-white p-5">
          <SectionHeader title="障碍物标注" subtitle="标注墙面开关、消防栓等障碍" />
          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="障碍物名称"
              value={obstacleForm.name}
              onChange={(v) => setObstacleForm((f) => ({ ...f, name: v }))}
              placeholder="如 西墙开关"
            />
            <div>
              <span className="block text-xs text-[#2C2C2C]/60">类型</span>
              <select
                value={obstacleForm.obstacleType}
                onChange={(e) =>
                  setObstacleForm((f) => ({
                    ...f,
                    obstacleType: e.target.value as ObstacleType,
                  }))
                }
                className="mt-1 w-full rounded border border-[#D4CFC4] bg-[#FAFAF7] px-3 py-1.5 text-sm text-[#2C2C2C] outline-none focus:border-[#C4623A]/60"
              >
                {OBSTACLE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <InputField
              label="位置 X (cm)"
              value={obstacleForm.posX}
              onChange={(v) => setObstacleForm((f) => ({ ...f, posX: v }))}
              type="number"
              step="1"
            />
            <InputField
              label="位置 Y (cm)"
              value={obstacleForm.posY}
              onChange={(v) => setObstacleForm((f) => ({ ...f, posY: v }))}
              type="number"
              step="1"
            />
            <InputField
              label="宽度 (cm)"
              value={obstacleForm.width}
              onChange={(v) => setObstacleForm((f) => ({ ...f, width: v }))}
              type="number"
              step="1"
            />
            <InputField
              label="高度 (cm)"
              value={obstacleForm.height}
              onChange={(v) => setObstacleForm((f) => ({ ...f, height: v }))}
              type="number"
              step="1"
            />
          </div>
          <button
            onClick={handleAddObstacle}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#D4CFC4] bg-[#FAFAF7] px-4 py-2 text-sm font-medium text-[#2C2C2C] transition-colors hover:border-[#2C2C2C]/40"
          >
            <Plus size={16} />
            添加障碍物
          </button>

          {obstacles.length > 0 && (
            <div className="mt-5 border-t border-[#D4CFC4]/40 pt-4">
              <div className="mb-2 text-xs text-[#2C2C2C]/40">
                共 {obstacles.length} 个障碍物
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {obstacles.map((obs) => (
                  <div
                    key={obs.id}
                    className="flex items-center justify-between rounded-lg border border-[#D4CFC4]/40 bg-[#FAFAF7]/50 px-3 py-2"
                  >
                    <div>
                      <span className="text-sm text-[#2C2C2C]">{obs.name}</span>
                      <div className="mt-0.5 text-[11px] text-[#2C2C2C]/50">
                        <span className="mr-2 rounded bg-[#D4CFC4]/40 px-1.5 py-0.5">
                          {OBSTACLE_TYPES.find((t) => t.value === obs.obstacleType)?.label}
                        </span>
                        <span className="font-mono">
                          ({obs.posX},{obs.posY}) {obs.width}×{obs.height}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeObstacle(obs.id)}
                      className="rounded p-1.5 text-[#2C2C2C]/20 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <button
          onClick={calculateAll}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#C4623A] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[#C4623A]/20 transition-all hover:bg-[#B05632] hover:shadow-md hover:shadow-[#C4623A]/30"
        >
          <Calculator size={16} />
          一键计算挂画高度
        </button>
      </div>

      <div className="lg:col-span-7">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-['Playfair_Display',serif] text-base font-semibold text-[#2C2C2C]">
            实时预览
          </h3>
          <button
            onClick={() => setShowPreview((s) => !s)}
            className="flex items-center gap-1 text-xs text-[#2C2C2C]/40 transition-colors hover:text-[#C4623A]"
          >
            {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
            {showPreview ? '隐藏' : '显示'}
          </button>
        </div>
        {showPreview && <WallCanvasPreview />}

        {collisionCount > 0 && (
          <div className="mt-6 rounded-lg border border-orange-200 bg-orange-50/50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-[#C4623A]" />
              <div>
                <h4 className="text-sm font-medium text-[#2C2C2C]">检测到 {collisionCount} 处碰撞</h4>
                <p className="mt-1 text-xs text-[#2C2C2C]/60">
                  请调整画框位置或使用「一键计算」自动避让。碰撞会以赭石橙色边框高亮显示。
                </p>
              </div>
            </div>
          </div>
        )}

        {artworks.some((a) => Math.abs(a.sightLineDeviation) > 20) && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
              <div>
                <h4 className="text-sm font-medium text-[#2C2C2C]">视线偏差警告</h4>
                <p className="mt-1 text-xs text-[#2C2C2C]/60">
                  以下作品中心高度偏离视线超过 20cm，可能影响观赏体验：
                </p>
                <ul className="mt-2 space-y-1">
                  {artworks
                    .filter((a) => Math.abs(a.sightLineDeviation) > 20)
                    .map((a) => (
                      <li key={a.id} className="text-xs text-[#2C2C2C]/70">
                        <span className="font-medium">{a.name}</span>
                        <span className="ml-2 font-mono">
                          偏差 {a.sightLineDeviation > 0 ? '+' : ''}
                          {a.sightLineDeviation}cm
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
