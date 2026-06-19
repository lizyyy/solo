import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="inline-flex h-8 w-8 items-center justify-center rounded-atlas border border-line bg-surface text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
      title={isDark ? "切换到浅色" : "切换到深色"}
      aria-label="切换主题"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
