import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4", className)}>
      <div className="text-gray-300 mb-4">
        {icon ?? <AlertCircle className="w-12 h-12" />}
      </div>
      <h3 className="text-base font-medium text-gray-600 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-400 mb-4 text-center max-w-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
