import { Link2 } from 'lucide-react';
import { useCarbonStore } from '@/store/useCarbonStore';

interface TraceableNumberProps {
  value: number;
  targetType: string;
  targetId: string;
  suffix?: string;
  prefix?: string;
}

export default function TraceableNumber({
  value,
  targetType,
  targetId,
  suffix,
  prefix,
}: TraceableNumberProps) {
  const openTrace = useCarbonStore((s) => s.openTrace);

  return (
    <span
      className="group inline-flex cursor-pointer items-baseline gap-1"
      onClick={() => openTrace(targetType, targetId)}
    >
      {prefix && <span className="text-sm text-cool-gray">{prefix}</span>}
      <span className="border-b border-dashed border-transparent decoration-forest-green/40 transition-colors group-hover:border-forest-green/40 group-hover:text-forest-green-700">
        {value.toLocaleString()}
      </span>
      {suffix && <span className="text-sm text-cool-gray">{suffix}</span>}
      <span className="trace-badge ml-0.5">
        <Link2 className="h-3 w-3" />
      </span>
    </span>
  );
}
