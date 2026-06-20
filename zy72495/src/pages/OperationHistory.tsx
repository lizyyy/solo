import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Clock, Upload, Edit3, Trash2, RotateCcw, ClipboardCheck, Bus, FileText, Repeat, MapPin,
  ChevronDown, ChevronUp, Download, Search, Filter
} from 'lucide-react';
import { useAppStore } from '@/store';
import { getFieldDisplayName } from '@/utils/diffUtils';
import { showToast } from '@/utils/errorMessageUtils';

export default function OperationHistory() {
  const { operationLogs, busTimeSlots, rollbackToVersion, currentUser } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [operationTypeFilter, setOperationTypeFilter] = useState<string>('');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('');
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  const getOperationLabel = (type: string): string => {
    const labels: Record<string, string> = { import: '导入', edit: '编辑', delete: '删除', rollback: '回滚', review: '复核' };
    return labels[type] || type;
  };

  const getTargetTypeLabel = (type: string): string => {
    const labels: Record<string, string> = { busTimeSlot: '公交时段', redlineRemark: '红线备注', stallRotation: '摊位轮换', point: '边界点位' };
    return labels[type] || type;
  };

  const getSlotCountByBatchId = (batchId: string): number => busTimeSlots.filter((s) => s.importBatchId === batchId).length;

  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'import': return <Upload size={16} />;
      case 'edit': return <Edit3 size={16} />;
      case 'delete': return <Trash2 size={16} />;
      case 'rollback': return <RotateCcw size={16} />;
      case 'review': return <ClipboardCheck size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const getTargetIcon = (type: string) => {
    switch (type) {
      case 'busTimeSlot': return <Bus size={14} />;
      case 'redlineRemark': return <FileText size={14} />;
      case 'stallRotation': return <Repeat size={14} />;
      case 'point': return <MapPin size={14} />;
      default: return null;
    }
  };

  const getOperationBadgeClass = (type: string): string => {
    switch (type) {
      case 'import': return 'bg-blue-100 text-blue-700';
      case 'edit': return 'bg-amber-100 text-amber-700';
      case 'delete': return 'bg-red-100 text-red-700';
      case 'rollback': return 'bg-purple-100 text-purple-700';
      case 'review': return 'bg-green-100 text-green-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const filteredLogs = useMemo(() => {
    return operationLogs.filter((log) => {
      if (searchQuery && !log.operatorName.includes(searchQuery)) return false;
      if (operationTypeFilter && log.operationType !== operationTypeFilter) return false;
      if (targetTypeFilter && log.targetType !== targetTypeFilter) return false;
      return true;
    });
  }, [operationLogs, searchQuery, operationTypeFilter, targetTypeFilter]);

  const toggleExpand = (logId: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId); else next.add(logId);
      return next;
    });
  };

  const handleRollback = (log: typeof operationLogs[0]) => {
    if (!currentUser) return;
    const logs = operationLogs.filter((l) => l.targetType === log.targetType && l.targetId.includes(log.targetId));
    const versionIndex = logs.findIndex((l) => l.id === log.id);
    if (versionIndex === -1) return;
    const success = rollbackToVersion(log.targetId, log.targetType, versionIndex);
    if (success) showToast('回滚成功', 'success'); else showToast('回滚失败', 'error');
  };

  const handleExport = () => {
    try {
      const exportData = filteredLogs.map((log) => {
        const updateDetails = (log.metadata?.updateDetails as Array<{ slotId: string; passengerCountBefore: number; passengerCountAfter: number; routeKey: string }>) || [];
        const newDetails = (log.metadata?.newDetails as Array<{ slotId: string; routeKey: string }>) || [];
        const diffString = log.diff
          ? Object.entries(log.diff)
              .map(([field, values]) => { const v = values as { before: unknown; after: unknown }; return `${getFieldDisplayName(field)}: ${String(v.before)} → ${String(v.after)}`; })
              .join('; ')
          : '';
        const updateDetailsStr = updateDetails.map((d) => `${d.routeKey.replace(/\|/g, '-')} 客流${d.passengerCountBefore}→${d.passengerCountAfter}(ID:${d.slotId.slice(-8)})`).join('; ');
        const newDetailsStr = newDetails.map((d) => `${d.routeKey.replace(/\|/g, '-')}(ID:${d.slotId.slice(-8)})`).join('; ');
        return {
          记录ID: log.id,
          操作时间: new Date(log.timestamp).toLocaleString('zh-CN'),
          操作人: log.operatorName,
          操作类型: getOperationLabel(log.operationType),
          操作对象: getTargetTypeLabel(log.targetType),
          对象ID: log.targetId,
          修改内容: diffString,
          批次ID: (log.metadata?.batchId as string) || '',
          新增数量: (log.metadata?.newCount as number) || 0,
          更新数量: (log.metadata?.updateCount as number) || 0,
          更新记录明细: updateDetailsStr,
          新增记录明细: newDetailsStr,
        };
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, '操作历史');
      XLSX.writeFile(wb, `操作历史_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast(`导出成功，共 ${exportData.length} 条记录`, 'success');
    } catch (e) {
      showToast('导出失败，请重试', 'error');
    }
  };

