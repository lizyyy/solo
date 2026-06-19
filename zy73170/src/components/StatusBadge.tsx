import { CircleHelp } from 'lucide-react';
import { useState } from 'react';
import type { SampleStatus } from '../types';
import { statusColorMap } from '../utils/format';

interface Props {
  status: SampleStatus;
  showEmptyTooltip?: boolean;
}

export default function StatusBadge({ status, showEmptyTooltip = true }: Props) {
  const c = statusColorMap[status];
  const [tip, setTip] = useState(false);

  return (
    <span
      className={`chip ${c.bg} ${c.text} ${c.border} relative`}
      onMouseEnter={() => setTip(true)}
      onMouseLeave={() => setTip(false)}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status}
      {status === '空集合' && showEmptyTooltip && (
        <CircleHelp className="w-3 h-3 ml-0.5 opacity-60" />
      )}
      {tip && status === '空集合' && showEmptyTooltip && (
        <span className="absolute left-1/2 -translate-x-1/2 -bottom-1 translate-y-full z-30 mt-2 w-72 text-xs font-normal bg-ink-900 text-white rounded-md px-3 py-2 shadow-pop leading-relaxed pointer-events-none animate-fadeUp">
          空集合 ∅ 在图论中为合法输入/输出，表示"不存在从起点到终点的可达路径"。学生正确输出 ∅ 属于正常作答，不是程序异常。
        </span>
      )}
    </span>
  );
}
