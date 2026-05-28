import { motion } from 'framer-motion';
import { AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

type RiskLevel = 'low' | 'medium' | 'high';

interface RiskBadgeProps {
  level: RiskLevel;
  showLabel?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const riskConfig: Record<RiskLevel, {
  bgColor: string;
  borderColor: string;
  textColor: string;
  label: string;
  glow: string;
}> = {
  low: {
    bgColor: 'bg-success-green/10',
    borderColor: 'border-success-green',
    textColor: 'text-success-green',
    label: '低风险',
    glow: '0 0 10px rgba(74, 222, 128, 0.5)',
  },
  medium: {
    bgColor: 'bg-warning-orange/10',
    borderColor: 'border-warning-orange',
    textColor: 'text-warning-orange',
    label: '中风险',
    glow: '0 0 10px rgba(255, 154, 60, 0.5)',
  },
  high: {
    bgColor: 'bg-danger-red/10',
    borderColor: 'border-danger-red',
    textColor: 'text-danger-red',
    label: '高风险',
    glow: '0 0 15px rgba(239, 68, 68, 0.8)',
  },
};

const sizeConfig = {
  sm: { icon: 'w-4 h-4', text: 'text-xs', padding: 'px-2 py-1', gap: 'gap-1' },
  md: { icon: 'w-5 h-5', text: 'text-sm', padding: 'px-3 py-1.5', gap: 'gap-1.5' },
  lg: { icon: 'w-6 h-6', text: 'text-base', padding: 'px-4 py-2', gap: 'gap-2' },
};

const RiskIcon = ({ level, size }: { level: RiskLevel; size: string }) => {
  const iconProps = { className: size };
  switch (level) {
    case 'low':
      return <ShieldCheck {...iconProps} />;
    case 'medium':
      return <AlertTriangle {...iconProps} />;
    case 'high':
      return <ShieldAlert {...iconProps} />;
  }
};

export default function RiskBadge({
  level,
  showLabel = true,
  className,
  size = 'md',
}: RiskBadgeProps) {
  const config = riskConfig[level];
  const sizes = sizeConfig[size];
  const isHighRisk = level === 'high';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: 1,
        scale: 1,
        boxShadow: isHighRisk ? [config.glow, '0 0 30px rgba(239, 68, 68, 0.4)', config.glow] : config.glow,
      }}
      transition={{
        duration: 0.3,
        boxShadow: isHighRisk
          ? {
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }
          : { duration: 0.3 },
      }}
      className={cn(
        'inline-flex items-center border rounded-sm font-rock uppercase tracking-wider',
        config.bgColor,
        config.borderColor,
        config.textColor,
        sizes.padding,
        sizes.gap,
        isHighRisk && 'animate-pulse-neon',
        className
      )}
    >
      <motion.div
        animate={isHighRisk ? {
          scale: [1, 1.1, 1],
        } : {}}
        transition={isHighRisk ? {
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        } : {}}
      >
        <RiskIcon level={level} size={sizes.icon} />
      </motion.div>
      {showLabel && (
        <span className={sizes.text}>{config.label}</span>
      )}
    </motion.div>
  );
}
