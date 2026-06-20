import { cn } from '@/lib/utils';
import { CATEGORY_EMOJI, CATEGORY_COLOR } from '@/constants/enums';
import type { RecallTag } from '@/types';

interface ExceptionBadgeProps {
  recall_tag: RecallTag | '正常';
  className?: string;
}

export default function ExceptionBadge({ recall_tag, className }: ExceptionBadgeProps) {
  return (
    <span
      className={cn(
        'badge',
        CATEGORY_COLOR[recall_tag],
        className,
      )}
    >
      <span>{CATEGORY_EMOJI[recall_tag]}</span>
      <span>{recall_tag}</span>
    </span>
  );
}
