import { AlertTriangle, Clock, FileWarning, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { RiskAlert } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const iconMap = {
  expiry: Clock,
  'multi-use': AlertTriangle,
  'missing-credential': FileWarning,
  other: AlertTriangle,
};

const severityColors = {
  error: 'border-l-[#B85450] bg-[#B85450]/5',
  warning: 'border-l-[#D4883A] bg-[#D4883A]/5',
  info: 'border-l-[#6B8E9F] bg-[#6B8E9F]/5',
};

const severityLabels = {
  error: '严重',
  warning: '注意',
  info: '提示',
};

interface RiskAlertItemProps {
  alert: RiskAlert;
  showAction?: boolean;
}

export const RiskAlertItem = ({ alert, showAction = true }: RiskAlertItemProps) => {
  const navigate = useNavigate();
  const Icon = iconMap[alert.type] || AlertTriangle;

  const handleClick = () => {
    if (alert.relatedEntityType === 'samplePack') {
      navigate(`/sample-packs/${alert.relatedEntityId}`);
    } else if (alert.relatedEntityType === 'track') {
      navigate(`/tracks/${alert.relatedEntityId}`);
    }
  };

  return (
    <Card
      className={cn(
        'border-l-4 transition-all duration-200 hover:shadow-md',
        severityColors[alert.severity]
      )}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
              alert.severity === 'error'
                ? 'bg-[#B85450]/10 text-[#B85450]'
                : alert.severity === 'warning'
                ? 'bg-[#D4883A]/10 text-[#D4883A]'
                : 'bg-[#6B8E9F]/10 text-[#6B8E9F]'
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-[#1A1A2E]">{alert.title}</h4>
              <Badge variant={alert.severity}>{severityLabels[alert.severity]}</Badge>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{alert.message}</p>
          </div>
          {showAction && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClick}
              className="flex-shrink-0"
            >
              查看详情
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
