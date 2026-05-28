import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  pulse?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string; glow: string }> = {
  success: {
    bg: 'rgba(0, 255, 157, 0.15)',
    text: '#00FF9D',
    border: 'rgba(0, 255, 157, 0.3)',
    glow: 'rgba(0, 255, 157, 0.5)',
  },
  warning: {
    bg: 'rgba(255, 138, 0, 0.15)',
    text: '#FF8A00',
    border: 'rgba(255, 138, 0, 0.3)',
    glow: 'rgba(255, 138, 0, 0.5)',
  },
  danger: {
    bg: 'rgba(255, 59, 59, 0.15)',
    text: '#FF3B3B',
    border: 'rgba(255, 59, 59, 0.3)',
    glow: 'rgba(255, 59, 59, 0.5)',
  },
  info: {
    bg: 'rgba(0, 212, 255, 0.15)',
    text: '#00D4FF',
    border: 'rgba(0, 212, 255, 0.3)',
    glow: 'rgba(0, 212, 255, 0.5)',
  },
  default: {
    bg: 'rgba(157, 78, 221, 0.15)',
    text: '#9D4EDD',
    border: 'rgba(157, 78, 221, 0.3)',
    glow: 'rgba(157, 78, 221, 0.5)',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-3 py-1 text-sm gap-1.5',
};

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  pulse = false,
  className,
}: BadgeProps) {
  const styles = variantStyles[variant];

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: 1,
        scale: 1,
        boxShadow: pulse
          ? [
              `0 0 0 ${styles.glow}`,
              `0 0 15px ${styles.glow}`,
              `0 0 0 ${styles.glow}`,
            ]
          : 'none',
      }}
      transition={{
        duration: 0.3,
        boxShadow: pulse
          ? {
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }
          : undefined,
      }}
      className={cn(
        'relative inline-flex items-center font-medium rounded-full border',
        sizeStyles[size],
        className
      )}
      style={{
        backgroundColor: styles.bg,
        color: styles.text,
        borderColor: styles.border,
      }}
    >
      {pulse && (
        <motion.span
          className="absolute inline-flex h-2 w-2 rounded-full"
          style={{ backgroundColor: styles.text }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [1, 0.5, 1],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </motion.span>
  );
}
