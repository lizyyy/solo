import { useState, useEffect } from 'react';
import { X, Clock, FileText, User, Upload, CheckCircle, GitBranch, AlertTriangle, Shield, ArrowRight, FileCheck, GitMerge, ListChecks } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';
import StatusBadge from './StatusBadge';
import type { BillRecord, TeacherNote, SamplingList, OperationHistory, GapRecord, ConflictRecord, OperationType, RecordStatus } from '../../shared/types';

interface EvidenceDrawerProps {
  open: boolean;
  onClose: () => void;
  record?: BillRecord | null;
}

interface ParsedState {
  status?: RecordStatus;
  nextHandler?: string;
  reason?: string;
  resolution?: string;
  resolutionNote?: string;
  missingRecordNo?: string;
}

const operationIcons: Record<OperationType, typeof Upload> = {
  import: Upload,
  match: GitBranch,
  conflict_resolve: GitMerge,
  gap_review: FileCheck,
  version_create: GitBranch,
};

const operationLabels: Record<OperationType, string> = {
  import: '数据导入',
  match: '匹配识别',
  conflict_resolve: '冲突处理',
  gap_review: '断档复核',
  version_create: '参数版本生成',
};

const roleLabels: Record<string, string> = {
  admin: '系统管理员',
  coach: '唐老师',
  reviewer: '教研组',
};

function parseStateJson(state?: Record<string, any> | string): ParsedState {
  if (!state) return {};
  if (typeof state === 'object') {
    return state as ParsedState;
  }
  try {
    return JSON.parse(state) as ParsedState;
  } catch {
    return {};
  }
}

function getNextHandlerLabel(handler?: string): string {
  if (!handler) return '';
  if (handler === 'coach') return '唐老师';
  if (handler === 'reviewer') return '教研组';
  if (handler === 'admin') return '系统管理员';
  if (handler === 'archive' || handler === '归档') return '归档';
  return handler;
}

function getStatusDisplay(status: RecordStatus, gap?: GapRecord): { label: string; warning?: boolean } {
  if (gap && gap.reviewStatus === 'pending') {
    return { label: '⚠️ 编号断档 待教研组复核', warning: true };
  }
  const config: Record<RecordStatus, string> = {
    smooth: '✓ 顺利记录 - 正常',
    gap: '⚠️ 编号断档 - 待复核',
    supplement: '＋ 旧口径补录记录',
    conflict: '✗ 数据冲突 - 待处理',
    pending: '⏳ 待处理',
    approved: '✓ 已通过',
    rejected: '✗ 已拒绝',
    reviewed_normal: '✓ 复核正常',
    reviewed_abnormal: '✗ 复核异常',
  };
  return { label: config[status] || status };
}

export default function EvidenceDrawer({
  open,
  onClose,
  record,
}: EvidenceDrawerProps) {
  const { selectedRecord: storeSelectedRecord } = useAppStore();
  const displayRecord = record || storeSelectedRecord;

  const {
    getGapByRecordId,
    getConflictByRecordId,
    getHistoryByRecordId,
  } = useDataStore();

  const [gapRecord, setGapRecord] = useState<GapRecord | undefined>(undefined);
  const [conflictRecord, setConflictRecord] = useState<ConflictRecord | undefined>(undefined);
  const [recordHistory, setRecordHistory] = useState<OperationHistory[]>([]);
  const [teacherNote, setTeacherNote] = useState<TeacherNote | null>(null);
  const [samplingList, setSamplingList] = useState<SamplingList | null>(null);

  useEffect(() => {
    if (displayRecord) {
      const gap = getGapByRecordId(displayRecord.id);
      const conflict = getConflictByRecordId(displayRecord.id);
      const history = getHistoryByRecordId(displayRecord.id);

      setGapRecord(gap);
      setConflictRecord(conflict);
      setRecordHistory(history);

      setTeacherNote({
        id: displayRecord.teacherNoteId || 'TN-' + displayRecord.id,
        recordNo: displayRecord.recordNo,
        date: displayRecord.date,
        teacherName: displayRecord.teacherName,
        amount: displayRecord.amount,
        itemType: displayRecord.itemType,
        annotation: '老师批注完整内容：正常授课记录，学生出勤良好，教学内容完成度高，家长反馈积极。',
        importBatchId: 'BATCH-TEACHER-001',
        importedAt: displayRecord.createdAt,
        importedBy: '系统管理员',
      });

      const samplingAmount = conflict?.conflictingFields.find((f) => f.field === 'amount')?.samplingListValue as number;
      setSamplingList({
        id: displayRecord.samplingListId || 'SL-' + displayRecord.id,
        recordNo: displayRecord.recordNo,
        date: displayRecord.date,
        teacherName: displayRecord.teacherName,
        amount: samplingAmount ?? displayRecord.amount,
        itemType: displayRecord.itemType,
        sceneDescription: '抽样现场描述：实际到场核实，学生签字确认，教学内容与记录一致。',
        isOldFormat: displayRecord.status === 'supplement',
        importBatchId: 'BATCH-SAMPLING-001',
        importedAt: displayRecord.createdAt,
        importedBy: '系统管理员',
      });
    }
  }, [displayRecord, getGapByRecordId, getConflictByRecordId, getHistoryByRecordId]);

  const statusDisplay = displayRecord
    ? getStatusDisplay(displayRecord.status, gapRecord)
    : { label: '' };

  const isGap = displayRecord?.status === 'gap' || !!gapRecord;
  const isConflict = displayRecord?.status === 'conflict' || !!conflictRecord;
  const isSupplement = displayRecord?.status === 'supplement';
  const isSmooth = displayRecord?.status === 'smooth';
  const isReviewed = displayRecord?.status === 'reviewed_normal' || displayRecord?.status === 'reviewed_abnormal' || displayRecord?.status === 'approved' || displayRecord?.status === 'rejected';

  const latestHistory = recordHistory.length > 0 ? recordHistory[recordHistory.length - 1] : null;
  const latestParsed = parseStateJson(latestHistory?.afterState);

  let nextHandlerText = '归档';
  if (isGap && gapRecord?.reviewStatus === 'pending') {
    nextHandlerText = '教研组 → 复核后唐老师确认';
  } else if (isGap && gapRecord?.reviewStatus !== 'pending') {
    nextHandlerText = '唐老师确认 / 归档';
  } else if (isConflict && !conflictRecord?.resolution) {
    nextHandlerText = '唐老师 → 确认处理方式';
  } else if (isConflict && conflictRecord?.resolution) {
    nextHandlerText = '归档';
  } else if (isSupplement) {
    nextHandlerText = '唐老师审阅';
  } else if (latestParsed.nextHandler) {
    nextHandlerText = getNextHandlerLabel(latestParsed.nextHandler);
  }

  const reasonText = latestParsed.reason ||
    (isGap ? '编号序列跳号，需教研组核实缺失编号是否真的不存在' :
     isConflict ? '字段数据不一致，需人工确认采用哪一份数据' :
     '') ;

  const renderOriginalStatement = () => {
    if (isGap && gapRecord) {
      return (
        <div className="space-y-3">
          {teacherNote && (
            <div className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">·</span>
              <div className="flex-1">
                <span className="text-xs font-semibold text-blue-700">老师批注：</span>
                <span className="text-sm text-gray-700">编号 {displayRecord?.recordNo} {teacherNote.annotation}</span>
              </div>
            </div>
          )}
          {samplingList && (
            <div className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">·</span>
              <div className="flex-1">
                <span className="text-xs font-semibold text-green-700">抽样名单：</span>
                <span className="text-sm text-gray-700">{samplingList.sceneDescription}</span>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="text-xs font-semibold text-red-700">编号序列：</span>
              <span className="text-sm text-red-800 font-medium">
                {gapRecord.previousRecordNo} → [缺失 {gapRecord.missingRecordNo}] → {gapRecord.nextRecordNo}
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (isConflict && conflictRecord) {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-1.5 mb-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-blue-800">老师批注</span>
              </div>
              <div className="space-y-1.5">
                {conflictRecord.conflictingFields.map((f) => (
                  <div key={f.field} className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">{f.field}:</span>
                    <span className="text-red-700 font-mono font-medium bg-red-100 px-1.5 py-0.5 rounded">
                      {String(f.teacherNoteValue)}
                    </span>
                  </div>
                ))}
              </div>
              {teacherNote && (
                <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-blue-100">
                  {teacherNote.annotation}
                </p>
              )}
            </div>
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-1.5 mb-2 justify-end">
                <span className="text-xs font-semibold text-green-800">抽样名单</span>
                <ListChecks className="w-4 h-4 text-green-600" />
              </div>
              <div className="space-y-1.5">
                {conflictRecord.conflictingFields.map((f) => (
                  <div key={f.field} className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">{f.field}:</span>
                    <span className="text-red-700 font-mono font-medium bg-red-100 px-1.5 py-0.5 rounded">
                      {String(f.samplingListValue)}
                    </span>
                  </div>
                ))}
              </div>
              {samplingList && (
                <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-green-100 text-right">
                  {samplingList.sceneDescription}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (isSupplement) {
      return (
        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
          <p className="text-sm text-purple-800">
            <span className="font-semibold">原始说法：</span>旧口径补录，仅抽样名单存在，老师批注中无此记录
          </p>
          {samplingList && (
            <p className="text-xs text-gray-600 mt-2">
              <span className="font-semibold text-purple-700">抽样现场：</span>{samplingList.sceneDescription}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {teacherNote && (
          <div className="flex items-start gap-2">
            <span className="text-gray-400 mt-1">·</span>
            <div className="flex-1">
              <span className="text-xs font-semibold text-blue-700">老师批注：</span>
              <span className="text-sm text-gray-700">{teacherNote.annotation}</span>
            </div>
          </div>
        )}
        {samplingList && (
          <div className="flex items-start gap-2">
            <span className="text-gray-400 mt-1">·</span>
            <div className="flex-1">
              <span className="text-xs font-semibold text-green-700">抽样名单：</span>
              <span className="text-sm text-gray-700">{samplingList.sceneDescription}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCurrentStatus = () => {
    if (isGap && gapRecord) {
      if (gapRecord.reviewStatus === 'pending') {
        return (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">·</span>
              <div>
                <span className="text-xs font-semibold text-gray-700">状态：</span>
                <span className="text-sm font-medium text-orange-700">
                  编号断档待复核 → 不自动归正常
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">·</span>
              <div>
                <span className="text-xs font-semibold text-gray-700">缺失编号：</span>
                <span className="text-sm font-mono font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                  {gapRecord.missingRecordNo}
                </span>
                <span className="text-xs text-gray-500 ml-1">（疑似人工删除一行）</span>
              </div>
            </div>
          </div>
        );
      } else {
        return (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">·</span>
              <div>
                <span className="text-xs font-semibold text-gray-700">改后状态：</span>
                <span className={cn(
                  'text-sm font-medium',
                  gapRecord.reviewStatus === 'normal' ? 'text-green-700' : 'text-red-700'
                )}>
                  已复核{gapRecord.reviewStatus === 'normal' ? '正常' : '异常'}
                </span>
              </div>
            </div>
            {gapRecord.reviewNote && (
              <div className="flex items-start gap-2">
                <span className="text-gray-400 mt-1">·</span>
                <div>
                  <span className="text-xs font-semibold text-gray-700">复核意见：</span>
                  <span className="text-sm text-gray-700">{gapRecord.reviewNote}</span>
                </div>
              </div>
            )}
            {gapRecord.reviewedBy && (
              <div className="flex items-start gap-2">
                <span className="text-gray-400 mt-1">·</span>
                <div>
                  <span className="text-xs font-semibold text-gray-700">复核人：</span>
                  <span className="text-sm text-gray-600">
                    {gapRecord.reviewedBy} · {gapRecord.reviewedAt}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      }
    }

    if (isConflict && conflictRecord) {
      if (conflictRecord.resolution) {
        const resolutionText = {
          teacher_note: '采纳老师批注数据',
          sampling_list: '采纳抽样名单数据',
          rejected: '标记为异常数据',
        };
        return (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">·</span>
              <div>
                <span className="text-xs font-semibold text-gray-700">改后值：</span>
                <span className="text-sm font-medium text-green-700">
                  {resolutionText[conflictRecord.resolution]}
                </span>
              </div>
            </div>
            {conflictRecord.resolutionNote && (
              <div className="flex items-start gap-2">
                <span className="text-gray-400 mt-1">·</span>
                <div>
                  <span className="text-xs font-semibold text-gray-700">处理说明：</span>
                  <span className="text-sm text-gray-700">{conflictRecord.resolutionNote}</span>
                </div>
              </div>
            )}
            {conflictRecord.resolvedBy && (
              <div className="flex items-start gap-2">
                <span className="text-gray-400 mt-1">·</span>
                <div>
                  <span className="text-xs font-semibold text-gray-700">处理人：</span>
                  <span className="text-sm text-gray-600">
                    {conflictRecord.resolvedBy} · {conflictRecord.resolvedAt}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      } else {
        return (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">·</span>
              <div>
                <span className="text-xs font-semibold text-gray-700">当前状态：</span>
                <span className="text-sm font-medium text-red-600">待唐老师确认处理方式</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">·</span>
              <div>
                <span className="text-xs font-semibold text-gray-700">冲突字段：</span>
                <span className="text-sm text-gray-700">
                  {conflictRecord.conflictingFields.map((f) => f.field).join('、')}
                </span>
              </div>
            </div>
          </div>
        );
      }
    }

    if (isSupplement) {
      return (
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-gray-400 mt-1">·</span>
            <div>
              <span className="text-xs font-semibold text-gray-700">状态：</span>
              <span className="text-sm font-medium text-purple-700">旧口径补录记录</span>
            </div>
          </div>
          {samplingList?.isOldFormat && (
            <div className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">·</span>
              <div>
                <span className="text-xs font-semibold text-gray-700">格式：</span>
                <span className="text-sm text-amber-600">旧格式数据</span>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-gray-400 mt-1">·</span>
          <div>
            <span className="text-xs font-semibold text-gray-700">状态：</span>
            <span className="text-sm font-medium text-green-700">
              {isReviewed ? getStatusDisplay(displayRecord!.status).label : '顺利记录 正常'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-40 transition-opacity',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50',
          'transform transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-800 to-slate-700">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-400" />
                证据链详情 - {displayRecord?.recordNo} {displayRecord?.teacherName}
                {displayRecord && <span className="text-blue-300 font-mono">¥{displayRecord.amount.toFixed(2)}</span>}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-600 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-300" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {displayRecord ? (
              <div className="p-6 space-y-5">
                <div className={cn(
                  'rounded-xl p-4 border',
                  statusDisplay.warning
                    ? 'bg-orange-50 border-orange-300'
                    : isSmooth ? 'bg-green-50 border-green-200'
                    : isConflict ? 'bg-red-50 border-red-200'
                    : isSupplement ? 'bg-purple-50 border-purple-200'
                    : isReviewed ? 'bg-blue-50 border-blue-200'
                    : 'bg-gray-50 border-gray-200'
                )}>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    当前状态
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <StatusBadge status={displayRecord.status} />
                    <span className={cn(
                      'text-sm font-medium',
                      statusDisplay.warning ? 'text-orange-800' : 'text-gray-800'
                    )}>
                      {statusDisplay.label}
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                      原始说法
                    </h3>
                  </div>
                  <div className="p-4">
                    {renderOriginalStatement()}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-gray-500" />
                      改后值 / 当前状态
                    </h3>
                  </div>
                  <div className="p-4">
                    {renderCurrentStatus()}
                  </div>
                </div>

                {reasonText && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-amber-100 border-b border-amber-200">
                      <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        处理原因
                      </h3>
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-amber-900">{reasonText}</p>
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-blue-100 border-b border-blue-200">
                    <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      下一步找谁
                    </h3>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">
                        下一步：{nextHandlerText}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {teacherNote && (
                    <div className="border border-blue-200 rounded-xl overflow-hidden">
                      <div className="bg-blue-50 px-4 py-2 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">原始老师批注</span>
                      </div>
                      <div className="p-4 space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-gray-500 text-xs">编号：</span>
                            <span className="font-mono text-gray-800">{teacherNote.recordNo}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">日期：</span>
                            <span className="font-mono text-gray-800">{teacherNote.date}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">姓名：</span>
                            <span className="text-gray-800">{teacherNote.teacherName}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">金额：</span>
                            <span className="font-mono text-gray-800">¥{teacherNote.amount.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-blue-100">
                          <div className="text-gray-500 text-xs mb-1">完整 annotation：</div>
                          <div className="text-gray-800 text-xs leading-relaxed bg-white p-2 rounded border border-blue-100">
                            {teacherNote.annotation}
                          </div>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-blue-100 text-xs text-gray-500">
                          <span>importedBy: <span className="text-gray-700">{teacherNote.importedBy}</span></span>
                          <span className="font-mono">{teacherNote.importedAt}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {samplingList && (
                    <div className="border border-green-200 rounded-xl overflow-hidden">
                      <div className="bg-green-50 px-4 py-2 flex items-center gap-2 justify-end">
                        <span className="text-sm font-medium text-green-800">原始抽样名单</span>
                        <ListChecks className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="p-4 space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-gray-500 text-xs">编号：</span>
                            <span className="font-mono text-gray-800">{samplingList.recordNo}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">日期：</span>
                            <span className="font-mono text-gray-800">{samplingList.date}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">姓名：</span>
                            <span className="text-gray-800">{samplingList.teacherName}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">金额：</span>
                            <span className={cn(
                              'font-mono',
                              samplingList.isOldFormat ? 'text-amber-600' : 'text-gray-800'
                            )}>¥{samplingList.amount.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-green-100">
                          <div className="text-gray-500 text-xs mb-1">完整 sceneDescription：</div>
                          <div className="text-gray-800 text-xs leading-relaxed bg-white p-2 rounded border border-green-100">
                            {samplingList.sceneDescription}
                          </div>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-green-100 text-xs text-gray-500">
                          <span>
                            isOldFormat:{' '}
                            <span className={cn(
                              'font-medium',
                              samplingList.isOldFormat ? 'text-amber-600' : 'text-green-600'
                            )}>
                              {samplingList.isOldFormat ? '是 (旧格式)' : '否'}
                            </span>
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>importedBy: <span className="text-gray-700">{samplingList.importedBy}</span></span>
                          <span className="font-mono">{samplingList.importedAt}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      完整操作历史（时间线）
                    </h3>
                  </div>
                  <div className="p-4">
                    {recordHistory.length === 0 ? (
                      <div className="text-center text-gray-400 text-sm py-6">
                        暂无操作历史记录
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-200" />
                        <div className="space-y-5">
                          {recordHistory.map((event, index) => {
                            const EventIcon = operationIcons[event.operationType] || Clock;
                            const isLatest = index === recordHistory.length - 1;
                            const eventParsed = parseStateJson(event.afterState);
                            return (
                              <div key={event.id} className="relative flex gap-4">
                                <div
                                  className={cn(
                                    'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10',
                                    isLatest
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-gray-200 text-gray-600'
                                  )}
                                >
                                  <EventIcon className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-gray-800 text-sm">
                                      {index + 1}. {operationLabels[event.operationType] || event.operationType}
                                    </span>
                                    {isLatest && (
                                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium rounded">
                                        最新
                                      </span>
                                    )}
                                    <span className="text-xs text-gray-400 font-mono">
                                      {event.createdAt}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                    <User className="w-3.5 h-3.5" />
                                    <span>{event.operator}</span>
                                    <span className="text-gray-400">
                                      ({roleLabels[event.operatorRole] || event.operatorRole})
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                    {event.description}
                                  </p>
                                  {eventParsed.reason && (
                                    <p className="mt-1 text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-100">
                                      <span className="font-semibold">原因：</span>{eventParsed.reason}
                                    </p>
                                  )}
                                  {eventParsed.nextHandler && (
                                    <p className="mt-1 text-xs text-blue-700 bg-blue-50 p-2 rounded border border-blue-100">
                                      <span className="font-semibold">下一步：</span>
                                      {getNextHandlerLabel(eventParsed.nextHandler)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <Shield className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                  <p>请选择一条记录查看详情</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
