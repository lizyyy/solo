import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export default function Switch({
  checked = false,
  onChange,
  disabled = false,
  label,
  className,
}: SwitchProps) {
  const handleToggle = () => {
    if (disabled) return;
    onChange?.(!checked);
  };

  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      {label && (
        <span className={cn(
          'text-sm font-medium select-none',
          disabled ? 'text-white/40' : 'text-white/80'
        )}>
          {label}
        </span>
      )}
      <motion.button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={handleToggle}
        whileHover={!disabled ? { scale: 1.05 } : undefined}
        whileTap={!disabled ? { scale: 0.95 } : undefined}
        className={cn(
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent',
          'transition-colors duration-300 ease-in-out focus:outline-none',
          disabled ? 'cursor-not-allowed opacity-50' : ''
        )}
        style={{
          backgroundColor: checked ? 'rgba(0, 255, 157, 0.3)' : 'rgba(255, 255, 255, 0.1)',
          boxShadow: checked ? '0 0 20px rgba(0, 255, 157, 0.5), inset 0 0 10px rgba(0, 255, 157, 0.2)' : 'none',
        }}
      >
        <span
          className="absolute inset-0 rounded-full transition-opacity duration-300"
          style={{
            opacity: checked ? 1 : 0,
            background: 'radial-gradient(circle at center, rgba(0, 255, 157, 0.4) 0%, transparent 70%)',
          }}
        />

        <motion.span
          className="pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-lg ring-0"
          animate={{
            x: checked ? 20 : 0,
            backgroundColor: checked ? '#00FF9D' : '#666666',
            boxShadow: checked
              ? '0 0 15px rgba(0, 255, 157, 0.8), 0 0 30px rgba(0, 255, 157, 0.4)'
              : '0 0 5px rgba(0, 0, 0, 0.3)',
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
          }}
          style={{
            border: '2px solid #0A1628',
          }}
        />

        {checked && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-full"
            style={{
              border: '2px solid rgba(0, 255, 157, 0.6)',
            }}
          />
        )}
      </motion.button>
    </div>
  );
}
