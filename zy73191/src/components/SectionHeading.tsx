export function SectionHeading({
  index,
  title,
  kicker,
}: {
  index: string;
  title: string;
  kicker?: string;
}) {
  return (
    <div className="mb-6 flex items-end gap-4 border-b border-rule pb-3">
      <span className="font-mono text-sm font-bold text-vermilion">§{index}</span>
      <div className="min-w-0">
        <h2 className="font-serif text-2xl font-bold leading-tight text-ink">
          {title}
        </h2>
        {kicker && <p className="mt-1 text-xs text-inkMute">{kicker}</p>}
      </div>
    </div>
  );
}
