import React, { useMemo } from 'react';
import { X, ExternalLink, FileText, TrendingUp, Users, AlertTriangle, Clock, CheckCircle, XCircle, History, Database } from 'lucide-react';
import { useAppStore } from '@/store';
import { triggerWindowService } from '@/services/TriggerWindowService';
import { announcementVersionService, ANNOUNCEMENT_TYPE_TEXT, ANNOUNCEMENT_TYPE_COLOR } from '@/services/AnnouncementVersionService';
import { customerTierService, TIER_TEXT, TIER_COLOR, CUSTOMER_TYPE_TEXT, RISK_LEVEL_TEXT, RISK_LEVEL_COLOR } from '@/services/CustomerTierService';
import { formatNumber, formatMoney, formatDate, formatDateTime, getStatusBadgeClass, truncateText } from '@/utils/format';
import clsx from 'clsx';

const BondDetailSidebar: React.FC = () => {
  const {
    selectedBondCode,
    setSelectedBond,
    bonds,
    positions,
    announcements,
    triggerResults,
    reminderLogs,
    dataTraces,
    createDisposalTask,
  } = useAppStore();

  const bond = useMemo(() => 
    bonds.find(b => b.bondCode === selectedBondCode),
    [bonds, selectedBondCode]
  );

  const bondPositions = useMemo(() => 
    positions.filter(p => p.bondCode === selectedBondCode),
    [positions, selectedBondCode]
  );

  const bondAnnouncements = useMemo(() => 
    announcements[selectedBondCode || ''] || [],
    [announcements, selectedBondCode]
  );

  const triggerResult = useMemo(() => 
    triggerResults[selectedBondCode || ''],
    [triggerResults, selectedBondCode]
  );

  const announcementStatus = useMemo(() => 
    announcementVersionService.getAnnouncementStatus(bondAnnouncements),
    [bondAnnouncements]
  );

  const triggerStatus = useMemo(() => 
    triggerResult ? triggerWindowService.getTriggerStatus(triggerResult) : null,
    [triggerResult]
  );

  const sortedPositions = useMemo(() => 
    customerTierService.sortByPriority(bondPositions),
    [bondPositions]
  );

  const tierStats = useMemo(() => 
    customerTierService.calculateTierStatistics(bondPositions),
    [bondPositions]
  );

  const bondReminderLogs = useMemo(() => 
    reminderLogs.filter(l => l.bondCode === selectedBondCode).slice(-10),
    [reminderLogs, selectedBondCode]
  );

  const bondDataTraces = useMemo(() => 
    dataTraces.filter(t => 
      t.dataType === 'BOND_INFO' || 
      (t.dataType === 'MARKET_DATA' && bond?.stockCode && t.sourceUrl.includes(bond.stockCode)) ||
      (t.dataType === 'ANNOUNCEMENT' && t.sourceUrl.includes(selectedBondCode || '')) ||
      t.dataType === 'POSITION'
    ),
    [dataTraces, selectedBondCode, bond]
  );

  const handleCreateTask = () => {
    if (selectedBondCode) {
      createDisposalTask(selectedBondCode);
    }
  };

  if (!selectedBondCode || !bond) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-50 animate-fade-in"
        onClick={() => setSelectedBond(null)}
      />
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 animate-slide-in-right overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-xl font-serif font-bold text-slate-800">
              {bond.bondName}
              <span className="ml-2 text-sm font-normal text-slate-500">{bond.bondCode}</span>
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {bond.stockName} ({bond.stockCode}) · {bond.industry} · {bond.rating}
            </p>
          </div>
          <button
            onClick={() => setSelectedBond(null)}
            className="p-2 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-4 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">转股价</div>
                <div className="text-lg font-semibold text-slate-800">{formatMoney(bond.conversionPrice)}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">强赎触发价</div>
                <div className="text-lg font-semibold text-danger-600">{formatMoney(bond.redemptionPrice)}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">当前转债价</div>
                <div className="text-lg font-semibold text-slate-800">{formatMoney(bond.currentPrice)}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">当前正股价</div>
                <div className={clsx(
                  'text-lg font-semibold',
                  bond.stockPrice >= bond.redemptionPrice ? 'text-danger-600' : 'text-slate-800'
                )}>
                  {formatMoney(bond.stockPrice)}
                  {bond.stockPrice >= bond.redemptionPrice && (
                    <span className="text-xs ml-1">已触发</span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary-600" />
                触发窗口计算
              </h3>
              
              {triggerStatus && (
                <div className={clsx(
                  'p-4 rounded-lg border',
                  triggerStatus.status === 'TRIGGERED' ? 'bg-danger-50 border-danger-200' :
                  triggerStatus.status === 'WARNING' ? 'bg-warning-50 border-warning-200' :
                  triggerStatus.status === 'GAP' ? 'bg-slate-50 border-slate-200' :
                  'bg-success-50 border-success-200'
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-slate-700">
                      {triggerResult?.windowType === '30_15' ? '30交易日/15天' : '20交易日/10天'}
                    </span>
                    <span className={getStatusBadgeClass(triggerStatus.status)}>
                      {triggerStatus.status === 'TRIGGERED' ? '已触发' :
                       triggerStatus.status === 'WARNING' ? '即将触发' :
                       triggerStatus.status === 'GAP' ? '数据断档' : '监控中'}
                    </span>
                  </div>
                  <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={clsx(
                        'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                        triggerStatus.status === 'TRIGGERED' ? 'bg-danger-500' :
                        triggerStatus.status === 'WARNING' ? 'bg-warning-500' :
                        triggerStatus.status === 'GAP' ? 'bg-slate-400' :
                        'bg-success-500'
                      )}
                      style={{ width: `${Math.min(triggerStatus.progress, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-sm">
                    <span className="text-slate-600">
                      已满足 <span className="font-semibold">{triggerResult?.meetDays}</span> / {triggerResult?.totalDays} 天
                    </span>
                    <span className="text-slate-500">
                      连续 <span className="font-semibold">{triggerResult?.consecutiveDays}</span> 天
                    </span>
                  </div>
                  {triggerResult?.hasGap && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-danger-600">
                      <AlertTriangle className="w-3 h-3" />
                      <span>数据存在 {triggerResult.gapDates.length} 处断档，请补全</span>
                    </div>
                  )}
                  {triggerResult?.triggeredAt && (
                    <div className="mt-2 text-xs text-slate-500">
                      首次触发时间：{formatDate(triggerResult.triggeredAt)}
                    </div>
                  )}
                  <p className="mt-2 text-sm text-slate-600">{triggerStatus.message}</p>
                </div>
              )}

              {triggerResult && (
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  <span>统计区间: {formatDate(triggerResult.windowStartDate)} ~ {formatDate(triggerResult.windowEndDate)}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary-600" />
                  强赎公告
                </h3>
                <span className={getStatusBadgeClass(announcementStatus.status)}>
                  {announcementStatus.statusText}
                </span>
              </div>

              <div className="space-y-3">
                {bondAnnouncements.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-lg text-center text-slate-500 text-sm">
                    暂无公告
                  </div>
                ) : (
                  announcementStatus.versionHistory.map((ann, index) => (
                    <div
                      key={ann.id}
                      className={clsx(
                        'p-4 rounded-lg border transition-all',
                        ann.isWithdrawn ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 hover:border-primary-300'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={clsx('badge', ANNOUNCEMENT_TYPE_COLOR[ann.announcementType])}>
                              {ANNOUNCEMENT_TYPE_TEXT[ann.announcementType]}
                            </span>
                            <span className="text-xs text-slate-400">V{ann.version}</span>
                          </div>
                          <p className="font-medium text-slate-700 text-sm">
                            {truncateText(ann.title, 50)}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <span>{formatDate(ann.announcementDate)}</span>
                            <span>强赎日: {formatDate(ann.redemptionDate)}</span>
                          </div>
                        </div>
                        <a
                          href={ann.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-md hover:bg-slate-100 transition-colors flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-4 h-4 text-slate-400" />
                        </a>
                      </div>
                      {ann.previousVersionId && index < announcementStatus.versionHistory.length - 1 && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                            <History className="w-3 h-3" />
                            与上一版本差异
                          </div>
                          {announcementVersionService.compareVersions(
                            announcementStatus.versionHistory[index + 1],
                            ann
                          ).map((diff, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs mb-1">
                              <span className="text-slate-500">{diff.field}:</span>
                              <span className={clsx(
                                'line-through',
                                diff.diffType === 'REMOVE' ? 'text-danger-600' : 'text-slate-400'
                              )}>
                                {truncateText(diff.oldValue, 15)}
                              </span>
                              <span className="text-slate-300">→</span>
                              <span className={clsx(
                                diff.diffType === 'ADD' ? 'text-success-600' : 'text-primary-600'
                              )}>
                                {truncateText(diff.newValue, 15)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary-600" />
                  客户持仓
                </h3>
                <span className="text-sm text-slate-500">
                  共 {bondPositions.length} 位客户 · {formatNumber(bondPositions.reduce((s, p) => s + p.positionAmount, 0))} 元
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {tierStats.map(stat => (
                  <div key={stat.tier} className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={clsx('w-2 h-2 rounded-full', 
                        stat.tier === 'PLATINUM' ? 'bg-slate-400' :
                        stat.tier === 'GOLD' ? 'bg-yellow-500' :
                        stat.tier === 'SILVER' ? 'bg-slate-300' : 'bg-amber-700'
                      )} />
                      <span className="text-xs text-slate-600">{stat.tierText}</span>
                      <span className="text-xs text-slate-400 ml-auto">{stat.count}人</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-800">
                      {formatNumber(stat.totalPosition)}
                    </div>
                    <div className="mt-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500"
                        style={{ width: `${stat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="max-h-60 overflow-y-auto scrollbar-thin border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium text-slate-600 text-xs">客户名称</th>
                      <th className="text-center py-2 px-3 font-medium text-slate-600 text-xs">类型</th>
                      <th className="text-center py-2 px-3 font-medium text-slate-600 text-xs">分层</th>
                      <th className="text-right py-2 px-3 font-medium text-slate-600 text-xs">持仓金额</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedPositions.map(pos => (
                      <tr key={pos.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3">
                          <div className="font-medium text-slate-700 truncate max-w-[120px]">
                            {pos.customerName}
                          </div>
                          <div className="text-xs text-slate-400">{pos.accountManager}</div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-xs text-slate-500">
                            {CUSTOMER_TYPE_TEXT[pos.customerType]}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={clsx('badge text-[10px]', TIER_COLOR[pos.tier])}>
                            {TIER_TEXT[pos.tier]}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-slate-700">
                          {formatNumber(pos.positionAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {bondReminderLogs.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <History className="w-4 h-4 text-primary-600" />
                  近期提醒记录
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin">
                  {bondReminderLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className={clsx(
                        'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                        log.status === 'SENT' ? 'bg-success-100' : 'bg-danger-100'
                      )}>
                        {log.status === 'SENT' ? (
                          <CheckCircle className="w-3.5 h-3.5 text-success-600" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-danger-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-700">{log.customerName}</span>
                          <span className="text-xs text-slate-400">{log.reminderType}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{log.reminderContent}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                          <span>{log.operatorName}</span>
                          <span>·</span>
                          <span>{formatDateTime(log.remindedAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Database className="w-4 h-4 text-primary-600" />
                数据来源
              </h3>
              <div className="space-y-2">
                {bondDataTraces.map(trace => (
                  <div key={trace.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-slate-700">{trace.dataType}</div>
                      <div className="text-xs text-slate-500">{trace.sourceSystem}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">{formatDateTime(trace.fetchedAt)}</div>
                      <div className="text-xs text-slate-300 font-mono">{trace.dataHash.slice(0, 8)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button className="btn-secondary flex-1">
              <FileText className="w-4 h-4 mr-2" />
              导出详情
            </button>
            <button
              onClick={handleCreateTask}
              className="btn-primary flex-1"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              创建处置任务
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default BondDetailSidebar;
