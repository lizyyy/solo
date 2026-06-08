import { ABNORMAL_LABEL, type AbnormalType } from '@/types';

const COLOR: Record<AbnormalType, string> = {
  weight_mismatch: 'bg-status-hold/12 text-status-hold border-status-hold/30',
  weight_unit_mixed: 'bg-status-hold/18 text-status-hold border-status-hold/50',
  phone_mismatch: 'bg-status-wait/15 text-status-wait border-status-wait/45',
  date_mismatch: 'bg-status-wait/12 text-status-wait border-status-wait/35',
  breed_mismatch: 'bg-brand-teal/12 text-brand-teal border-brand-teal/35',
  supplement_mismatch: 'bg-[#6D597A]/12 text-[#6D597A] border-[#6D597A]/35',
};

export default function AbnormalBadge({ type }: { type: AbnormalType }) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 text-[11px] rounded-md border font-kai whitespace-nowrap',
        COLOR[type],
      ].join(' ')}
    >
      {ABNORMAL_LABEL[type]}
    </span>
  );
}
