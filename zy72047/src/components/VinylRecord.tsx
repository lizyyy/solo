import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface VinylRecordProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  spinning?: boolean;
  speed?: 'slow' | 'normal' | 'fast';
  className?: string;
  labelColor?: string;
}

const sizeConfig = {
  sm: 'w-12 h-12',
  md: 'w-20 h-20',
  lg: 'w-32 h-32',
  xl: 'w-48 h-48',
};

const speedConfig = {
  slow: 12,
  normal: 6,
  fast: 3,
};

export default function VinylRecord({
  size = 'md',
  spinning = true,
  speed = 'normal',
  className,
  labelColor = '#D4AF37',
}: VinylRecordProps) {
  return (
    <motion.div
      animate={spinning ? { rotate: 360 } : {}}
      transition={{
        duration: speedConfig[speed],
        repeat: Infinity,
        ease: 'linear',
      }}
      className={cn(
        'relative rounded-full',
        sizeConfig[size],
        className
      )}
      style={{
        background: `
          radial-gradient(circle, ${labelColor} 0%, ${labelColor} 12%, transparent 12.5%),
          radial-gradient(circle, transparent 22%, #1a0e09 22.5%, #1a0e09 25%, #2C1810 25.5%, #2C1810 28%, #1a0e09 28.5%, #1a0e09 31%, #2C1810 31.5%, #2C1810 34%, #1a0e09 34.5%, #1a0e09 37%, #2C1810 37.5%, #2C1810 40%, #1a0e09 40.5%, #1a0e09 43%, #2C1810 43.5%, #2C1810 46%, #1a0e09 46.5%, #1a0e09 100%)
        `,
        boxShadow: `
          0 4px 20px rgba(44, 24, 16, 0.5),
          inset 0 0 60px rgba(0, 0, 0, 0.8)
        `,
      }}
    >
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-vinyl-950 border-2 border-gold-500/50"
        style={{
          width: '8%',
          height: '8%',
        }}
      />

      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold-500/20"
        style={{
          width: '44%',
          height: '44%',
        }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/5 to-transparent" />
      </div>

      <div
        className="absolute rounded-full opacity-30"
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)',
        }}
      />

      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full overflow-hidden"
        style={{
          width: '24%',
          height: '24%',
          backgroundColor: labelColor,
        }}
      >
        <div
          className="absolute inset-0 opacity-50"
          style={{
            background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 70%)`,
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-vinyl-950"
          style={{
            width: '33%',
            height: '33%',
          }}
        />
      </div>
    </motion.div>
  );
}

export function FloatingVinyl({
  className,
  ...props
}: VinylRecordProps & { className?: string }) {
  return (
    <motion.div
      animate={{
        y: [0, -10, 0],
        rotate: [0, 2, -2, 0],
      }}
      transition={{
        duration: 6,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={className}
    >
      <VinylRecord {...props} />
    </motion.div>
  );
}
