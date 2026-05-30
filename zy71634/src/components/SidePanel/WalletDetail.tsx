
import { useState } from 'react';
import { Wallet, Transaction, WorkflowStatus } from '../../types';
import { useAppStore, selectWalletTransactions } from '../../store/useAppStore';
import { Tag, Copy, ExternalLink, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';

const statusConfig = {
  normal: { color: 'bg-blue-500', label: '正常' },
  warning: { color: 'bg-amber-500', label: '警告' },
  anomaly: { color: 'bg-red-500', label: '异常' },
  pending: { color: 'bg-purple-500', label: '待审核' },
  rejected: { color: 'bg-red-600', label: '已拒绝' },
};

const workflowConfig: Record<WorkflowStatus, { icon: React.ElementType; color: string; label: string }> = {
  draft: { icon: Clock, color: 'text-slate-400', label: '草稿' },
  submitted: { icon: Clock, color: 'text-amber-400', label: '已提交' },
  returned: { icon: AlertTriangle, color: 'text-orange-400', label: '退回补材料' },
  approved: { icon: CheckCircle, color: 'text-emerald-400', label: '已通过' },
};

const anomalyLabels: Record<string, string> = {
  merge_error: '地址合并错误',
  time_mismatch: '时间顺序错乱',
  cycle_transfer: '循环转账',
  suspicious: '可疑交易',
};

interface WalletDetailProps {
  wallet: Wallet;
}

export const WalletDetail = ({ wallet }: WalletDetailProps) => {
  const [newTag, setNewTag] = useState('');
  const transactions = useAppStore(selectWalletTransactions(wallet.id));
  const updateWalletTags = useAppStore((state) => state.updateWalletTags);
  const updateWallet = useAppStore((state) => state.updateWallet);
  const updateWorkflowStatus = useAppStore((state) => state.updateWorkflowStatus);
  const setHighlightedPath = useAppStore((state) => state.setHighlightedPath);

  const handleAddTag = () => {
    if (newTag.trim() && !wallet.tags.includes(newTag.trim())) {
      updateWalletTags(wallet.id, [...wallet.tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    updateWalletTags(wallet.id, wallet.tags.filter((t) => t !== tagToRemove));
  };

  const handleHighlightPath = (tx: Transaction) => {
    setHighlightedPath([tx.from, tx.to]);
  };

  const handleContinueWorkflow = (txId: string) => {
    updateWorkflowStatus(txId, 'submitted');
  };

  const anomalyTransactions = transactions.filter((t) => t.isAnomaly);
  const normalTransactions = transactions.filter((t) => !t.isAnomaly);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${statusConfig[wallet.status].color}`} />
              <h3 className="text-white font-bold text-lg">{wallet.label}</h3>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-slate-400 text-xs font-mono">
                {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
              </code>
              <button
                onClick={() => copyToClipboard(wallet.address)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <Copy size={12} />
              </button>
            </div>
          </div>
          <span className="text-emerald-400 font-bold">
            ${wallet.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-800/50 rounded-lg p-2">
            <div className="text-slate-400 text-xs">交易数</div>
            <div className="text-white font-bold">{wallet.metadata.transactionCount}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2">
            <div className="text-slate-400 text-xs">交互地址</div>
            <div className="text-white font-bold">{wallet.metadata.uniqueInteractions}</div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Tag size={14} className="text-slate-400" />
            <span className="text-slate-400 text-sm">标签</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {wallet.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-500/20 text-indigo-300 text-xs rounded-full border border-indigo-500/30"
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-indigo-100"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="添加标签..."
              className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleAddTag}
              className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-500 transition-colors"
            >
              添加
            </button>
          </div>
        </div>

        <div>
          <div className="text-slate-400 text-sm mb-2">备注</div>
          <textarea
            value={wallet.notes}
            onChange={(e) => updateWallet(wallet.id, { notes: e.target.value })}
            placeholder="添加备注..."
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none h-20"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {anomalyTransactions.length > 0 && (
          <div className="p-4 border-b border-slate-700/50">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-400" />
              <span className="text-red-400 font-semibold">异常交易 ({anomalyTransactions.length})</span>
            </div>
            <div className="space-y-2">
              {anomalyTransactions.map((tx) => {
                const WorkflowIcon = workflowConfig[tx.workflowStatus || 'draft']?.icon;
                return (
                  <div
                    key={tx.id}
                    className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-red-400 text-xs font-medium">
                        {anomalyLabels[tx.anomalyType || ''] || '未知异常'}
                      </span>
                      {WorkflowIcon && (
                        <span className={`flex items-center gap-1 text-xs ${workflowConfig[tx.workflowStatus || 'draft']?.color}`}>
                          <WorkflowIcon size={12} />
                          {workflowConfig[tx.workflowStatus || 'draft']?.label}
                        </span>
                      )}
                    </div>
                    <div className="text-white text-sm font-mono mb-1">
                      {tx.token} {tx.amount.toLocaleString()}
                    </div>
                    <div className="text-slate-400 text-xs mb-2">
                      {formatDate(tx.timestamp)}
                    </div>
                    {tx.notes && (
                      <div className="text-slate-300 text-xs mb-2 p-2 bg-slate-800/50 rounded">
                        {tx.notes}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleHighlightPath(tx)}
                        className="flex-1 px-2 py-1 bg-indigo-600/50 text-white text-xs rounded hover:bg-indigo-500/50 transition-colors"
                      >
                        高亮路径
                      </button>
                      {tx.workflowStatus === 'returned' && (
                        <button
                          onClick={() => handleContinueWorkflow(tx.id)}
                          className="flex-1 px-2 py-1 bg-emerald-600/50 text-white text-xs rounded hover:bg-emerald-500/50 transition-colors"
                        >
                          继续提交
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="p-4">
          <div className="text-slate-400 text-sm mb-3">交易记录 ({normalTransactions.length})</div>
          <div className="space-y-2">
            {normalTransactions.slice(0, 10).map((tx) => (
              <div
                key={tx.id}
                className="p-2 bg-slate-800/50 rounded hover:bg-slate-700/50 cursor-pointer transition-colors"
                onClick={() => handleHighlightPath(tx)}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${tx.from === wallet.id ? 'text-red-400' : 'text-emerald-400'}`}>
                    {tx.from === wallet.id ? '→' : '←'}
                  </span>
                  <span className="text-white text-sm font-mono">
                    {tx.token} {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-slate-500 text-xs">
                    {formatDate(tx.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
