import { useState } from "react"
import { ChevronDown, ChevronRight, MapPin, Clock, FileText, Sun } from "lucide-react"
import { useSchemeStore } from "@/store/useSchemeStore"

function Section({ title, icon, defaultOpen, children }: {
  title: string
  icon: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? true)
  return (
    <div className="border-b border-slate-700">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700/50 transition-colors"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {icon}
        {title}
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? 500 : 0, opacity: open ? 1 : 0 }}
      >
        <div className="px-4 pb-4 space-y-3">{children}</div>
      </div>
    </div>
  )
}

function NumberField({ label, value, step, min, max, onChange }: {
  label: string
  value: number
  step?: number
  min?: number
  max?: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400 mb-1 block">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(min ?? -Infinity, value - (step ?? 1)))}
          className="w-7 h-7 rounded bg-slate-700 text-slate-300 flex items-center justify-center hover:bg-amber-600 hover:text-white transition-colors text-xs"
        >−</button>
        <input
          type="number"
          value={value}
          step={step ?? 1}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-7 rounded bg-slate-900 border border-slate-600 text-center text-sm font-mono text-amber-400 focus:border-amber-500 focus:outline-none"
        />
        <button
          onClick={() => onChange(Math.min(max ?? Infinity, value + (step ?? 1)))}
          className="w-7 h-7 rounded bg-slate-700 text-slate-300 flex items-center justify-center hover:bg-amber-600 hover:text-white transition-colors text-xs"
        >+</button>
      </div>
    </label>
  )
}

function SunCompass({ altitude, azimuth }: { altitude: number; azimuth: number }) {
  const azRad = ((azimuth - 90) * Math.PI) / 180
  const r = 28
  const sx = 40 + r * Math.cos(azRad)
  const sy = 40 - r * Math.sin(azRad)
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" className="mx-auto">
      <circle cx="40" cy="40" r="30" fill="none" stroke="#475569" strokeWidth="1" />
      <circle cx="40" cy="40" r="2" fill="#94a3b8" />
      <text x="40" y="10" textAnchor="middle" className="fill-slate-500 text-[8px]">北</text>
      <text x="72" y="43" textAnchor="middle" className="fill-slate-500 text-[8px]">东</text>
      <text x="40" y="76" textAnchor="middle" className="fill-slate-500 text-[8px]">南</text>
      <text x="8" y="43" textAnchor="middle" className="fill-slate-500 text-[8px]">西</text>
      <line x1="40" y1="40" x2={sx} y2={sy} stroke="#f59e0b" strokeWidth="2" />
      <circle cx={sx} cy={sy} r="4" fill="#f59e0b" />
      <text x="40" y="68" textAnchor="middle" className="fill-amber-400 text-[7px]">
        高度 {altitude.toFixed(1)}°
      </text>
    </svg>
  )
}

export default function ParameterPanel() {
  const scheme = useSchemeStore((s) => s.currentScheme)
  const update = useSchemeStore((s) => s.updateSchemeParams)

  return (
    <aside className="w-72 bg-slate-800 text-slate-200 flex flex-col h-full overflow-y-auto font-['DM_Sans',sans-serif]">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
        <Sun size={18} className="text-amber-500" />
        <h2 className="text-sm font-bold tracking-wide text-amber-400 font-['DM_Sans',sans-serif]">
          光伏园区阴影模型
        </h2>
      </div>

      <Section title="园区位置" icon={<MapPin size={14} className="text-amber-500" />}>
        <NumberField
          label="纬度"
          value={scheme.latitude}
          step={0.1}
          min={-90}
          max={90}
          onChange={(v) => update({ latitude: v })}
        />
        <NumberField
          label="经度"
          value={scheme.longitude}
          step={0.1}
          min={-180}
          max={180}
          onChange={(v) => update({ longitude: v })}
        />
      </Section>

      <Section title="时间参数" icon={<Clock size={14} className="text-amber-500" />}>
        <label className="block">
          <span className="text-xs text-slate-400 mb-1 block">日期</span>
          <input
            type="date"
            value={scheme.date}
            onChange={(e) => update({ date: e.target.value })}
            className="w-full h-7 rounded bg-slate-900 border border-slate-600 text-sm font-mono text-amber-400 px-2 focus:border-amber-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs text-slate-400 mb-1 block">时间</span>
          <input
            type="time"
            value={scheme.time}
            onChange={(e) => update({ time: e.target.value })}
            className="w-full h-7 rounded bg-slate-900 border border-slate-600 text-sm font-mono text-amber-400 px-2 focus:border-amber-500 focus:outline-none"
          />
        </label>
        <NumberField
          label="太阳高度角 (°)"
          value={scheme.sunAltitude}
          step={0.5}
          min={0}
          max={90}
          onChange={(v) => update({ sunAltitude: v })}
        />
        <NumberField
          label="太阳方位角 (°)"
          value={scheme.sunAzimuth}
          step={1}
          min={0}
          max={360}
          onChange={(v) => update({ sunAzimuth: v })}
        />
        <SunCompass altitude={scheme.sunAltitude} azimuth={scheme.sunAzimuth} />
      </Section>

      <Section title="方案信息" icon={<FileText size={14} className="text-amber-500" />}>
        <label className="block">
          <span className="text-xs text-slate-400 mb-1 block">方案名称</span>
          <input
            type="text"
            value={scheme.name}
            onChange={(e) => update({ name: e.target.value })}
            className="w-full h-7 rounded bg-slate-900 border border-slate-600 text-sm text-amber-400 px-2 focus:border-amber-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs text-slate-400 mb-1 block">备注</span>
          <textarea
            value={scheme.note}
            onChange={(e) => update({ note: e.target.value })}
            rows={3}
            className="w-full rounded bg-slate-900 border border-slate-600 text-sm text-slate-300 px-2 py-1 focus:border-amber-500 focus:outline-none resize-none"
          />
        </label>
      </Section>
    </aside>
  )
}
