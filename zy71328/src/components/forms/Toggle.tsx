import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export default function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  className,
}: ToggleProps) {
  const handleToggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          "relative w-12 h-6 rounded-full transition-all duration-300",
          "focus:outline-none focus:ring-2 focus:ring-accent-cyan focus:ring-offset-2 focus:ring-offset-bg-primary",
          checked
            ? "bg-accent-cyan/20 shadow-neon"
            : "bg-bg-tertiary border border-border-default",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-all duration-300",
            checked
              ? "translate-x-6 bg-accent-cyan shadow-[0_0_10px_rgba(0,240,255,0.8)]"
              : "bg-text-muted"
          )}
        />
      </button>
      {label && (
        <span className="text-sm text-text-secondary select-none">
          {label}
        </span>
      )}
    </div>
  );
}
