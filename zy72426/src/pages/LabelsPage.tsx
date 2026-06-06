import { useState, useMemo } from 'react';
import { Card } from '@/components/common/Card';
import { SongGroupCard } from '@/components/labels/SongGroupCard';
import { RecordRow } from '@/components/labels/RecordRow';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useEmotionLabelStore } from '@/store/useEmotionLabelStore';
import { Tags, Filter, Download, RefreshCw, Search, CheckSquare, Square } from 'lucide-react';
import { exportCSV, exportExcel } from '@/utils/exporter';
import type { RecordStatus } from '@/types';

export const LabelsPage = () => {
  const { records, groups, runSelfCheck, batchUpdateStatus, recalculateAllEmotions } = useEmotionLabelStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RecordStatus | 'all'>('all');
  const [showOnlyGrouped, setShowOnlyGrouped] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const groupedRecords = useMemo(() => {
    return groups.map((group) => ({
      group,
      records: group.memberIds
        .map((id) => records.find((r) => r.id === id))
        .filter(Boolean),
    }));
  }, [groups, records]);

  const ungroupedRecords = useMemo(() => {
    return records.filter((r) => !r.groupId);
  }, [records]);

  const filteredUngrouped = useMemo(() => {
    return ungroupedRecords.filter((r) => {
      if (showOnlyGrouped) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          r.liveName.toLowerCase().includes(term) ||
          r.copyrightName.toLowerCase().includes(term) ||
          r.emotionTag.toLowerCase().includes(term) ||
          r.audioNote.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [ungroupedRecords, searchTerm, statusFilter, showOnlyGrouped]);

  const filteredGroups = useMemo(() => {
    return groupedRecords.filter(({ group, records: groupRecords }) => {
      if (statusFilter !== 'all') {
        const hasMatchingStatus = groupRecords.some((r) => r?.status === statusFilter);
        if (!hasMatchingStatus) return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          group.canonicalName.toLowerCase().includes(term) ||
          groupRecords.some(
            (r) =>
              r?.liveName.toLowerCase().includes(term) ||
              r?.copyrightName.toLowerCase().includes(term)
          )
        );
      }
      return true;
    });
  }, [groupedRecords, searchTerm, statusFilter]);

  const handleSelectAll = () => {
    const allIds = [
      ...filteredUngrouped.map((r) => r.id),
      ...filteredGroups.flatMap(({ records: gr }) => gr.map((r) => r!.id)),
    ];
    setSelectedIds(selectedIds.length === allIds.length ? [] : allIds);
  };

  const handleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBatchConfirm = () => {
    if (selectedIds.length === 0) return;
    batchUpdateStatus(selectedIds, 'confirmed');
    setSelectedIds([]);
  };

  const handleExportCSV = () => {
    exportCSV(records, groups);
  };

  const handleExportExcel = () => {
    exportExcel(records, groups);
  };

  const stats = {
    total: records.length,
    confirmed: records.filter((r) => r.status === 'confirmed').length,
    reviewing: records.filter((r) => r.status === 'reviewing').length,
    pending: records.filter((r) => r.status === 'pending').length,
    grouped: records.filter((r) => r.groupId).length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            第二步：情绪标签管理
          </h1>
          <p className="text-gray-500 mt-1">许老师补看音频文件备注，复核现场名/版权名关联</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={recalculateAllEmotions}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重算全部
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 text-sm text-[#1e3a5f] bg-[#ebf4ff] rounded hover:bg-[#dbeafe] transition-colors"
          >
            <Download className="w-4 h-4" />
            导出CSV
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-[#1e3a5f] rounded hover:bg-[#2c5282] transition-colors"
          >
            <Download className="w-4 h-4" />
            导出Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-sm border border-gray-200">
          <p className="text-sm text-gray-500">总记录数</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-sm border border-green-200">
          <p className="text-sm text-green-600">已确认</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{stats.confirmed}</p>
        </div>
        <div className="bg-white p-4 rounded-sm border border-amber-200">
          <p className="text-sm text-amber-600">待复核</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{stats.reviewing}</p>
        </div>
        <div className="bg-white p-4 rounded-sm border border-gray-200">
          <p className="text-sm text-gray-500">待处理</p>
          <p className="text-2xl font-bold text-gray-700 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-white p-4 rounded-sm border border-[#2c5282]">
          <p className="text-sm text-[#2c5282]">已分组</p>
          <p className="text-2xl font-bold text-[#1e3a5f] mt-1">{stats.grouped}</p>
        </div>
      </div>

      <Card
        title={
          <div className="flex items-center gap-2">
            <Tags className="w-5 h-5 text-[#1e3a5f]" />
            数据明细
          </div>
        }
        subtitle={`共 ${records.length} 条记录，${groups.length} 个分组`}
        headerAction={
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="搜索歌曲名、标签、备注..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#2c5282] w-64"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as RecordStatus | 'all')}
              className="px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#2c5282]"
            >
              <option value="all">全部状态</option>
              <option value="pending">待处理</option>
              <option value="reviewing">待复核</option>
              <option value="confirmed">已确认</option>
              <option value="exception">异常</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyGrouped}
                onChange={(e) => setShowOnlyGrouped(e.target.checked)}
                className="rounded"
              />
              仅显示分组
            </label>
          </div>
        }
      >
        {selectedIds.length > 0 && (
          <div className="mb-4 p-3 bg-[#ebf4ff] border border-[#bfdbfe] rounded flex items-center justify-between">
            <span className="text-sm text-[#1e3a5f]">
              已选择 {selectedIds.length} 条记录
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBatchConfirm}
                className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                批量确认
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                取消选择
              </button>
            </div>
          </div>
        )}

        {filteredGroups.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              同名分组（{filteredGroups.length}）
              <span className="text-xs text-amber-600 font-normal">
                待复核的现场名/版权名记录，留给音乐老师确认
              </span>
            </h3>
            {filteredGroups.map(({ group, records: groupRecords }) => (
              <SongGroupCard
                key={group.id}
                group={group}
                records={groupRecords.filter(Boolean) as any}
              />
            ))}
          </div>
        )}

        {filteredUngrouped.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              未分组记录（{filteredUngrouped.length}）
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs border-b border-gray-200">
                    <th className="px-4 py-3 text-left w-10">
                      <button onClick={handleSelectAll} className="text-gray-500 hover:text-gray-700">
                        {selectedIds.length ===
                        [...filteredUngrouped.map((r) => r.id), ...filteredGroups.flatMap(({ records: gr }) => gr.map((r) => r!.id))].length ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 w-24">原始行号</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">现场名</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">版权名</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 w-40">情绪标签</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 w-24">状态</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">音频备注（许老师补录）</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 w-28">导入版本</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 w-20">改动</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUngrouped.map((record) => (
                    <tr key={record.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button onClick={() => handleSelect(record.id)} className="text-gray-500 hover:text-gray-700">
                          {selectedIds.includes(record.id) ? (
                            <CheckSquare className="w-4 h-4 text-[#1e3a5f]" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <RecordRow record={record} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filteredGroups.length === 0 && filteredUngrouped.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Tags className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>暂无符合条件的记录</p>
            <p className="text-sm mt-1">请先导入数据或调整筛选条件</p>
          </div>
        )}
      </Card>
    </div>
  );
};
