import React from 'react';
import { X, AlertTriangle, Clock, Check, Eye } from 'lucide-react';
import type { ChangeNotification } from '@/types';
import { useUIStore } from '@/stores/uiStore';
import { useRecordsStore } from '@/stores/recordsStore';
import { formatDateTime, cn } from '@/utils/helpers';

export const NotificationPanel: React.FC = () => {
  const { showNotificationPanel, setShowNotificationPanel, currentUser } = useUIStore();
  const { notifications, markNotificationReviewed, getVersionDiffs } = useRecordsStore();
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [diffs, setDiffs] = React.useState<Map<string, Awaited<ReturnType<typeof getVersionDiffs>>>>(new Map());
  const [loadingDiffs, setLoadingDiffs] = React.useState<string | null>(null);

  if (!showNotificationPanel) return null;

  const handleExpand = async (notification: ChangeNotification) => {
    if (expandedId === notification.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(notification.id);

    if (!diffs.has(notification.id)) {
      setLoadingDiffs(notification.id);
      try {
        const versionDiffs = await getVersionDiffs(
          notification.workLogId,
          notification.workLogVersion - 1,
          notification.workLogVersion
        );
        setDiffs((prev) => new Map(prev).set(notification.id, versionDiffs));
      } finally {
        setLoadingDiffs(null);
      }
    }
  };

  const handleMarkReviewed = (id: string) => {
    if (currentUser) {
      markNotificationReviewed(id, currentUser.name);
    }
  };

  const unreadNotifications = notifications.filter((n) => !n.reviewed);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setShowNotificationPanel(false)}
      />
      <div className="relative w-96 h-full bg-industrial-bg-light border-l border-industrial-border shadow-industrial flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between px-4 py-3 border-b border-industrial-border">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-alert-orange" />
            <span className="font-medium text-industrial-text">数据变更通知</span>
            {unreadNotifications.length > 0 && (
              <span className="px-2 py-0.5 bg-danger-red text-white text-xs rounded-full">
                {unreadNotifications.length}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowNotificationPanel(false)}
            className="p-1.5 hover:bg-industrial-bg-lighter rounded transition-colors text-industrial-text-muted hover:text-industrial-text"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Check className="w-12 h-12 text-signal-green mb-3" />
              <p className="text-industrial-text-muted">暂无数据变更通知</p>
            </div>
          ) : (
            <div className="divide-y divide-industrial-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'p-4',
                    !notification.reviewed && 'bg-alert-orange/5'
                  )}
                >
                  <div
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => handleExpand(notification)}
                  >
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full mt-2 flex-shrink-0',
                        notification.reviewed ? 'bg-industrial-text-dim' : 'bg-alert-orange animate-pulse'
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-industrial-text">
                          工况日志数据变更
                        </span>
                        <span className="text-xs text-industrial-text-dim">
                          v{notification.workLogVersion}
                        </span>
                      </div>

                      <p className="text-sm text-industrial-text-muted mb-2">
                        设备 {notification.workLogId.slice(-8)} 补传旧版本日志
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-industrial-text-dim">
                          <Clock className="w-3 h-3" />
                          {formatDateTime(notification.timestamp)}
                        </div>

                        {notification.affectedConclusionIds.length > 0 && (
                          <span className="text-xs text-alert-orange">
                            影响 {notification.affectedConclusionIds.length} 处结论
                          </span>
                        )}
                      </div>

                      {expandedId === notification.id && (
                        <div className="mt-4">
                          {loadingDiffs === notification.id ? (
                            <div className="flex items-center justify-center py-4">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-tech-blue" />
                            </div>
                          ) : (
                            diffs.get(notification.id)?.map((diff, idx) => (
                              <div
                                key={idx}
                                className={cn(
                                  'mb-2 px-3 py-2 rounded font-mono text-xs',
                                  diff.type === 'added' && 'diff-added',
                                  diff.type === 'removed' && 'diff-removed',
                                  diff.type === 'modified' && 'diff-modified'
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-industrial-text-dim">
                                    第{diff.line}行
                                  </span>
                                  {diff.type === 'modified' ? (
                                    <div className="flex-1">
                                      <span className="text-danger-red line-through">
                                        {diff.oldValue}
                                      </span>
                                      <span className="text-signal-green ml-2">
                                        {diff.newValue}
                                      </span>
                                    </div>
                                  ) : (
                                    <span
                                      className={cn(
                                        'flex-1',
                                        diff.type === 'added'
                                          ? 'text-signal-green'
                                          : 'text-danger-red'
                                      )}
                                    >
                                      {diff.type === 'added' ? diff.newValue : diff.oldValue}
                                    </span>
                                  )}
                                </div>
                                {diff.affectsConclusionIds.length > 0 && (
                                  <p className="mt-1 text-xs text-alert-orange">
                                    影响结论: {diff.affectsConclusionIds.map((id) => id.slice(-6)).join(', ')}
                                  </p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {!notification.reviewed && (
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkReviewed(notification.id);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-tech-blue/20 text-tech-blue text-xs font-medium rounded hover:bg-tech-blue/30 transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        标记已查看
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
