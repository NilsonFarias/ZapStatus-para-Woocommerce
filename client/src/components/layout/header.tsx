import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";

interface HeaderProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
  };
  showDateFilter?: boolean;
}

export default function Header({ title, description, action, showDateFilter }: HeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4" data-testid="page-header">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900" data-testid="page-title">{title}</h2>
          <p className="text-slate-600" data-testid="page-description">{description}</p>
        </div>
        <div className="flex items-center space-x-4">
          {showDateFilter && (
            <Select defaultValue="30days">
              <SelectTrigger className="w-40" data-testid="select-date-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7days">Últimos 7 dias</SelectItem>
                <SelectItem value="30days">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
          )}
          {action && (
            <Button 
              onClick={action.onClick}
              disabled={action.disabled}
              data-testid="button-header-action"
            >
              {action.icon}
              {action.label}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
