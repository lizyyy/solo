import { Lock, Unlock } from 'lucide-react';
import { formatDate } from '@/utils/version';
import { mockUsers } from '@/data/mockData';

interface LockIndicatorProps {
  isLocked: boolean;
  lockedBy?: string;
  lockedAt?: string;
}

export function LockIndicator({ isLocked, lockedBy, lockedAt }: LockIndicatorProps) {
  const user = lockedBy ? mockUsers.find((u) => u.id === lockedBy) : null;

  if (!isLocked) {
    return (
      <div className="inline-flex items-center gap-2 text-film-text-secondary">
        <Unlock className="w-4 h-4" />
        <span className="text-sm">可编辑</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 text-film-danger">
      <Lock className="w-4 h-4" />
      <div className="text-sm">
        <span className="font-medium">已锁定</span>
        {user && lockedAt && (
          <span className="text-film-text-muted ml-2">
            由 {user.name} 于 {formatDate(lockedAt)}
          </span>
        )}
      </div>
    </div>
  );
}
