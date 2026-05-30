import { useEffect, useState, useMemo } from 'react';
import { Search, Filter, Shield, ShieldOff, Plus, X, Check, RefreshCw } from 'lucide-react';
import { useStore } from '@/store';
import CustomerTable from '@/components/CustomerTable';
import { TableSkeleton } from '@/components/Skeleton';
import type { Customer, Tier, AddWhitelistRequest } from '../../shared/types';
import { TIER_LABELS, TIER_COLORS } from '../../shared/types';
import { cn } from '@/lib/utils';

export default function CustomerList() {
  const customers = useStore((state) => state.customers);
  const whitelist = useStore((state) => state.whitelist);
  const fetchCustomers = useStore((state) => state.fetchCustomers);
  const fetchWhitelist = useStore((state) => state.fetchWhitelist);
  const addWhitelist = useStore((state) => state.addWhitelist);
  const removeWhitelist = useStore((state) => state.removeWhitelist);
  const customersLoading = useStore((state) => state.loading.customers);
  const whitelistLoading = useStore((state) => state.loading.whitelist);
  const error = useStore((state) => state.error);

  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<Tier | 'all'>('all');
  const [whitelistFilter, setWhitelistFilter] = useState<'all' | 'whitelisted' | 'not-whitelisted'>('all');

  const [showAddWhitelistDialog, setShowAddWhitelistDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [whitelistReason, setWhitelistReason] = useState('');
  const [whitelistExpiresAt, setWhitelistExpiresAt] = useState('');

  const [renewCustomerId, setRenewCustomerId] = useState<string | null>(null);
  const [renewExpiresAt, setRenewExpiresAt] = useState('');

  useEffect(() => {
    fetchCustomers();
    fetchWhitelist();
  }, [fetchCustomers, fetchWhitelist]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchesSearch = customer.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTier = tierFilter === 'all' || customer.tier === tierFilter;
      const matchesWhitelist =
        whitelistFilter === 'all' ||
        (whitelistFilter === 'whitelisted' && customer.isWhitelisted) ||
        (whitelistFilter === 'not-whitelisted' && !customer.isWhitelisted);
      return matchesSearch && matchesTier && matchesWhitelist;
    });
  }, [customers, searchQuery, tierFilter, whitelistFilter]);

  const handleAddWhitelist = async () => {
    if (!selectedCustomer || !whitelistReason.trim()) return;

    const data: AddWhitelistRequest = {
      customerId: selectedCustomer.id,
      reason: whitelistReason,
    };
    if (whitelistExpiresAt) {
      data.expiresAt = new Date(whitelistExpiresAt).toISOString();
    }

    const result = await addWhitelist(data);
    if (result) {
      setShowAddWhitelistDialog(false);
      setSelectedCustomer(null);
      setWhitelistReason('');
      setWhitelistExpiresAt('');
    }
  };

  const handleRemoveWhitelist = async (customerId: string) => {
    const reason = prompt('请输入移除白名单的理由：');
    if (!reason) return;
    await removeWhitelist(customerId, reason);
  };

  const handleRenewWhitelist = async (customer: Customer) => {
    if (!renewExpiresAt) return;

    const data: AddWhitelistRequest = {
      customerId: customer.id,
      reason: '续期白名单',
      expiresAt: new Date(renewExpiresAt).toISOString(),
    };

    const result = await addWhitelist(data);
    if (result) {
      setRenewCustomerId(null);
      setRenewExpiresAt('');
    }
  };

  const openAddWhitelistDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setWhitelistReason('');
    setWhitelistExpiresAt('');
    setShowAddWhitelistDialog(true);
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-white">客户管理</h2>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索客户名称..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-dark border border-dark-200 text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-400" />
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value as Tier | 'all')}
                className="px-4 py-2.5 rounded-lg bg-dark border border-dark-200 text-white focus:outline-none focus:border-primary transition-colors"
              >
                <option value="all">全部分层</option>
                <option value="S">{TIER_LABELS.S}</option>
                <option value="A">{TIER_LABELS.A}</option>
                <option value="B">{TIER_LABELS.B}</option>
                <option value="C">{TIER_LABELS.C}</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-slate-400" />
              <select
                value={whitelistFilter}
                onChange={(e) => setWhitelistFilter(e.target.value as 'all' | 'whitelisted' | 'not-whitelisted')}
                className="px-4 py-2.5 rounded-lg bg-dark border border-dark-200 text-white focus:outline-none focus:border-primary transition-colors"
              >
                <option value="all">全部</option>
                <option value="whitelisted">白名单</option>
                <option value="not-whitelisted">非白名单</option>
              </select>
            </div>
          </div>
        </div>

        {customersLoading ? (
          <TableSkeleton rows={5} columns={7} />
        ) : (
          <CustomerTable
            customers={filteredCustomers}
            onTierChange={handleTierChange}
            onWhitelistToggle={handleWhitelistToggle}
          />
        )}

        {!customersLoading && filteredCustomers.length === 0 && (
          <div className="card p-12 text-center">
            <p className="text-slate-400">
              {searchQuery || tierFilter !== 'all' || whitelistFilter !== 'all'
                ? '没有找到匹配的客户'
                : '暂无客户数据'}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-bold text-white">白名单管理</h2>

        {whitelistLoading ? (
          <TableSkeleton rows={3} columns={5} />
        ) : whitelist.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-slate-400">暂无白名单客户</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dark-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      客户名称
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      分层
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      加入理由
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      过期时间
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-200">
                  {whitelist.map((customer) => {
                    const expired = isExpired(customer.whitelistExpiresAt);
                    return (
                      <tr
                        key={customer.id}
                        className={cn(
                          'hover:bg-dark-100/50 transition-colors',
                          expired && 'bg-danger/5'
                        )}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">
                            {customer.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{
                              backgroundColor: `${TIER_COLORS[customer.tier]}20`,
                              color: TIER_COLORS[customer.tier],
                            }}
                          >
                            {TIER_LABELS[customer.tier]}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400 max-w-xs truncate">
                          {customer.whitelistReason || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {renewCustomerId === customer.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                value={renewExpiresAt}
                                onChange={(e) => setRenewExpiresAt(e.target.value)}
                                className="px-3 py-1.5 rounded-lg bg-dark border border-dark-200 text-white text-sm focus:outline-none focus:border-primary"
                                min={new Date().toISOString().split('T')[0]}
                              />
                              <button
                                onClick={() => handleRenewWhitelist(customer)}
                                disabled={!renewExpiresAt}
                                className="p-1.5 rounded text-success hover:bg-success/20 disabled:opacity-50 transition-colors"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setRenewCustomerId(null);
                                  setRenewExpiresAt('');
                                }}
                                className="p-1.5 rounded text-slate-400 hover:bg-dark-200 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'text-sm',
                                  expired ? 'text-danger font-medium' : 'text-slate-300'
                                )}
                              >
                                {customer.whitelistExpiresAt
                                  ? new Date(customer.whitelistExpiresAt).toLocaleDateString('zh-CN')
                                  : '永久有效'}
                              </span>
                              {expired && (
                                <span className="px-2 py-0.5 rounded text-xs bg-danger/20 text-danger">
                                  已过期
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            {customer.whitelistExpiresAt && (
                              <button
                                onClick={() => {
                                  setRenewCustomerId(customer.id);
                                  const nextMonth = new Date();
                                  nextMonth.setMonth(nextMonth.getMonth() + 1);
                                  setRenewExpiresAt(nextMonth.toISOString().split('T')[0]);
                                }}
                                className={cn(
                                  'px-3 py-1 rounded text-xs flex items-center gap-1 transition-colors',
                                  expired
                                    ? 'bg-warning/20 text-warning hover:bg-warning/30'
                                    : 'bg-primary/20 text-primary-light hover:bg-primary/30'
                                )}
                              >
                                <RefreshCw className="w-3 h-3" />
                                {expired ? '重新加入' : '续期'}
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveWhitelist(customer.id)}
                              className="px-3 py-1 rounded text-xs bg-danger/20 text-danger hover:bg-danger/30 transition-colors flex items-center gap-1"
                            >
                              <ShieldOff className="w-3 h-3" />
                              移除
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showAddWhitelistDialog && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">加入白名单</h3>
            <p className="text-slate-400 mb-4">
              将 <span className="text-white font-medium">{selectedCustomer.name}</span> 加入白名单
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  加入理由 <span className="text-danger">*</span>
                </label>
                <textarea
                  value={whitelistReason}
                  onChange={(e) => setWhitelistReason(e.target.value)}
                  placeholder="请输入加入白名单的理由..."
                  className="w-full px-4 py-2 rounded-lg bg-dark border border-dark-200 text-white placeholder-slate-500 focus:outline-none focus:border-primary resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  过期时间（可选）
                </label>
                <input
                  type="date"
                  value={whitelistExpiresAt}
                  onChange={(e) => setWhitelistExpiresAt(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-dark border border-dark-200 text-white focus:outline-none focus:border-primary"
                  min={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-slate-500 mt-1">不填则永久有效</p>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowAddWhitelistDialog(false);
                  setSelectedCustomer(null);
                }}
                className="px-4 py-2 rounded-lg bg-dark-200 text-white hover:bg-dark-300 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddWhitelist}
                disabled={!whitelistReason.trim()}
                className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                确认加入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
