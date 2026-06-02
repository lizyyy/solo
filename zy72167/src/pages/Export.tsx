import { useState } from 'react';
import { useCarbonStore } from '@/store/carbonStore';
import { exportToExcel } from '@/utils/exporter';
import {
  FileSpreadsheet,
  Download,
  ChevronDown,
  ChevronUp,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import StatusBadge from '@/components/common/StatusBadge';
import SourceBadge from '@/components/common/SourceBadge';
import type { RecordStatus } from '@/types';

export default function ExportPage() {
  const { records, mergeGroups, getStats } = useCarbonStore();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RecordStatus | 'all'>('all');
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const stats = getStats();
  
  const filteredRecords = statusFilter === 'all'
    ? records
    : records.filter(r => r.status === statusFilter);

  const toggleExpand = (recordId: string) => {
    setExpandedRow(expandedRow === recordId ? null : recordId);
  };

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      exportToExcel(filteredRecords, mergeGroups, '低碳街区碳账本公示清单');
      setExporting(false);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    }, 500);
  };

  const getGroupForRecord = (recordId: string) => {
    return mergeGroups.find(g => g.mergedRecordIds.includes(recordId));
  };

  const formatAuditTrail = (record: typeof records[0]) => {
    if (!record.auditTrail || record.auditTrail.length === 0) {
      return '无审核记录';
    }
    
    const actionLabels: Record<string, string> = {
      import: '数据导入',
      merge: '自动归并',
      confirm: '人工确认',
      reject: '驳回',
      split: '拆分',
      supplement: '补录',
      remark: '添加备注',
    };

    return record.auditTrail.map((trail, idx) => {
      const time = new Date(trail.timestamp).toLocaleString('zh-CN');
      const action = actionLabels[trail.actionType] || trail.actionType;
      return (
        <div key={idx} className="text-xs bg-gray-50 rounded p-2 mb-1 last:mb-0">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-gray-700">{action}</span>
            <span className="text-gray-400">{time}</span>
          </div>
          <p className="text-gray-600">{trail.actionReason}</p>
          {trail.remark && (
            <p className="text-primary-600 mt-1">备注：{trail.remark}</p>
          )}
          <p className="text-gray-400 mt-1">操作人：{trail.operator}</p>
        </div>
      );
    });
  };

  const statusOptions: { value: RecordStatus | 'all'; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'review_confirmed', label: '审核通过' },
    { value: 'needs_confirmation', label: '需确认' },
    { value: 'auto_merged', label: '自动归并' },
    { value: 'pending_review', label: '待审核' },
    { value: 'rejected', label: '已驳回' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-serif text-lg font-semibold text-gray-800 mb-1">导出公示清单</h3>
          <p className="text-sm text-gray-500">
            导出的Excel将包含完整的判断原因和审核痕迹，可直接用于公示
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as RecordStatus | 'all')}
              className="input-field text-sm py-1.5 w-36"
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || filteredRecords.length === 0}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {exporting ? (
              <>
                <FileSpreadsheet className="w-4 h-4 animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                导出Excel ({filteredRecords.length})
              </>
            )}
          </button>
        </div>
      </div>

      {exportSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-center gap-3 animate-slide-in-right">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span className="text-green-800">公示清单导出成功！已包含完整判断原因和审核痕迹</span>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-500 mb-1">总记录数</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500 mb-1">审核通过</p>
          <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500 mb-1">待处理</p>
          <p className="text-2xl font-bold text-warn-600">{stats.pending + stats.needsReview}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500 mb-1">总碳排放量</p>
          <p className="text-2xl font-bold text-primary-600">{stats.totalCarbon.toFixed(1)}<span className="text-sm font-normal ml-1">kgCO2e</span></p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-10"></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">标准点位名称</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">原始名称</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">地址</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-24">排放量</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-28">来源</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-28">状态</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-24">日期</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords.map((record, index) => {
                const group = getGroupForRecord(record.id);
                const isExpanded = expandedRow === record.id;
                const canonicalName = group ? group.canonicalName : record.pointName;
                
                return (
                  <>
                    <tr
                      key={record.id}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${isExpanded ? 'bg-primary-50' : ''}`}
                      onClick={() => toggleExpand(record.id)}
                    >
                      <td className="px-4 py-3">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{canonicalName}</p>
                        {record.isOldCaliber && (
                          <span className="text-xs text-orange-600 bg-orange-50 rounded px-1.5 py-0.5">
                            旧口径
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{record.originalName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{record.address}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-primary-600">
                        {record.carbonAmount} {record.unit}
                      </td>
                      <td className="px-4 py-3">
                        <SourceBadge sourceType={record.sourceType} className="text-xs" />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={record.status} className="text-xs" />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{record.recordDate}</td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="px-4 py-0">
                          <div className="bg-primary-50/50 border-t border-primary-100 p-4">
                            <div className="grid grid-cols-2 gap-6">
                              <div>
                                <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                                  判断原因（导出时包含）
                                </h5>
                                <div className="bg-white rounded border border-gray-200 p-3">
                                  {group && (
                                    <div className="mb-3 pb-3 border-b border-gray-100">
                                      <p className="text-xs text-gray-500 mb-1">归并依据</p>
                                      <p className="text-sm text-gray-700">{group.mergeReason}</p>
                                      <p className="text-xs text-primary-600 mt-1">
                                        匹配度 {group.confidenceScore}%
                                      </p>
                                    </div>
                                  )}
                                  {record.isOldCaliber && (
                                    <div className="mb-3 pb-3 border-b border-gray-100">
                                      <p className="text-xs text-orange-600 font-medium mb-1">旧口径说明</p>
                                      <p className="text-sm text-orange-800">{record.oldCaliberNote}</p>
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">审核痕迹</p>
                                    {formatAuditTrail(record)}
                                  </div>
                                </div>
                              </div>
                              <div>
                                <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                                  导出字段预览
                                </h5>
                                <div className="bg-white rounded border border-gray-200 p-3 space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">标准点位名称</span>
                                    <span className="text-gray-800 font-medium">{canonicalName}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">原始名称</span>
                                    <span className="text-gray-800">{record.originalName}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">地址</span>
                                    <span className="text-gray-800">{record.address}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">碳排放量</span>
                                    <span className="text-gray-800">{record.carbonAmount} {record.unit}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">数据来源</span>
                                    <span className="text-gray-800">
                                      {record.sourceType === 'street_form' ? '街道表格' :
                                       record.sourceType === 'inspection_photo' ? '现场照片' :
                                       record.sourceType === 'approval_record' ? '审批记录' : '人工补录'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">审核状态</span>
                                    <span className="text-gray-800">
                                      {record.status === 'review_confirmed' ? '审核通过' :
                                       record.status === 'needs_confirmation' ? '需要人工确认' :
                                       record.status === 'auto_merged' ? '自动归并待确认' :
                                       record.status === 'rejected' ? '已驳回' : '待审核'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">操作人</span>
                                    <span className="text-gray-800">{record.operator}</span>
                                  </div>
                                  {record.remark && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">备注</span>
                                      <span className="text-gray-800">{record.remark}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">导出说明</h4>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>导出的Excel包含两个工作表：「公示清单」和「汇总信息」</li>
          <li>「判断原因」列包含完整的归并依据和审核痕迹链，可用于公示说明</li>
          <li>旧口径数据会在判断原因中特别标注，确保数据口径可追溯</li>
          <li>所有操作人均会显示在导出文件中，明确责任归属</li>
        </ul>
      </div>
    </div>
  );
}
