import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: number;
  trendLabel: string;
  iconBgColor?: string;
  iconColor?: string;
  className?: string;
}

export function StatsCard({
  title,
  value,
  icon,
  trend,
  trendLabel,
  iconBgColor = "bg-blue-100",
  iconColor = "text-primary",
  className,
}: StatsCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-neutral-500">{title}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", iconBgColor)}>
            {icon}
          </div>
        </div>
        <div className="flex items-center text-xs">
          {trend !== undefined ? (
            <span 
              className={cn(
                "flex items-center font-medium",
                trend > 0 ? "text-green-600" : "text-red-600"
              )}
            >
              {trend > 0 ? (
                <ArrowUp className="h-4 w-4 mr-1" />
              ) : (
                <ArrowDown className="h-4 w-4 mr-1" />
              )}
              {Math.abs(trend)}%
            </span>
          ) : null}
          <span className="text-neutral-500 ml-1">{trendLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
}
