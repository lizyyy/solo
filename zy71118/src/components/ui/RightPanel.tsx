import { AlertTriangle, Package, BarChart3, Info } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { getIssueStats, getIssueTypeLabel } from '../../utils/inspection';
import { cn } from '../../lib/utils';

export function RightPanel() {
  const store = useAppStore((state) => state.store);
  const issues = useAppStore((state) => state.issues);
  const selectedSkuSlotId = useAppStore((state) => state.selectedSkuSlotId);
  const getSkuSlotById = useAppStore((state) => state.getSkuSlotById);
  const selectedShelfId = useAppStore((state) => state.selectedShelfId);
  const getShelfById = useAppStore((state) => state.getShelfById);

  const issueStats = getIssueStats(issues);
  const selectedSlotInfo = selectedSkuSlotId ? getSkuSlotById(selectedSkuSlotId) : null;
  const selectedShelf = selectedShelfId ? getShelfById(selectedShelfId) : null;

  if (!store) {
    return (
      <div className="w-72 bg-slate-900 border-l border-slate-700 flex flex-col h-full items-center justify-center">
        <Package className="w-12 h-12 text-slate-600 mb-4" />
        <p className="text-slate-500 text-sm">请先导入门店数据</p>
      </div>
    );
  }

  return (
    <div className="w-72 bg-slate-900 border-l border-slate-700 flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-bold text-white">{store.name}</h2>
        <p className="text-xs text-slate-400 mt-1">货架总数: {store.shelves.length}</p>
      </div>

      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          <span className="font-medium text-slate-200 text-sm">统计概览</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="总问题" value={issueStats.total} color="text-white" />
          <StatCard label="严重" value={issueStats.bySeverity.high} color="text-red-400" />
          <StatCard label="中等" value={issueStats.bySeverity.medium} color="text-amber-400" />
          <StatCard label="轻微" value={issueStats.bySeverity.low} color="text-green-400" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="font-medium text-slate-200 text-sm">问题列表</span>
        </div>
        
        {issues.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-green-900/30 flex items-center justify-center mx-auto mb-2">
              <span className="text-green-400 text-xl">✓</span>
            </div>
            <p className="text-green-400 text-sm">陈列合规，无问题</p>
          </div>
        ) : (
          <div className="space-y-2">
            {issues.slice(0, 20).map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
            {issues.length > 20 && (
              <p className="text-center text-slate-500 text-xs py-2">
                还有 {issues.length - 20} 个问题...
              </p>
            )}
          </div>
        )}
      </div>

      {(selectedSlotInfo || selectedShelf) && (
        <div className="p-4 border-t border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-blue-400" />
            <span className="font-medium text-slate-200 text-sm">选中详情</span>
          </div>
          
          {selectedSlotInfo && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">SKU名称:</span>
                <span className="text-white">{selectedSlotInfo.slot.skuName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">分类:</span>
                <span className="text-white">{selectedSlotInfo.slot.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">层板:</span>
                <span className="text-white">{selectedSlotInfo.layer.index + 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">位置:</span>
                <span className="text-white">{selectedSlotInfo.slot.position + 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">状态:</span>
                <span className={selectedSlotInfo.slot.isOutOfStock ? 'text-red-400' : 'text-green-400'}>
                  {selectedSlotInfo.slot.isOutOfStock ? '缺货' : '正常'}
                </span>
              </div>
            </div>
          )}
          
          {selectedShelf && !selectedSlotInfo && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">货架ID:</span>
                <span className="text-white">{selectedShelf.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">类型:</span>
                <span className="text-white">{selectedShelf.isEndcap ? '端架' : '普通货架'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">层数:</span>
                <span className="text-white">{selectedShelf.layers.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">SKU总数:</span>
                <span className="text-white">
                  {selectedShelf.layers.reduce((sum, l) => sum + l.slots.length, 0)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  color: string;
}

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-2 text-center">
      <div className={cn('text-xl font-bold', color)}>{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

interface IssueCardProps {
  issue: {
    id: string;
    type: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
  };
}

function IssueCard({ issue }: IssueCardProps) {
  const severityConfig = {
    high: { bg: 'bg-red-900/30', border: 'border-red-700', text: 'text-red-400', label: '严重' },
    medium: { bg: 'bg-amber-900/30', border: 'border-amber-700', text: 'text-amber-400', label: '中等' },
    low: { bg: 'bg-green-900/30', border: 'border-green-700', text: 'text-green-400', label: '轻微' },
  };

  const config = severityConfig[issue.severity];

  return (
    <div className={cn('p-3 rounded-lg border', config.bg, config.border)}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-300">
          {getIssueTypeLabel(issue.type)}
        </span>
        <span className={cn('text-xs px-2 py-0.5 rounded', config.bg, config.text)}>
          {config.label}
        </span>
      </div>
      <p className="text-xs text-slate-400">{issue.description}</p>
    </div>
  );
}
