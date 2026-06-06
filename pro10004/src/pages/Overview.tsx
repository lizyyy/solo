import React, { useMemo } from 'react';
import { useScreeningStore } from '../store/useScreeningStore';
import { StatCard } from '../components/cards/StatCard';
import { RemittanceCard } from '../components/cards/RemittanceCard';
import { RemittanceStatus } from '../types';
import { Search, List, CheckCircle, AlertTriangle, Clock, FileText } from 'lucide-react';

export const Overview: React.FC = () => {
  const {
    getCurrentVersion,
    getFilteredRemittances,
    searchKeyword,
    setSearchKeyword,
    versions,
    currentVersionId,
    setCurrentVersion
  } = useScreeningStore();

  const currentVersion = getCurrentVersion();
  const filteredRemittances = getFilteredRemittances();

  const normalRemittances = useMemo(
    () => filteredRemittances.filter(r => r.status === RemittanceStatus.NORMAL),
    [filteredRemittances]
  );
  const abnormalRemittances = useMemo(
    () => filteredRemittances.filter(r => r.status === RemittanceStatus.ABNORMAL),
    [filteredRemittances]
  );
  const pendingRemittances = useMemo(
    () => filteredRemittances.filter(r => r.status === RemittanceStatus.PENDING),
    [filteredRemittances]
  );

  const totalAmount = useMemo(() => {
    return filteredRemittances.reduce((sum, r) => sum + r.amount, 0);
  }, [filteredRemittances]);

  const columnConfig = [
    {
      status: RemittanceStatus.NORMAL,
      title: '正常',
      data: normalRemittances,
      color: 'emerald',
      bgAccent: 'bg-emerald-50',
      borderAccent: 'border-emerald-200',
      textAccent: 'text-emerald-700',
      icon: CheckCircle
    },
    {
      status: RemittanceStatus.ABNORMAL,
      title: '异常',
      data: abnormalRemittances,
      color: 'red',
      bgAccent: 'bg-red-50',
      borderAccent: 'border-red-200',
      textAccent: 'text-red-700',
      icon: AlertTriangle
    },
    {
      status: RemittanceStatus.PENDING,
      title: '待确认',
      data: pendingRemittances,
      color: 'amber',
      bgAccent: 'bg-amber-50',
      borderAccent: 'border-amber-200',
      textAccent: 'text-amber-700',
      icon: Clock
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">筛查概览</h2>
            <p className="text-sm text-slate-500 mt-1">
              当前版本: <span className="font-medium text-slate-700">{currentVersion.name}</span>
              <span className="mx-2 text-slate-300">|</span>
              {currentVersion.timestamp}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <select
              value={currentVersionId}
              onChange={(e) => setCurrentVersion(e.target.value)}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {versions.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="搜索交易号、付款方、收款方..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-10 pr-4 py-2 w-80 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard
            title="总笔数"
            value={currentVersion.totalCount}
            subtitle={`合计 ${totalAmount.toLocaleString()} 美元等值`}
            icon={<List className="w-5 h-5 text-slate-600" />}
            color="default"
          />
          <StatCard
            title="正常"
            value={currentVersion.normalCount}
            subtitle="已通过筛查"
            icon={<CheckCircle className="w-5 h-5 text-emerald-600" />}
            color="green"
          />
          <StatCard
            title="异常"
            value={currentVersion.abnormalCount}
            subtitle="需重点关注"
            icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
            color="red"
          />
          <StatCard
            title="待确认"
            value={currentVersion.pendingCount}
            subtitle="等待人工复核"
            icon={<Clock className="w-5 h-5 text-amber-600" />}
            color="amber"
          />
        </div>

        <div className="grid grid-cols-3 gap-4" style={{ height: 'calc(100vh - 300px)' }}>
          {columnConfig.map(col => {
            const Icon = col.icon;
            return (
              <div
                key={col.status}
                className={`rounded-xl border ${col.borderAccent} ${col.bgAccent} flex flex-col overflow-hidden`}
              >
                <div className={`px-4 py-3 border-b ${col.borderAccent} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${col.textAccent}`} />
                    <span className={`font-semibold ${col.textAccent}`}>{col.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${col.bgAccent} ${col.textAccent} border ${col.borderAccent}`}>
                      {col.data.length}
                    </span>
                  </div>
                  <FileText className="w-4 h-4 text-slate-400" />
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {col.data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                      <Icon className="w-10 h-10 mb-2 opacity-30" />
                      <p className="text-sm">暂无{col.title}记录</p>
                    </div>
                  ) : (
                    col.data.map(remittance => (
                      <RemittanceCard key={remittance.id} remittance={remittance} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
