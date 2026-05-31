import type { ExportItem } from '@/types';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { User, Scissors, Megaphone, AlertCircle, CheckCircle, Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import { formatTime, formatDateTime } from '@/utils/time';
import { useState } from 'react';

interface ExportCardProps {
  items: ExportItem[];
  variant: 'confirmed' | 'pending' | 'manual';
  title: string;
  handlingNote: string;
}

const typeIcons = {
  guest: User,
  clip: Scissors,
  ad: Megaphone,
};

const typeLabels = {
  guest: '嘉宾',
  clip: '剪辑',
  ad: '广告',
};

export function ExportCard({ items, variant, title, handlingNote }: ExportCardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const variantColors = {
    confirmed: 'border-status-confirmed/50',
    pending: 'border-status-pending/50',
    manual: 'border-status-manual/50',
  };

  const headerColors = {
    confirmed: 'bg-status-confirmed/10 border-b-status-confirmed/30',
    pending: 'bg-status-pending/10 border-b-status-pending/30',
    manual: 'bg-status-manual/10 border-b-status-manual/30',
  };

  const totalDuration = items.reduce((sum, item) => sum + item.record.duration, 0);

  return (
    <div className={`panel border ${variantColors[variant]} flex flex-col h-full`}>
      <div className={`px-4 py-3 border-b ${headerColors[variant]}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-text-primary tracking-wider">{title}</h3>
          <Badge variant={variant}>{items.length} 条</Badge>
        </div>
        <p className="text-xs text-text-muted">{handlingNote}</p>
        <div className="mt-2 pt-2 border-t border-border-primary/30 flex justify-between text-[10px]">
          <span className="text-text-muted">总时长</span>
          <span className="font-mono text-text-primary">
            {Math.floor(totalDuration / 60)}分{Math.floor(totalDuration % 60)}秒
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-text-muted">
            <CheckCircle className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-xs">暂无记录</p>
          </div>
        ) : (
          <div className="divide-y divide-border-primary/50">
            {items.map((item, index) => {
              const record = item.record;
              const Icon = typeIcons[record.type];
              const isExpanded = expandedId === item.record.id;

              return (
                <div
                  key={item.record.id}
                  className="animate-stagger"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div
                    className="p-3 cursor-pointer hover:bg-bg-tertiary/50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : item.record.id)}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5">
                        <Badge variant={variant} className="text-[9px] w-5 h-5 p-0 flex items-center justify-center">
                          {index + 1}
                        </Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Icon className={`w-3.5 h-3.5 text-track-${record.type}`} />
                          <span className="text-xs font-medium text-text-primary truncate">{record.title}</span>
                          <span className="code-text text-[10px] text-text-muted ml-auto">
                            {typeLabels[record.type]}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-text-muted">
                          <span className="font-mono">{formatTime(record.startTime)}</span>
                          <span>时长</span>
                          <span className="font-mono">{formatTime(record.duration)}</span>
                          {item.anomalies.length > 0 && (
                            <span className="flex items-center gap-1 text-status-anomaly">
                              <AlertCircle className="w-3 h-3" />
                              {item.anomalies.length}
                            </span>
                          )}
                          {item.corrections.length > 0 && (
                            <span className="flex items-center gap-1 text-status-manual">
                              <Edit2 className="w-3 h-3" />
                              {item.corrections.length}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 mt-1">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-text-muted" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-text-muted" />
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 ml-8 border-t border-border-primary/30">
                      <div className="mt-2 space-y-1.5 text-[10px]">
                        {record.description && (
                          <div>
                            <span className="text-text-muted">描述：</span>
                            <span className="text-text-secondary">{record.description}</span>
                          </div>
                        )}
                        {record.meta?.speakerName && (
                          <div>
                            <span className="text-text-muted">嘉宾：</span>
                            <span className="text-text-secondary">{record.meta.speakerName}</span>
                          </div>
                        )}
                        {record.meta?.adClient && (
                          <div>
                            <span className="text-text-muted">广告客户：</span>
                            <span className="text-text-secondary">{record.meta.adClient}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-text-muted">处理口径：</span>
                          <span className="text-text-secondary">{item.handlingNote}</span>
                        </div>
                        <div>
                          <span className="text-text-muted">创建时间：</span>
                          <span className="code-text text-text-secondary">{formatDateTime(record.createdAt)}</span>
                        </div>

                        {item.anomalies.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border-primary/30">
                            <p className="text-text-muted mb-1">异常记录：</p>
                            {item.anomalies.map(a => (
                              <div key={a.id} className="flex items-start gap-1 mb-1">
                                <span className={a.resolved ? 'text-status-confirmed' : 'text-status-anomaly'}>
                                  {a.resolved ? '✓' : '⚠'}
                                </span>
                                <span className="text-text-secondary">{a.description}</span>
                                {a.explanation && (
                                  <span className="text-text-muted block ml-3">解释：{a.explanation}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {item.corrections.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border-primary/30">
                            <p className="text-text-muted mb-1">更正记录：</p>
                            {item.corrections.map(c => (
                              <div key={c.id} className="mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-text-muted">{c.fieldName}</span>
                                  <span className="code-text text-status-anomaly line-through">{c.oldValue}</span>
                                  <span className="text-text-muted">→</span>
                                  <span className="code-text text-status-confirmed">{c.newValue}</span>
                                </div>
                                <span className="text-text-muted ml-3">原因：{c.reason}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
