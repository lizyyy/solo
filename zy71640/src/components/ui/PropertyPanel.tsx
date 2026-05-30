import { useExhibitionStore } from '@/store/useExhibitionStore'
import SourceTag from './SourceTag'
import ValidationBadge from './ValidationBadge'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xs text-zinc-200">{children}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h4 className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">{title}</h4>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function ArtworkPanel() {
  const selectedId = useExhibitionStore((s) => s.selectedId)
  const artworks = useExhibitionStore((s) => s.artworks)
  const walls = useExhibitionStore((s) => s.walls)
  const conflicts = useExhibitionStore((s) => s.conflicts)
  const artwork = artworks.find((a) => a.id === selectedId)
  if (!artwork) return null

  const wall = walls.find((w) => w.id === artwork.wallId)
  const affectedConflicts = conflicts.filter((c) => c.affectedIds.includes(artwork.id) && !c.resolvedAt)

  return (
    <>
      <Section title="基本信息">
        <Field label="标题">{artwork.title}</Field>
        <Field label="尺寸">{`${artwork.width}×${artwork.height}×${artwork.depth}`}</Field>
      </Section>
      <Section title="位置">
        <Field label="X">{artwork.posX.toFixed(2)}</Field>
        <Field label="Y">{artwork.posY.toFixed(2)}</Field>
        <Field label="Z">{artwork.posZ.toFixed(2)}</Field>
        <Field label="旋转">{`${artwork.rotY}°`}</Field>
      </Section>
      <Section title="归属">
        <Field label="墙面">{wall ? `墙面 ${wall.id.slice(-4)}` : '—'}</Field>
        <Field label="数据来源"><SourceTag sourceId={artwork.sourceId} /></Field>
        <Field label="验证状态"><ValidationBadge status={artwork.validationStatus} /></Field>
      </Section>
      {affectedConflicts.length > 0 && (
        <Section title="相关冲突">
          {affectedConflicts.map((c) => (
            <div key={c.id} className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-300">
              {c.description}
            </div>
          ))}
        </Section>
      )}
    </>
  )
}

function LightPanel() {
  const selectedId = useExhibitionStore((s) => s.selectedId)
  const lights = useExhibitionStore((s) => s.lights)
  const light = lights.find((l) => l.id === selectedId)
  if (!light) return null

  return (
    <>
      <Section title="基本信息">
        <Field label="类型">{light.type}</Field>
      </Section>
      <Section title="位置">
        <Field label="X">{light.posX.toFixed(2)}</Field>
        <Field label="Y">{light.posY.toFixed(2)}</Field>
        <Field label="Z">{light.posZ.toFixed(2)}</Field>
      </Section>
      <Section title="参数">
        <Field label="强度">{light.intensity}</Field>
        <Field label="范围">{light.range}</Field>
        <Field label="颜色">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: light.color }} />
            {light.color}
          </span>
        </Field>
      </Section>
      <Section title="归属">
        <Field label="数据来源"><SourceTag sourceId={light.sourceId} /></Field>
        <Field label="验证状态"><ValidationBadge status={light.validationStatus} /></Field>
      </Section>
    </>
  )
}

function PathPanel() {
  const selectedId = useExhibitionStore((s) => s.selectedId)
  const paths = useExhibitionStore((s) => s.paths)
  const conflicts = useExhibitionStore((s) => s.conflicts)
  const path = paths.find((p) => p.id === selectedId)
  if (!path) return null

  const totalTime = path.points.length > 0
    ? path.points[path.points.length - 1].time - path.points[0].time
    : 0

  const affectedConflicts = conflicts.filter((c) => c.affectedIds.includes(path.id) && !c.resolvedAt)

  return (
    <>
      <Section title="基本信息">
        <Field label="名称">{path.name}</Field>
        <Field label="路径点数">{path.points.length}</Field>
        <Field label="总时长">{`${totalTime.toFixed(1)}s`}</Field>
      </Section>
      <Section title="归属">
        <Field label="数据来源"><SourceTag sourceId={path.sourceId} /></Field>
        <Field label="验证状态"><ValidationBadge status={path.validationStatus} /></Field>
      </Section>
      {affectedConflicts.length > 0 && (
        <Section title="相关冲突">
          {affectedConflicts.map((c) => (
            <div key={c.id} className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-300">
              {c.description}
            </div>
          ))}
        </Section>
      )}
    </>
  )
}

function WallPanel() {
  const selectedId = useExhibitionStore((s) => s.selectedId)
  const walls = useExhibitionStore((s) => s.walls)
  const wall = walls.find((w) => w.id === selectedId)
  if (!wall) return null

  const dx = wall.endX - wall.startX
  const dz = wall.endZ - wall.startZ
  const length = Math.sqrt(dx * dx + dz * dz)

  return (
    <>
      <Section title="尺寸">
        <Field label="长度">{length.toFixed(2)}</Field>
        <Field label="高度">{wall.height.toFixed(2)}</Field>
      </Section>
      <Section title="起点">
        <Field label="X">{wall.startX.toFixed(2)}</Field>
        <Field label="Y">{wall.startY.toFixed(2)}</Field>
        <Field label="Z">{wall.startZ.toFixed(2)}</Field>
      </Section>
      <Section title="终点">
        <Field label="X">{wall.endX.toFixed(2)}</Field>
        <Field label="Y">{wall.endY.toFixed(2)}</Field>
        <Field label="Z">{wall.endZ.toFixed(2)}</Field>
      </Section>
      <Section title="归属">
        <Field label="数据来源"><SourceTag sourceId={wall.sourceId} /></Field>
      </Section>
    </>
  )
}

export default function PropertyPanel() {
  const selectedId = useExhibitionStore((s) => s.selectedId)
  const selectedType = useExhibitionStore((s) => s.selectedType)

  if (!selectedId || !selectedType) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-center text-xs text-zinc-500">点击3D场景中的对象查看详情</p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto p-3">
      {selectedType === 'artwork' && <ArtworkPanel />}
      {selectedType === 'light' && <LightPanel />}
      {selectedType === 'path' && <PathPanel />}
      {selectedType === 'wall' && <WallPanel />}
    </div>
  )
}
