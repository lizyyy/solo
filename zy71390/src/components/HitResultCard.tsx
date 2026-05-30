import { AlertTriangle, Shield, ShieldOff } from 'lucide-react';
import type { HitResult } from '../../shared/types';
import { HIT_REASON_LABELS, TIER_COLORS, TIER_LABELS } from '../../shared/types';
import { cn } from '@/lib/utils';

interface HitResultCardProps {
  hit: HitResult;
}

export default function HitResultCard({ hit }: HitResultCardProps) {
  const tierColor = TIER_COLORS[hit.customerTier];

  return (
    <div className="card p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${tierColor}20` }}
        >
          {hit.wouldBlock ? (
            <ShieldOff className="w-6 h-6 text-danger" />
          ) : (
            <Shield className="w-6 h-6 text-warning" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: `${tierColor}20`, color: tierColor }}
            >
              {TIER_LABELS[hit.customerTier]}
            </span>
            <span
              className={cn(
                'px-2 py-0.5 rounded text-xs font-medium',
                hit.hitReason === 'false_positive'
                  ? 'bg-warning/20 text-warning'
                  : 'bg-danger/20 text-danger'
              )}
            >
              {HIT_REASON_LABELS[hit.hitReason]}
            </span>
            {hit.wouldBlock && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-danger/20 text-danger">
                会拦截
              </span>
            )}
          </div>

          <h4 className="text-white font-medium mb-1">
            {hit.customerName}
          </h4>

          <p className="text-sm text-slate-400 mb-2">
            {hit.explanation}
          </p>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>
              规则版本: v{hit.ruleVersion}
            </span>
            <span>
              置信度: {Math.round(hit.confidence * 100)}%
            </span>
            <span>
              {new Date(hit.requestTimestamp).toLocaleString('zh-CN')}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <code className="text-xs bg-dark px-2 py-1 rounded text-slate-300">
              {hit.requestPath}
            </code>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <AlertTriangle
            className={cn(
              'w-5 h-5',
              hit.hitReason === 'false_positive' ? 'text-warning' : 'text-danger'
            )}
          />
        </div>
      </div>
    </div>
  );
}
