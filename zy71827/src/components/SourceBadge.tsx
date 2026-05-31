import { useNavigate } from 'react-router-dom';
import { Settings, Trophy, UserPlus } from 'lucide-react';
import { cn, getSourceTypeText } from '@/utils/helpers';
import type { SourceType } from '@/types';
import { useAppStore } from '@/store/useAppStore';

interface SourceBadgeProps {
  sourceType: SourceType;
  sourceId: string;
  className?: string;
}

const sourceConfig: Record<SourceType, { icon: React.ElementType; path: string; color: string }> = {
  drop_config: {
    icon: Settings,
    path: '/drop-config',
    color: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100',
  },
  leaderboard: {
    icon: Trophy,
    path: '/leaderboard',
    color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100',
  },
  manual: {
    icon: UserPlus,
    path: '/rewards',
    color: 'text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100',
  },
};

export default function SourceBadge({ sourceType, sourceId, className }: SourceBadgeProps) {
  const navigate = useNavigate();
  const { dropConfigs, leaderboards } = useAppStore();
  const config = sourceConfig[sourceType];
  const Icon = config.icon;

  const getSourceSummary = (): string => {
    if (sourceType === 'drop_config') {
      const config = dropConfigs.find((d) => d.id === sourceId);
      return config ? `${config.sourceFile} (v${config.version})` : '未知配置';
    }
    if (sourceType === 'leaderboard') {
      const board = leaderboards.find((l) => l.id === sourceId);
      return board ? board.name : '未知排行榜';
    }
    return '手动添加';
  };

  const handleClick = () => {
    navigate(config.path);
  };

  return (
    <button
      onClick={handleClick}
      title={getSourceSummary()}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer',
        config.color,
        className
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{getSourceTypeText(sourceType)}</span>
    </button>
  );
}
