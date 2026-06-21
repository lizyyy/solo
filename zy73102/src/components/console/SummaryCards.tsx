import { useEffect, useState } from 'react';
import { Layers, AlertTriangle, Shapes, Tag, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SummaryCardsProps {
  totalMaterials: number;
  totalAbnormal: number;
  totalCollision: number;
  latestVersion: string;
}

interface CardItem {
  label: string;
  key: keyof SummaryCardsProps;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  accentColor: string;
  unit?: string;
  isVersion?: boolean;
}

const cardConfig: CardItem[] = [
  {
    label: '材料总数',
    key: 'totalMaterials',
    icon: Layers,
    iconBg: 'bg-blue-50',
    iconColor: 'text-engineering-blue',
    accentColor: 'text-engineering-blue',
    unit: '件',
  },
  {
    label: '异常数',
    key: 'totalAbnormal',
    icon: AlertTriangle,
    iconBg: 'bg-orange-50',
    iconColor: 'text-warning-orange',
    accentColor: 'text-warning-orange',
    unit: '项',
  },
  {
    label: '碰撞数',
    key: 'totalCollision',
    icon: Shapes,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
    accentColor: 'text-red-500',
    unit: '处',
  },
  {
    label: '最新版本号',
    key: 'latestVersion',
    icon: Tag,
    iconBg: 'bg-green-50',
    iconColor: 'text-pass-green',
    accentColor: 'text-pass-green',
    isVersion: true,
  },
];

function AnimatedNumber({ value, isVersion }: { value: number | string; isVersion?: boolean }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (isVersion) {
      setDisplayValue(value);
      return;
    }

    const target = typeof value === 'number' ? value : 0;
    const start = 0;
    const duration = 600;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(start + (target - start) * easeOutQuart);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, isVersion]);

  return (
    <span className="font-mono font-semibold text-[28px] leading-none tracking-tight tabular-nums">
      {isVersion ? value : displayValue}
    </span>
  );
}

export default function SummaryCards({
  totalMaterials,
  totalAbnormal,
  totalCollision,
  latestVersion,
}: SummaryCardsProps) {
  const values: Record<keyof SummaryCardsProps, number | string> = {
    totalMaterials,
    totalAbnormal,
    totalCollision,
    latestVersion,
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cardConfig.map((card) => (
        <div
          key={card.key}
          className={cn(
            'bg-white rounded-xl card-shadow p-4.5 transition-all duration-300',
            'hover:shadow-md hover:-translate-y-0.5'
          )}
          style={{ padding: '18px' }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', card.iconBg)}>
              <card.icon className={cn('w-5 h-5', card.iconColor)} strokeWidth={1.8} />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline gap-1.5">
              <AnimatedNumber value={values[card.key]} isVersion={card.isVersion} />
              {!card.isVersion && card.unit && (
                <span className={cn('text-sm font-medium', card.accentColor)}>{card.unit}</span>
              )}
            </div>
            <p className="text-xs text-concrete-gray font-medium">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
