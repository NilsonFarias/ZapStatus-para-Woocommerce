import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface MetricsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend: {
    value: string;
    isPositive: boolean;
    label: string;
  };
  iconBgColor: string;
}

export default function MetricsCard({ title, value, icon: Icon, trend, iconBgColor }: MetricsCardProps) {
  return (
    <Card data-testid={`metrics-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600" data-testid="metric-title">{title}</p>
            <p className="text-3xl font-bold text-slate-900" data-testid="metric-value">{value}</p>
          </div>
          <div className={`w-12 h-12 ${iconBgColor} rounded-lg flex items-center justify-center`}>
            <Icon className="text-xl" size={24} />
          </div>
        </div>
        <div className="mt-4 flex items-center">
          <span 
            className={`text-sm font-medium ${trend.isPositive ? 'text-success' : 'text-error'}`}
            data-testid="metric-trend-value"
          >
            {trend.value}
          </span>
          <span className="text-slate-500 text-sm ml-2" data-testid="metric-trend-label">
            {trend.label}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
