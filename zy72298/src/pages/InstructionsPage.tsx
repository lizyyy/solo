import { useState } from 'react';
import { usePipelineStore } from '@/store/pipelineStore';
import { MATERIAL_LABELS, STATUS_LABELS } from '@/types';
import type { WorkflowStatus, PipelineRecord, Conflict } from '@/types';
import { saveAs } from 'file-saver';
import {
  FileText,
  Edit,
  Save,
  Download,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  ArrowRight,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const STATUS_TAG: Record<WorkflowStatus, string> = {
  step1: 'bg-blue-100 text-blue-800',
  step2: 'bg-yellow-100 text-yellow-800',
  step3: 'bg-purple-100 text-purple-800',
  pending_review: 'bg-orange-100 text-orange-800',
  confirmed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

function getNextStepHint(record: PipelineRecord, hasPendingConflict: boolean): { label: string; link: string; action: string } | null {
  if (record.status === 'rejected') return null;
  if (hasPendingConflict) {
    return {
      label: '照片-CAD冲突未裁决，必须人工确认',
      link: '/conflicts',
      action: '去冲突裁决',
    };
  }
  if (record.isCoordinateMixed) {
    return {
      label: '坐标混合，待巡检组复核',
      link: '/coordinates',
      action: '去坐标复核',
    };
  }
  if (record.status === 'pending_review') {
    return {
      label: '待巡检组复核',
      link: '/coordinates',
      action: '去坐标复核',
    };
  }
  if (!record.cadLayer) {
    return {
      label: 'CAD图层名尚未补录',
      link: '/cad',
      action: '去补录CAD',
    };
  }
  if (!record.siteInstruction) {
    return {
      label: '现场说明待填写',
      link: '/instructions',
      action: '填写说明',
    };
  }
  if (record.status === 'step3') {
    return {
      label: '流程已完成，可确认归档',
      link: '/instructions',
      action: '查看详情',
    };
  }
  return null;
}

export default function InstructionsPage() {
  const { records, history, conflicts, updateSiteInstruction, exportData, clearAll } = usePipelineStore();
  const visibleRecords = records.filter(
    (r) => r.status !== 'rejected'
  );
  const step3Records = visibleRecords.filter((r) => r.status === 'step3' || r.status === 'confirmed');
  const workInProgress = visibleRecords.filter(
    (r) => r.status === 'step1' || r.status === 'step2' || r.status === 'pending_review'
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [instructionInputs, setInstructionInputs] = useState<Record<string, string>>({});
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [expandedFullHistory, setExpandedFullHistory] = useState<Set<string>>(new Set());
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const getInstructionHistory = (recordId: string) => {
    return history.filter(
      (h) => h.recordId === recordId && (h.action === 'update_instruction')
    );
  };

  const getFullRecordHistory = (recordId: string) => {
    return history
      .filter((h) => h.recordId === recordId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const checkHistoryConsistency = (recordId: string, currentInstruction: string) => {
    const recordHistory = getInstructionHistory(recordId);
    if (recordHistory.length === 0) return true;
    const lastVersion = recordHistory[recordHistory.length - 1];
    const lastInstruction = lastVersion.changes.find((c) => c.field === 'siteInstruction')?.newValue;
    return lastInstruction === currentInstruction;
  };

  const handleEdit = (recordId: string, currentInstruction?: string) => {
    setEditingId(recordId);
    setInstructionInputs((prev) => ({ ...prev, [recordId]: currentInstruction || '' }));
  };

  const handleSave = (recordId: string) => {
    const instruction = instructionInputs[recordId]?.trim();
    if (!instruction) return;
    updateSiteInstruction(recordId, instruction);
    setEditingId(null);
  };

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
    saveAs(blob, `pipeline-instructions-${Date.now()}.json`);
  };

  const toggleHistory = (recordId: string) => {
    setExpandedHistory((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) next.delete(recordId); else next.add(recordId);
      return next;
    });
  };

  const toggleFullHistory = (recordId: string) => {
    setExpandedFullHistory((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) next.delete(recordId); else next.add(recordId);
      return next;
    });
  };

  const canEditInstruction = (record: PipelineRecord) => {
    if (record.status === 'rejected') return false;
    if (record.isCoordinateMixed) return false;
    if (!record.cadLayer) return false;
    if (conflicts.some((c: Conflict) => c.recordId === record.id && c.status === 'pending')) return false;
    return true;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-primary-800 flex items-center gap-2">
            <FileText />
            现场说明
          </h1>
          <p className="text-sm text-industrial-gray mt-1">
            给现场班组的作业说明 · 与历史记录一致性核对 · 同一条记录从导入到最终展示完整追踪
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="btn-outline text-sm px-3 py-1.5 text-industrial-red border-industrial-red hover:bg-red-50"
          >
            清空数据
          </button>
          <button onClick={handleExport} className="btn-outline inline-flex items-center gap-2">
            <Download className="w-4 h-4" />
            导出全部
          </button>
        </div>
      </div>

      {showResetConfirm && (
        <div className="card p-4 border-industrial-red bg-red-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-industrial-red shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-display font-medium text-industrial-red">确认清空所有数据？</p>
              <p className="text-sm text-red-700 mt-1">
                此操作将删除全部管线记录、冲突记录、历史追溯和自检报告，且无法恢复。
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { clearAll(); setShowResetConfirm(false); }}
                  className="btn-danger text-sm py-1.5 px-3"
                >
                  确认清空
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="btn-outline text-sm py-1.5 px-3"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {workInProgress.length > 0 && (
        <div className="card overflow-hidden border-industrial-orange">
          <div className="px-5 py-3 border-b border-orange-200 bg-orange-50 flex items-center justify-between">
            <h2 className="font-display font-semibold text-orange-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              正在处理中 ({workInProgress.length})
            </h2>
            <span className="text-xs text-orange-600 font-mono-data">
              尚未完成现场说明填写的记录
            </span>
          </div>
          <div className="divide-y divide-orange-100">
            {workInProgress.map((record) => {
              const recordHasConflict = conflicts.some((c: Conflict) => c.recordId === record.id && c.status === 'pending');
              const nextStep = getNextStepHint(record, recordHasConflict);
              return (
                <div key={record.id} className="px-5 py-3 flex items-center justify-between hover:bg-orange-50/50">
                  <div className="flex items-center gap-4">
                    <span className="font-mono-data text-primary-800">{record.photoNumber}</span>
                    <span className={cn(
                      'status-tag',
                      record.materialType === 'normal' && 'bg-blue-50 text-blue-700',
                      record.materialType === 'wrong_caliber' && 'bg-red-50 text-red-700',
                      record.materialType === 'supplementary' && 'bg-amber-50 text-amber-700',
                    )}>
                      {MATERIAL_LABELS[record.materialType]}
                    </span>
                    <span className={cn('status-tag', STATUS_TAG[record.status])}>
                      {STATUS_LABELS[record.status]}
                    </span>
                    {record.isCoordinateMixed && (
                      <span className="status-tag bg-red-100 text-red-700">
                        坐标混合
                      </span>
                    )}
                    {nextStep && (
                      <span className="text-xs text-orange-700 font-display">
                        {nextStep.label}
                      </span>
                    )}
                  </div>
                  {nextStep && (
                    <Link
                      to={nextStep.link}
                      className="text-sm text-primary-700 hover:text-primary-900 inline-flex items-center gap-1"
                    >
                      {nextStep.action}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {step3Records.length === 0 && visibleRecords.length === 0 && (
        <div className="card text-center py-16 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无记录</p>
          <p className="text-sm mt-1">
            请先在
            <Link to="/import" className="text-primary-600 mx-1 underline">
              数据导入
            </Link>
            页录入巡检照片编号，走完三步工作流
          </p>
          <div className="mt-6 inline-flex items-center gap-2 text-xs text-industrial-gray">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">Step1 导入照片编号</span>
            <ArrowRight className="w-4 h-4" />
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">Step2 补录CAD图层名</span>
            <ArrowRight className="w-4 h-4" />
            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">Step3 更新现场说明</span>
          </div>
        </div>
      )}

      {step3Records.length > 0 && (
        <div>
          <h2 className="font-display font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-industrial-green" />
            已完成现场说明的记录 ({step3Records.length})
          </h2>
          <div className="space-y-4">
            {step3Records.map((record) => {
              const instructionHistory = getInstructionHistory(record.id);
              const fullHistory = getFullRecordHistory(record.id);
              const isConsistent = record.siteInstruction
                ? checkHistoryConsistency(record.id, record.siteInstruction)
                : true;
              const isExpanded = expandedHistory.has(record.id);
              const isFullExpanded = expandedFullHistory.has(record.id);
              const editable = canEditInstruction(record);

              return (
                <div key={record.id} className="card overflow-hidden animate-slide-in">
                  <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono-data text-lg text-primary-800">
                        {record.photoNumber}
                      </span>
                      <span className={cn(
                        'status-tag',
                        record.materialType === 'normal' && 'bg-blue-50 text-blue-700',
                        record.materialType === 'wrong_caliber' && 'bg-red-50 text-red-700',
                        record.materialType === 'supplementary' && 'bg-amber-50 text-amber-700',
                      )}>
                        {MATERIAL_LABELS[record.materialType]}
                      </span>
                      {record.cadLayer && (
                        <span className="text-xs text-gray-500 font-mono-data bg-gray-100 px-2 py-1 rounded">
                          CAD: {record.cadLayer}
                        </span>
                      )}
                      {record.coordinate.type && (
                        <span className="text-xs text-gray-500 font-mono-data bg-gray-100 px-2 py-1 rounded">
                          {record.coordinate.type === 'latlng'
                            ? `经纬度: ${record.coordinate.lat?.toFixed(5)}, ${record.coordinate.lng?.toFixed(5)}`
                            : `米制: X${record.coordinate.metricX?.toFixed(2)}, Y${record.coordinate.metricY?.toFixed(2)}`}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {record.siteInstruction ? (
                        isConsistent ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">
                            <CheckCircle className="w-3.5 h-3.5" />
                            与历史记录一致
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded">
                            <AlertCircle className="w-3.5 h-3.5" />
                            与历史记录不一致
                          </span>
                        )
                      ) : null}
                      {record.isCoordinateMixed && (
                        <span className="inline-flex items-center gap-1 text-xs text-orange-700 bg-orange-50 border border-orange-200 px-2 py-1 rounded">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          坐标混合未处理
                        </span>
                      )}
                      <span className={cn(
                        'status-tag',
                        STATUS_TAG[record.status]
                      )}>
                        {STATUS_LABELS[record.status]}
                      </span>
                      <span className="text-xs text-gray-400 font-mono-data">
                        更新: {new Date(record.updatedAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    {editingId === record.id ? (
                      <div className="space-y-3">
                        <textarea
                          className="input-field w-full min-h-[100px] text-sm"
                          placeholder="请输入给现场班组的作业说明...&#10;&#10;例如：&#10;管线位置：主机舱第3排右舷第2根 &#10;口径要求：DN80 &#10;注意事项：避开水管走线，按图纸LAYER-A3标注安装"
                          value={instructionInputs[record.id] || ''}
                          onChange={(e) => setInstructionInputs((prev) => ({
                            ...prev,
                            [record.id]: e.target.value,
                          }))}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSave(record.id)}
                            className="btn-success inline-flex items-center gap-1.5 text-sm"
                          >
                            <Save className="w-4 h-4" />
                            保存说明
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="btn-outline text-sm"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="text-xs text-gray-500 font-display mb-1">
                              现场班组作业说明
                            </div>
                            {record.siteInstruction ? (
                              <div className="text-sm text-gray-800 leading-relaxed bg-gray-50 p-4 rounded border border-gray-200 whitespace-pre-wrap">
                                {record.siteInstruction}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400 bg-gray-50 p-4 rounded border border-dashed border-gray-300">
                                尚未填写作业说明
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => editable && handleEdit(record.id, record.siteInstruction)}
                            disabled={!editable}
                            className={cn(
                              'text-sm shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5',
                              editable
                                ? 'btn-outline'
                                : 'opacity-50 cursor-not-allowed border border-gray-200 text-gray-400'
                            )}
                          >
                            <Edit className="w-4 h-4" />
                            {record.siteInstruction ? '编辑' : '填写'}
                          </button>
                        </div>

                        {!editable && (record.isCoordinateMixed || record.status === 'pending_review') && !conflicts.some((c: Conflict) => c.recordId === record.id && c.status === 'pending') && (
                          <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 p-3 rounded flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div>
                              说明编辑已锁定：该记录存在
                              <strong>坐标混合</strong>
                              待巡检组复核完成后才能继续操作。
                              下一步操作：前往
                              <Link to="/coordinates" className="underline mx-1">
                                坐标复核
                              </Link>
                              页
                            </div>
                          </div>
                        )}

                        {!editable && conflicts.some((c: Conflict) => c.recordId === record.id && c.status === 'pending') && (
                          <div className="text-xs text-red-600 bg-red-50 border border-red-200 p-3 rounded flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div>
                              说明编辑已锁定：该记录存在
                              <strong>未裁决的照片-CAD冲突</strong>
                              ，必须由老梁在
                              <Link to="/conflicts" className="underline mx-1">
                                冲突处理
                              </Link>
                              页确认或驳回后才能继续填写现场说明。未裁决前不能生成给现场班组的说明。
                            </div>
                          </div>
                        )}

                        {!editable && !record.cadLayer && (
                          <div className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 p-3 rounded flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div>
                              说明编辑已锁定：该记录尚未补录CAD图层名。
                              下一步操作：前往
                              <Link to="/cad" className="underline mx-1">
                                CAD补录
                              </Link>
                              页
                            </div>
                          </div>
                        )}

                        {record.resolutionNote && (
                          <div className="text-xs bg-amber-50 border border-amber-200 p-3 rounded">
                            <div className="text-amber-700 font-display font-medium mb-1">
                              历史冲突处理备注：
                            </div>
                            <p className="text-amber-800">{record.resolutionNote}</p>
                          </div>
                        )}

                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => toggleHistory(record.id)}
                            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            说明历史版本 ({instructionHistory.length})
                          </button>
                          <button
                            onClick={() => toggleFullHistory(record.id)}
                            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 transition-colors"
                          >
                            {isFullExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            <Eye className="w-3.5 h-3.5" />
                            完整操作追踪 ({fullHistory.length})
                          </button>
                        </div>

                        {isExpanded && instructionHistory.length > 0 && (
                          <div className="border-t border-gray-100 pt-3 space-y-2">
                            <div className="text-xs text-gray-500 font-display mb-2">说明变更历史：</div>
                            {instructionHistory.map((h, idx) => {
                              const instruction = h.changes.find((c) => c.field === 'siteInstruction')?.newValue as string;
                              return (
                                <div key={idx} className="bg-gray-50 p-3 rounded border border-gray-200">
                                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2 font-mono-data">
                                    <div className="flex items-center gap-1.5">
                                      <User className="w-3 h-3" />
                                      {h.operator}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <Clock className="w-3 h-3" />
                                      {new Date(h.timestamp).toLocaleString('zh-CN')}
                                    </div>
                                  </div>
                                  <div className="text-sm text-gray-700 whitespace-pre-wrap">{instruction}</div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {isFullExpanded && fullHistory.length > 0 && (
                          <div className="border-t border-gray-100 pt-3 space-y-2">
                            <div className="text-xs text-gray-500 font-display mb-2">
                              完整操作追踪（从第一次导入到最新）：
                            </div>
                            <div className="relative pl-6">
                              <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200" />
                              {fullHistory.map((h, idx) => (
                                <div key={idx} className="relative mb-4 last:mb-0">
                                  <div className="absolute -left-[18px] top-1 w-3 h-3 rounded-full bg-primary-400 border-2 border-white shadow-sm" />
                                  <div className="bg-gray-50 p-3 rounded border border-gray-200">
                                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1 font-mono-data">
                                      <div className="flex items-center gap-1.5">
                                        <User className="w-3 h-3" />
                                        {h.operator}
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <Clock className="w-3 h-3" />
                                        {new Date(h.timestamp).toLocaleString('zh-CN')}
                                      </div>
                                    </div>
                                    <div className="text-sm text-gray-800 space-y-1">
                                      {h.changes.map((c, i) => (
                                        <div key={i} className="flex items-start gap-2 text-xs">
                                          <span className="text-industrial-gray font-display shrink-0 w-24">
                                            {c.field}:
                                          </span>
                                          <span className="flex items-center gap-2 flex-wrap">
                                            {String(c.oldValue ?? '空')}
                                            <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
                                            <span className="text-primary-700 font-medium">{String(c.newValue ?? '空')}</span>
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                    {h.evidence && (
                                      <div className="mt-2 text-xs text-orange-700 bg-orange-50 p-2 rounded border border-orange-200">
                                        <span className="font-medium">证据:</span> {h.evidence}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
