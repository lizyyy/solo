interface DataTagProps {
  tag: 'raw' | 'computed';
}

export default function DataTag({ tag }: DataTagProps) {
  const isRaw = tag === 'raw';
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide"
      style={{
        backgroundColor: isRaw ? 'rgba(0,229,199,0.15)' : 'rgba(251,191,36,0.15)',
        color: isRaw ? '#00e5c7' : '#fbbf24',
        border: `1px solid ${isRaw ? 'rgba(0,229,199,0.3)' : 'rgba(251,191,36,0.3)'}`,
      }}
    >
      {isRaw ? '原始信息' : '处理结果'}
    </span>
  );
}
