import { Fingerprint } from 'lucide-react';
import { shortFingerprint } from '@/lib/fingerprint';

export function FingerprintTag({ fp, full }: { fp: string; full?: boolean }) {
  return (
    <span
      title={fp}
      className="mono inline-flex items-center gap-1 rounded-sm border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[11px] text-ink-200"
    >
      <Fingerprint className="h-3 w-3 text-accent" />
      {full ? fp : shortFingerprint(fp)}
    </span>
  );
}
