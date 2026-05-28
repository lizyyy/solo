import { cn } from '@/lib/utils';

interface EmptyProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

export default function Empty({ icon, title, description, className }: EmptyProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-8 px-4', className)}>
      {icon && (
        <div className="mb-4 text-white/30">
          {icon}
        </div>
      )}
      {title && (
        <h3 className="text-lg font-medium text-white/70 mb-2">
          {title}
        </h3>
      )}
      {description && (
        <p className="text-sm text-white/40 text-center max-w-xs">
          {description}
        </p>
      )}
    </div>
  );
}
