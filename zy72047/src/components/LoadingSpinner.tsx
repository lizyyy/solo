import { motion } from 'framer-motion';
import { Disc3, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type SpinnerVariant = 'vinyl' | 'circle' | 'dots' | 'pulse';

interface LoadingSpinnerProps {
  variant?: SpinnerVariant;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'gold' | 'white' | 'custom';
  customColor?: string;
  label?: string;
  className?: string;
}

const sizeConfig = {
  sm: { container: 'gap-2', icon: 'w-5 h-5', text: 'text-sm' },
  md: { container: 'gap-3', icon: 'w-8 h-8', text: 'text-base' },
  lg: { container: 'gap-4', icon: 'w-12 h-12', text: 'text-lg' },
  xl: { container: 'gap-6', icon: 'w-16 h-16', text: 'text-xl' },
};

const colorConfig = {
  gold: 'text-gold-400',
  white: 'text-vinyl-100',
  custom: '',
};

export default function LoadingSpinner({
  variant = 'vinyl',
  size = 'md',
  color = 'gold',
  customColor,
  label,
  className,
}: LoadingSpinnerProps) {
  const sizes = sizeConfig[size];
  const colorClass = color === 'custom' ? '' : colorConfig[color];
  const style = color === 'custom' && customColor ? { color: customColor } : undefined;

  const renderSpinner = () => {
    switch (variant) {
      case 'vinyl':
        return (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="relative"
          >
            <Disc3 className={cn(sizes.icon, colorClass)} style={style} />
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-transparent"
              animate={{
                borderTopColor: color === 'gold' ? '#D4AF37' : color === 'custom' ? customColor : '#f0e6dd',
                borderRightColor: color === 'gold' ? 'rgba(212, 175, 55, 0.5)' : color === 'custom' ? customColor : 'rgba(240, 230, 221, 0.5)',
              }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>
        );

      case 'circle':
        return (
          <Loader2
            className={cn(sizes.icon, colorClass, 'animate-spin')}
            style={style}
          />
        );

      case 'dots':
        return (
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className={cn(
                  'rounded-full',
                  colorClass,
                  size === 'sm' && 'w-1.5 h-1.5',
                  size === 'md' && 'w-2 h-2',
                  size === 'lg' && 'w-3 h-3',
                  size === 'xl' && 'w-4 h-4'
                )}
                style={style}
                animate={{
                  y: [0, -8, 0],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        );

      case 'pulse':
        return (
          <div className="relative">
            <motion.div
              className={cn('rounded-full', colorClass)}
              style={{
                ...style,
                backgroundColor: 'currentColor',
                width: size === 'sm' ? 20 : size === 'md' ? 32 : size === 'lg' ? 48 : 64,
                height: size === 'sm' ? 20 : size === 'md' ? 32 : size === 'lg' ? 48 : 64,
              }}
              animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border-2"
              style={{
                ...style,
                borderColor: 'currentColor',
              }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        );
    }
  };

  return (
    <div className={cn('flex flex-col items-center justify-center', sizes.container, className)}>
      {renderSpinner()}
      {label && (
        <motion.span
          className={cn('font-medium', sizes.text, colorClass)}
          style={style}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {label}
        </motion.span>
      )}
    </div>
  );
}

export function PageLoader({ label = '加载中...' }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-vinyl-950/90 backdrop-blur-sm">
      <div className="text-center">
        <LoadingSpinner variant="vinyl" size="xl" label={label} />
      </div>
    </div>
  );
}

export function InlineLoader({ label, size = 'sm' }: { label?: string; size?: 'sm' | 'md' }) {
  return (
    <div className="flex items-center gap-2 py-4 justify-center">
      <LoadingSpinner variant="dots" size={size} />
      {label && <span className="text-vinyl-400 text-sm">{label}</span>}
    </div>
  );
}
