import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  padding?: string;
  rounded?: string;
  delay?: number;
}

export default function GlassPanel({
  children,
  className,
  padding = 'p-6',
  rounded = 'rounded-2xl',
  delay = 0,
}: GlassPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={cn(
        'relative overflow-hidden',
        'backdrop-blur-xl',
        'border border-white/10',
        padding,
        rounded,
        className
      )}
      style={{
        backgroundColor: 'rgba(10, 22, 40, 0.75)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(0, 255, 157, 0.05) 0%, transparent 50%, rgba(0, 212, 255, 0.05) 100%)',
        }}
      />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
