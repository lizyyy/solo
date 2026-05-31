import { useState, useMemo } from 'react';
import { FileCheck, Download, CheckCircle, AlertTriangle, ArrowRightLeft, FileText, Table, Eye, Check, Clock, User } from 'lucide-react';
import { useAppStore } from '@/store';
import type { BaseRecord } from '@/types';
import { sourceLabels, statusLabels } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import { formatDate } from '@/utils/helpers';
import { exportInspectionPDF, exportRecordsExcel } from '@/utils/exporter';

interface Difference {
  field: string;
  recordValue: string;
  inspectionValue: string;
}

interface ReviewItem {
  record: BaseRecord;
  differences: Difference[];
  reviewed: boolean;
}

export default function ReviewPage() {
  const { records, currentRoute, exhibits, updateRecord, currentUser } = useAppStore();
  const [selectedTab, setSelectedTab] = useState<'comparison' | 'summary'>('comparison');
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>(() => 
    records
      .filter(r => r.status !== 'duplicate')
      .map(r => ({
        record: r,
        differences: generateDifferences(r),
        reviewed: false,
      }))
  );
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  function generateDifferences(record: BaseRecord): Difference[] {
    const diffs: Difference[] = [];
    
    if (record.source === 'inspection_photo' && !record.content.inspectionDate) {
      diffs.push({
        field: '巡检日期',
        recordValue: record.content.inspectionDate || '(未填写)',
        inspectionValue: '需要填写',
      });
    }
    
    if (!record.content.position) {
      diffs.push({
        field: '展位位置',
        recordValue: '(空)',
        inspectionValue: '需要确认',
      });
    }
    
    if (record.content.notes && record.content.notes.includes('位置') && !record.content.position) {
      diffs.push({
        field: '位置备注',
        recordValue: record.content.notes,
        inspectionValue: '位置信息不一致',
      });
    }
    
    return diffs;
  }

  const stats = useMemo(() => {
    const total = reviewItems.length;
    const reviewed = reviewItems.filter(r => r.reviewed).length;
    const withDifferences = reviewItems.filter(r => r.differences.length > 0).length;
    const pending = records.filter(r => r.status === 'pending').length;
    const normal = records.filter(r => r.status === 'normal').length;
    return { total, reviewed, withDifferences, pending, normal };
  }, [reviewItems, records]);

  const handleMarkReviewed = (recordId: string) => {
    setReviewItems(prev => prev.map(item => 
      item.record.id === recordId 
        ? { ...item, reviewed: true }
        : item
    ));
    
    if (reviewNote.trim()) {
      updateRecord(recordId, { 
        status: 'normal',
        notes: reviewNote.trim(),
      } as Partial<BaseRecord>, `复核完成: ${reviewNote.trim()}`);
      setReviewNote('');
    }
    
    setSelectedRecordId(null);
  };

  const handleResolveDifference = (recordId: string, field: string, newValue: string) => {
    const updates: Partial<BaseRecord> = {};
    if (field === '展位位置') {
      (updates as any).position = newValue;
    } else if (field === '巡检日期') {
      (updates as any).inspectionDate = newValue;
    }
    
    updateRecord(recordId, updates, `复核修正: ${field}`);
    
    setReviewItems(prev => prev.map(item => 
      item.record.id === recordId 
        ? {
            ...item,
            record: { ...item.record, ...updates },
            differences: item.differences.filter(d => d.field !== field),
          }
        : item
    ));
  };

  const handleBatchReview = () => {
    const unreviewedIds = reviewItems.filter(r => !r.reviewed).map(r => r.record.id);
    unreviewedIds.forEach(id => {
      setReviewItems(prev => prev.map(item => 
        item.record.id === id ? { ...item, reviewed: true } : item
      ));
    });
  };

  const selectedRecord = reviewItems.find(r => r.record.id === selectedRecordId);

  const canExport = stats.reviewed === stats.total && stats.withDifferences === 0;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">巡检单复核</h1>
        <p className="text-slate-500">
          对比巡检单与明细差异，完成复核后导出。导出前请确保所有差异已解决。
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="card card-hover p-4">
          <div className="text-sm text-slate-500 mb-1">总记录数</div>
          <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
        </div>
        <div className="card card-hover p-4">
          <div className="text-sm text-slate-500 mb-1">已复核</div>
          <div className="text-2xl font-bold text-green-600">{stats.reviewed}</div>
        </div>
        <div className="card card-hover p-4">
          <div className="text-sm text-slate-500 mb-1">有差异</div>
          <div className="text-2xl font-bold text-orange-600">{stats.withDifferences}</div>
        </div>
        <div className="card card-hover p-4">
          <div className="text-sm text-slate-500 mb-1">待处理</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
        </div>
        <div className="card card-hover p-4">
          <div className="text-sm text-slate-500 mb-1">复核进度</div>
          <div className="text-2xl font-bold text-primary-600">
            {stats.total > 0 ? Math.round((stats.reviewed / stats.total) * 100) : 0}%
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedTab === 'comparison'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
              onClick={() => setSelectedTab('comparison')}
            >
              <ArrowRightLeft className="w-4 h-4 inline mr-1.5" />
              明细对比
            </button>
            <button
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedTab === 'summary'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
              onClick={() => setSelectedTab('summary')}
            >
              <FileCheck className="w-4 h-4 inline mr-1.5" />
              复核摘要
            </button>
          </div>
          <div className="flex items-center space-x-3">
            <button
              className="btn btn-secondary text-sm"
              onClick={handleBatchReview}
              disabled={stats.reviewed === stats.total}
            >
              <Check className="w-4 h-4 mr-1" />
              全部标记已复核
            </button>
            <button
              className="btn btn-secondary text-sm"
              onClick={() => exportRecordsExcel(records)}
            >
              <Table className="w-4 h-4 mr-1" />
              导出Excel
            </button>
            <button
              className="btn btn-primary text-sm"
              onClick={() => exportInspectionPDF(records, currentRoute, exhibits)}
              disabled={!canExport}
              title={!canExport ? '请先完成所有复核并解决差异' : ''}
            >
              <Download className="w-4 h-4 mr-1" />
              导出巡检单PDF
            </button>
          </div>
        </div>

        {selectedTab === 'comparison' ? (
          <div className="flex h-[600px]">
            <div className="flex-1 border-r border-slate-200 overflow-y-auto scrollbar-thin">
              <div className="p-3 bg-slate-50 border-b border-slate-200 sticky top-0">
                <h4 className="font-medium text-slate-700 text-sm">展车明细</h4>
              </div>
              <div className="divide-y divide-slate-100">
                {reviewItems.map((item, index) => (
                  <div
                    key={item.record.id}
                    className={`p-4 cursor-pointer transition-colors animate-fade-in-up ${
                      selectedRecordId === item.record.id
                        ? 'bg-primary-50'
                        : 'hover:bg-slate-50'
                    } ${item.reviewed ? 'opacity-60' : ''}`}
                    style={{ '--stagger-index': index } as React.CSSProperties}
                    onClick={() => setSelectedRecordId(item.record.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          {item.reviewed && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                          <h5 className="font-medium text-slate-800">
                            {item.record.content.carModel || '未命名'}
                          </h5>
                          <StatusBadge status={item.record.status} className="text-xs" />
                        </div>
                        <div className="text-sm text-slate-500 space-y-0.5">
                          <div>
                            <span className="text-slate-400">VIN：</span>
                            <span className="font-mono">
                              {item.record.content.vin ? item.record.content.vin.slice(-8) : '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">来源：</span>
                            {sourceLabels[item.record.source]}
                          </div>
                        </div>
                        {item.differences.length > 0 && (
                          <div className="mt-2 flex items-center space-x-1 text-xs text-orange-600 bg-orange-50 rounded px-2 py-1 w-fit">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{item.differences.length} 处差异</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right text-xs text-slate-400">
                        <div>{formatDate(item.record.updatedAt)}</div>
                        <div className="mt-0.5">{item.record.modifiedBy}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-1/2 bg-slate-50 overflow-y-auto scrollbar-thin">
              {selectedRecord ? (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">
                      {selectedRecord.record.content.carModel || '未命名记录'}
                    </h3>
                    <StatusBadge status={selectedRecord.record.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white rounded-lg p-4">
                      <h4 className="text-sm font-medium text-slate-500 mb-2">明细数据</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">车型</span>
                          <span className="text-slate-800">{selectedRecord.record.content.carModel || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">VIN</span>
                          <span className="font-mono text-slate-800">{selectedRecord.record.content.vin || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">颜色</span>
                          <span className="text-slate-800">{selectedRecord.record.content.color || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">展位</span>
                          <span className="text-slate-800">{selectedRecord.record.content.position || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">来源</span>
                          <span className="text-slate-800">{sourceLabels[selectedRecord.record.source]}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4">
                      <h4 className="text-sm font-medium text-slate-500 mb-2">元数据</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">状态</span>
                          <span className="text-slate-800">{statusLabels[selectedRecord.record.status]}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">创建时间</span>
                          <span className="text-slate-800">{formatDate(selectedRecord.record.createdAt)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">修改人</span>
                          <span className="text-slate-800">{selectedRecord.record.modifiedBy}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">附件数</span>
                          <span className="text-slate-800">{selectedRecord.record.attachments.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">复核状态</span>
                          <span className={selectedRecord.reviewed ? 'text-green-600' : 'text-orange-600'}>
                            {selectedRecord.reviewed ? '已复核' : '待复核'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedRecord.differences.length > 0 && (
                    <div className="bg-white rounded-lg p-4 mb-4">
                      <h4 className="text-sm font-medium text-orange-700 mb-3 flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        检测到 {selectedRecord.differences.length} 处差异
                      </h4>
                      <div className="space-y-3">
                        {selectedRecord.differences.map((diff, index) => (
                          <div key={index} className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                            <div className="text-sm font-medium text-orange-800 mb-2">
                              {diff.field}
                            </div>
                            <div className="flex items-center space-x-3 text-sm">
                              <div className="flex-1 bg-white rounded p-2">
                                <div className="text-xs text-slate-400 mb-1">当前值</div>
                                <div className="text-slate-700">{diff.recordValue}</div>
                              </div>
                              <ArrowRightLeft className="w-4 h-4 text-orange-400 flex-shrink-0" />
                              <div className="flex-1 bg-white rounded p-2">
                                <div className="text-xs text-slate-400 mb-1">预期</div>
                                <div className="text-orange-700">{diff.inspectionValue}</div>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center space-x-2">
                              <input
                                type="text"
                                className="input text-sm flex-1"
                                placeholder="输入修正值..."
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                                    handleResolveDifference(
                                      selectedRecord.record.id,
                                      diff.field,
                                      (e.target as HTMLInputElement).value.trim()
                                    );
                                  }
                                }}
                              />
                              <button
                                className="btn btn-primary text-sm"
                                onClick={() => {
                                  const input = document.querySelector(`[placeholder="输入修正值..."]`) as HTMLInputElement;
                                  if (input?.value.trim()) {
                                    handleResolveDifference(
                                      selectedRecord.record.id,
                                      diff.field,
                                      input.value.trim()
                                    );
                                  }
                                }}
                              >
                                修正
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedRecord.record.pendingReason && (
                    <div className="bg-yellow-50 rounded-lg p-4 mb-4 border border-yellow-200">
                      <h4 className="text-sm font-medium text-yellow-800 mb-2">待处理原因</h4>
                      <p className="text-sm text-yellow-700">{selectedRecord.record.pendingReason}</p>
                    </div>
                  )}

                  {!selectedRecord.reviewed && (
                    <div className="bg-white rounded-lg p-4">
                      <h4 className="text-sm font-medium text-slate-700 mb-3">复核确认</h4>
                      <textarea
                        className="input text-sm mb-3"
                        rows={2}
                        placeholder="添加复核备注（可选）..."
                        value={reviewNote}
                        onChange={e => setReviewNote(e.target.value)}
                      />
                      <button
                        className="btn btn-primary w-full"
                        onClick={() => handleMarkReviewed(selectedRecord.record.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        标记为已复核
                      </button>
                    </div>
                  )}

                  {selectedRecord.reviewed && (
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <div className="flex items-center space-x-2 text-green-700">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">本条记录已完成复核</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                  <div className="text-center">
                    <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>选择左侧记录查看详情</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="card p-5">
                <h4 className="font-semibold text-slate-800 mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-primary-500" />
                  复核说明
                </h4>
                <ul className="space-y-3 text-sm text-slate-600">
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold mr-2">1</span>
                    <span><strong>放置模型清单样例：</strong>确保Excel包含车型、VIN、颜色、位置四列，列名支持中英文</span>
                  </li>
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold mr-2">2</span>
                    <span><strong>查看路线被挡住：</strong>进入「路线规划」页，红色区域标识冲突位置，查看具体被哪件展品挡住</span>
                  </li>
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold mr-2">3</span>
                    <span><strong>导出前复核：</strong>确保所有记录标记为已复核，差异数为0，待处理记录已处理完毕</span>
                  </li>
                </ul>
              </div>

              <div className="card p-5">
                <h4 className="font-semibold text-slate-800 mb-4 flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-primary-500" />
                  复核进度
                </h4>
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">完成度</span>
                    <span className="font-medium text-slate-800">{stats.reviewed} / {stats.total}</span>
                  </div>
                  <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-500"
                      style={{ width: `${stats.total > 0 ? (stats.reviewed / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">正常记录</span>
                    <span className="text-green-600 font-medium">{stats.normal} 条</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">待处理记录</span>
                    <span className={stats.pending > 0 ? 'text-yellow-600 font-medium' : 'text-slate-600'}>
                      {stats.pending} 条
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">存在差异</span>
                    <span className={stats.withDifferences > 0 ? 'text-orange-600 font-medium' : 'text-slate-600'}>
                      {stats.withDifferences} 条
                    </span>
                  </div>
                </div>
                {canExport && (
                  <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center text-green-700 text-sm">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      复核已完成，可以导出巡检单
                    </div>
                  </div>
                )}
                {!canExport && (
                  <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="flex items-center text-orange-700 text-sm">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      请先完成所有复核并解决差异
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="card p-5">
              <h4 className="font-semibold text-slate-800 mb-4 flex items-center">
                <User className="w-5 h-5 mr-2 text-primary-500" />
                最新修改记录
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 font-medium text-slate-500">时间</th>
                      <th className="text-left py-2 px-3 font-medium text-slate-500">车型</th>
                      <th className="text-left py-2 px-3 font-medium text-slate-500">修改内容</th>
                      <th className="text-left py-2 px-3 font-medium text-slate-500">修改人</th>
                      <th className="text-left py-2 px-3 font-medium text-slate-500">原因</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.slice(0, 5).map(record => (
                      <tr key={record.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-500">{formatDate(record.updatedAt)}</td>
                        <td className="py-2 px-3 font-medium text-slate-800">
                          {record.content.carModel || '-'}
                        </td>
                        <td className="py-2 px-3">
                          <StatusBadge status={record.status} className="text-xs" />
                        </td>
                        <td className="py-2 px-3 text-slate-600">{record.modifiedBy}</td>
                        <td className="py-2 px-3 text-slate-500 max-w-xs truncate">
                          {record.pendingReason || record.content.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
