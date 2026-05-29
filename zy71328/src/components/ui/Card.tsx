import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, selected = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-bg-secondary border border-border-default rounded-xl p-4",
          "transition-all duration-200",
          "hover:border-accent-cyan/50",
          selected && "border-accent-purple shadow-neon-purple",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export default Card;
