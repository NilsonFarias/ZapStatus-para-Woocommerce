import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Smartphone, AlertTriangle } from "lucide-react";

interface Activity {
  id: string;
  type: 'user_added' | 'instance_created' | 'delivery_failed';
  title: string;
  description: string;
  timestamp: string;
}

const activities: Activity[] = [
  {
    id: '1',
    type: 'user_added',
    title: 'Novo cliente cadastrado',
    description: 'Loja ABC se inscreveu no plano Pro',
    timestamp: '2 horas atrás'
  },
  {
    id: '2',
    type: 'instance_created',
    title: 'Nova instância criada',
    description: 'Instância para Loja XYZ foi configurada',
    timestamp: '4 horas atrás'
  },
  {
    id: '3',
    type: 'delivery_failed',
    title: 'Falha na entrega',
    description: '3 mensagens falharam para cliente #123',
    timestamp: '6 horas atrás'
  }
];

const getActivityIcon = (type: Activity['type']) => {
  switch (type) {
    case 'user_added':
      return <UserPlus className="text-success" size={16} />;
    case 'instance_created':
      return <Smartphone className="text-primary" size={16} />;
    case 'delivery_failed':
      return <AlertTriangle className="text-warning" size={16} />;
  }
};

const getActivityBgColor = (type: Activity['type']) => {
  switch (type) {
    case 'user_added':
      return 'bg-success/10';
    case 'instance_created':
      return 'bg-primary/10';
    case 'delivery_failed':
      return 'bg-warning/10';
  }
};

export default function ActivityFeed() {
  return (
    <Card data-testid="activity-feed">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900">Atividade Recente</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start space-x-3" data-testid={`activity-${activity.id}`}>
              <div className={`w-8 h-8 ${getActivityBgColor(activity.type)} rounded-full flex items-center justify-center flex-shrink-0`}>
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900" data-testid="activity-title">{activity.title}</p>
                <p className="text-sm text-slate-500" data-testid="activity-description">{activity.description}</p>
                <p className="text-xs text-slate-400 mt-1" data-testid="activity-timestamp">{activity.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
        <Button 
          variant="ghost" 
          className="w-full mt-4 text-primary hover:text-primary/80"
          data-testid="button-view-all-activities"
        >
          Ver todas as atividades
        </Button>
      </CardContent>
    </Card>
  );
}
