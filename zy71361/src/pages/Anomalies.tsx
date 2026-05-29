import { useState } from 'react';
import { Copy, ShieldAlert, Clock, HelpCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { usePropStore } from '@/store';
import { anomalyTypeLabel, statusLabel } from '@/utils/report';
import type { AnomalyItem } from '@/types';

const TABS = [
  { key: 'duplicate_borrow' as const, label: '重复借出', icon: Copy, color: '#e74c3c' },
  { key: 'unconfirmed_damage' as const, label: '损伤未确认', icon: ShieldAlert, color: '#f39c12' },
  { key: 'late_return' as const, label: '返库超时', icon: Clock, color: '#e74c3c' },
  { key: 'pending_review' as const, label: '待复核', icon: HelpCircle, color: '#f39c12' },
];

type TabKey = (typeof TABS)[number]['key'];

export default function Anomalies() {
  const [activeTab, setActiveTab] = useState<TabKey>('duplicate_borrow');
  const store = usePropStore();

  const anomalies = store.anomalies;
  const borrowRecords = store.borrowRecords;
  const damageRecords = store.damageRecords;
  const props = store.props;

  const filtered = anomalies.filter((a) => !a.resolved && a.type === activeTab);
  const pendingReviewRecords = borrowRecords.filter((r) => r.status === 'pending_review');

  const getPropName = (propId: string) =>
    props.find((p) => p.id === propId)?.name || propId;

  const getBorrowRecord = (id: string) =>
    borrowRecords.find((r) => r.id === id);

  const tabConfig = TABS.find((t) => t.key === activeTab)!;

  const handleIntercept = (anomaly: AnomalyItem) => {
    store.resolveAnomaly(anomaly.id);
  };

  const handleMarkReview = (anomaly: AnomalyItem) => {
    store.resolvePendingReview(anomaly.borrowRecordId, 'pending_review');
    store.resolveAnomaly(anomaly.id);
  };

  const handleConfirmDamage = (anomaly: AnomalyItem) => {
    const dmg = damageRecords.find(
      (d) => d.borrowRecordId === anomaly.borrowRecordId && !d.confirmed
    );
    if (dmg) {
      store.confirmDamage(dmg.id, '管理员');
    }
  };

  const handleApprove = (anomaly: AnomalyItem) => {
    store.resolvePendingReview(anomaly.borrowRecordId, 'returned');
  };

  const handleMarkAnomaly = (anomaly: AnomalyItem) => {
    store.resolveAnomaly(anomaly.id);
  };

  const handleReviewApprove = (recordId: string) => {
    const record = borrowRecords.find((r) => r.id === recordId);
    if (!record) return;
    const newStatus = record.actualReturnTime ? 'returned' : 'borrowed';
    store.resolvePendingReview(recordId, newStatus);
  };

  const handleReturnForCorrection = (recordId: string) => {
    store.resolvePendingReview(recordId, 'borrowed');
  };

  const renderActionButtons = (anomaly: AnomalyItem) => {
    const btnBase =
      'px-3 py-1.5 rounded text-xs font-medium transition-colors';

    switch (anomaly.type) {
      case 'duplicate_borrow':
        return (
          <>
            <button
              className={`${btnBase} bg-red-600/20 text-red-400 hover:bg-red-600/30`}
              onClick={() => handleIntercept(anomaly)}
            >
              拦截
            </button>
            <button
              className={`${btnBase} bg-amber-600/20 text-amber-400 hover:bg-amber-600/30`}
              onClick={() => handleMarkReview(anomaly)}
            >
              标记复核
            </button>
          </>
        );
      case 'unconfirmed_damage':
        return (
          <button
            className={`${btnBase} bg-orange-600/20 text-orange-400 hover:bg-orange-600/30`}
            onClick={() => handleConfirmDamage(anomaly)}
          >
            确认损伤
          </button>
        );
      case 'late_return':
        return (
          <button
            className={`${btnBase} bg-amber-600/20 text-amber-400 hover:bg-amber-600/30`}
            onClick={() => handleMarkReview(anomaly)}
          >
            标记复核
          </button>
        );
      case 'pending_review':
        return (
          <>
            <button
              className={`${btnBase} bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30`}
              onClick={() => handleApprove(anomaly)}
            >
              通过
            </button>
            <button
              className={`${btnBase} bg-red-600/20 text-red-400 hover:bg-red-600/30`}
              onClick={() => handleMarkAnomaly(anomaly)}
            >
              标记异常
            </button>
          </>
        );
      default:
        return null;
    }
  };

  const countBadge = (key: TabKey) => {
    const c = anomalies.filter((a) => !a.resolved && a.type === key).length;
    return c > 0 ? c : 0;
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] p-6 text-gray-200">
      <h1 className="mb-6 text-2xl font-bold text-[#d4a843]">异常检测中心</h1>

      <div className="mb-6 flex gap-2 border-b border-gray-700/50 pb-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = countBadge(tab.key);
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-[#d4a843] text-[#d4a843]'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon size={16} style={{ color: isActive ? tab.color : undefined }} />
              <span>{tab.label}</span>
              {count > 0 && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-xs"
                  style={{
                    backgroundColor: `${tab.color}22`,
                    color: tab.color,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mb-8 space-y-3">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-[#1e1e32] py-12 text-emerald-400">
            <CheckCircle size={24} />
            <span className="text-lg">无异常</span>
          </div>
        ) : (
          filtered.map((anomaly) => {
            const record = getBorrowRecord(anomaly.borrowRecordId);
            return (
              <div
                key={anomaly.id}
                className="rounded-lg bg-[#1e1e32] p-4"
                style={{ borderLeft: `4px solid ${tabConfig.color}` }}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-3">
                      <span className="font-semibold text-white">
                        {getPropName(anomaly.propId)}
                      </span>
                      <span
                        className="rounded px-1.5 py-0.5 text-xs"
                        style={{
                          backgroundColor: `${tabConfig.color}22`,
                          color: tabConfig.color,
                        }}
                      >
                        {anomalyTypeLabel(anomaly.type)}
                      </span>
                      {record && (
                        <>
                          <span className="text-xs text-gray-400">
                            {record.sceneNumber}
                          </span>
                          <span className="text-xs text-gray-400">
                            {record.borrower}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-gray-300">{anomaly.message}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(anomaly.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {renderActionButtons(anomaly)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {pendingReviewRecords.length > 0 && (
        <div className="rounded-lg border border-amber-700/30 bg-[#1e1e32] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-amber-400">
            <HelpCircle size={20} />
            待复核借出记录
            <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-xs">
              {pendingReviewRecords.length}
            </span>
          </h2>
          <div className="space-y-3">
            {pendingReviewRecords.map((record) => {
              const propName = getPropName(record.propId);
              return (
                <div
                  key={record.id}
                  className="rounded-md border border-amber-700/20 bg-[#15152a] p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-white">{propName}</span>
                      <span className="text-xs text-gray-400">{record.sceneNumber}</span>
                      <span className="text-xs text-gray-400">{record.borrower}</span>
                      <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-xs text-amber-400">
                        {statusLabel(record.status)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-600/30"
                        onClick={() => handleReviewApprove(record.id)}
                      >
                        复核通过
                      </button>
                      <button
                        className="rounded bg-gray-600/20 px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-600/30"
                        onClick={() => handleReturnForCorrection(record.id)}
                      >
                        退回修正
                      </button>
                    </div>
                  </div>

                  {record.isSupplemented && (
                    <div className="mt-2 space-y-1 rounded bg-[#0f0f1a] p-3 text-xs">
                      <div className="flex items-center gap-2 text-gray-400">
                        <span>借出时间:</span>
                        <span className="text-gray-500 line-through">
                          {record.originalBorrowTime
                            ? new Date(record.originalBorrowTime).toLocaleString()
                            : '-'}
                        </span>
                        <ArrowRight size={12} className="text-amber-400" />
                        <span className="text-white">
                          {record.borrowTime
                            ? new Date(record.borrowTime).toLocaleString()
                            : '-'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <span>预计返库:</span>
                        <span className="text-gray-500 line-through">
                          {record.originalReturnTime
                            ? new Date(record.originalReturnTime).toLocaleString()
                            : '-'}
                        </span>
                        <ArrowRight size={12} className="text-amber-400" />
                        <span className="text-white">
                          {record.expectedReturnTime
                            ? new Date(record.expectedReturnTime).toLocaleString()
                            : '-'}
                        </span>
                      </div>
                    </div>
                  )}

                  {!record.isSupplemented && (
                    <div className="mt-2 flex gap-6 text-xs text-gray-400">
                      <span>
                        借出时间:{' '}
                        {record.borrowTime
                          ? new Date(record.borrowTime).toLocaleString()
                          : '-'}
                      </span>
                      <span>
                        预计返库:{' '}
                        {record.expectedReturnTime
                          ? new Date(record.expectedReturnTime).toLocaleString()
                          : '-'}
                      </span>
                      {record.actualReturnTime && (
                        <span>
                          实际返库:{' '}
                          {new Date(record.actualReturnTime).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
