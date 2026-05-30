import { useState } from 'react';
import { ShieldCheck, ShieldX, Edit2, Check, X, ChevronDown } from 'lucide-react';
import { Customer, Tier, TIER_LABELS, TIER_COLORS } from '../../shared/types';

interface CustomerTableProps {
  customers: Customer[];
  onTierChange: (customerId: string, newTier: Tier) => void;
  onWhitelistToggle: (customerId: string, isWhitelisted: boolean) => void;
}

export default function CustomerTable({ customers, onTierChange, onWhitelistToggle }: CustomerTableProps) {
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<Tier>('S');

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const isExpiringSoon = (expiresAt?: string) => {
    if (!expiresAt) return false;
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffDays = (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 7 && diffDays > 0;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const handleEditTier = (customer: Customer) => {
    setEditingTierId(customer.id);
    setSelectedTier(customer.tier);
  };

  const handleSaveTier = (customerId: string) => {
    onTierChange(customerId, selectedTier);
    setEditingTierId(null);
  };

  const handleCancelEdit = () => {
    setEditingTierId(null);
  };

  return (
    <div className="bg-dark-100 rounded-xl border border-dark-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">客户名称</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">分层</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">优先级</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">白名单</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">过期时间</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">总请求</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">被拦次数</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-200">
            {customers.map((customer) => (
              <tr key={customer.id} className="hover:bg-dark-200/30 transition-colors">
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-white">{customer.name}</span>
                </td>
                <td className="px-4 py-3">
                  {editingTierId === customer.id ? (
                    <div className="flex items-center gap-1">
                      <div className="relative">
                        <select
                          value={selectedTier}
                          onChange={(e) => setSelectedTier(e.target.value as Tier)}
                          className="bg-dark border border-dark-200 text-white text-xs rounded px-2 py-1 appearance-none pr-6 focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {(['S', 'A', 'B', 'C'] as Tier[]).map((tier) => (
                            <option key={tier} value={tier}>
                              {tier} - {TIER_LABELS[tier]}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                      </div>
                      <button
                        onClick={() => handleSaveTier(customer.id)}
                        className="p-1 text-success hover:bg-success/20 rounded transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-1 text-danger hover:bg-danger/20 rounded transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span
                      className="px-2 py-1 text-xs font-medium rounded-full"
                      style={{ backgroundColor: `${TIER_COLORS[customer.tier]}20`, color: TIER_COLORS[customer.tier] }}
                    >
                      {customer.tier} - {TIER_LABELS[customer.tier]}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-300">{customer.priority}</span>
                </td>
                <td className="px-4 py-3">
                  {customer.isWhitelisted ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-success/20 text-success">
                      <ShieldCheck className="w-3 h-3" />
                      已加入
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-dark-200 text-slate-400">
                      <ShieldX className="w-3 h-3" />
                      未加入
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm ${
                    isExpired(customer.whitelistExpiresAt) ? 'text-danger font-medium' :
                    isExpiringSoon(customer.whitelistExpiresAt) ? 'text-warning font-medium' :
                    'text-slate-300'
                  }`}>
                    {formatDate(customer.whitelistExpiresAt)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-300">{customer.totalRequests.toLocaleString()}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-medium ${customer.blockedCount > 0 ? 'text-danger' : 'text-slate-300'}`}>
                    {customer.blockedCount}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditTier(customer)}
                      disabled={editingTierId === customer.id}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-dark-200 rounded transition-colors disabled:opacity-50"
                      title="编辑分层"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onWhitelistToggle(customer.id, !customer.isWhitelisted)}
                      className={`p-1.5 rounded transition-colors ${
                        customer.isWhitelisted
                          ? 'text-danger hover:bg-danger/20'
                          : 'text-success hover:bg-success/20'
                      }`}
                      title={customer.isWhitelisted ? '移除白名单' : '加入白名单'}
                    >
                      {customer.isWhitelisted ? (
                        <ShieldX className="w-4 h-4" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {customers.length === 0 && (
        <div className="p-12 text-center text-slate-500 text-sm">
          暂无客户数据
        </div>
      )}
    </div>
  );
}
