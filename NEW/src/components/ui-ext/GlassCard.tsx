import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const GlassCard = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function GlassCard({ className, ...rest }, ref) {
    return <div ref={ref} className={cn("glass-panel p-5", className)} {...rest} />;
  },
);

export const SubtleCard = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function SubtleCard({ className, ...rest }, ref) {
    return <div ref={ref} className={cn("glass-subtle p-4", className)} {...rest} />;
  },
);
