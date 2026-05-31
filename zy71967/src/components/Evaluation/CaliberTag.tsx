export default function CaliberTag({ label }: { label: string }) {
  return <span className="inline-block rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">{`口径：${label}`}</span>
}
