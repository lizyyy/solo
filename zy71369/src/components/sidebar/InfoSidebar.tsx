import { useState, useMemo } from 'react';
import type { Bubble, BubbleVersion, RevisionLog, Issue } from '../../types';
import { STATUS_LABELS, STATUS_COLORS } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { IssueTag } from '../common/IssueTag';
import { formatDateTime, estimateCapacity, getPositionString } from '../../utils/helpers';
import { useHistoryStore } from '../../store/historyStore';
import {
  Clock,
  User,
  FileText,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  ArrowLeftRight,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface InfoSidebarProps {
  selectedBubbleId: string | null;
  bubble: Bubble | undefined;
  currentVersion: BubbleVersion | undefined;
  allVersions: BubbleVersion[];
  issues: Issue[];
  onClose: () => void;
  onSetCurrentVersion: (versionId: string) => void;
  onUpdateRemark: (remark: string) => void;
}

interface VersionCardProps {
  version: BubbleVersion;
  isCurrent: boolean;
  onSetCurrent: () => void;
  revisions: RevisionLog[];
  compareWith?: BubbleVersion;
}

function VersionCard({ version, isCurrent, onSetCurrent, revisions, compareWith }: VersionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const compare = useHistoryStore.getState().compareVersions;

  const diffs = compareWith ? compare(version, compareWith) : [];

  const fieldLabels: Record<string, string> = {
    text: '台词',
    x: 'X坐标',
    y: 'Y坐标',
    width: '宽度',
    height: '高度',
    status: '状态',
    remark: '备注',
  };

  return (
    <div
      className={`rounded border ${
        isCurrent
          ? 'border-blue-400 bg-blue-50'
          : version.status === 'HISTORY'
          ? 'border-stone-300 bg-stone-50 opacity-70'
          : 'border-stone-300 bg-white'
      } p-3`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-stone-800 text-xs font-bold text-white">
            v{version.version}
          </span>
          {isCurrent && (
            <span className="rounded bg-blue-600 px-1.5 py-0.5 text-xs text-white">当前</span>
          )}
          <StatusBadge status={version.status} size="sm" />
        </div>
        <div className="flex items-center gap-1">
          {!isCurrent && (
            <button
              onClick={onSetCurrent}
              className="rounded border border-blue-300 bg-white px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50"
            >
              设为当前
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-stone-400 hover:text-stone-600"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      <div className="mt-2 space-y-1 text-xs text-stone-600">
        <div className="flex items-center gap-1">
          <User size={12} />
          <span>{version.operator}</span>
          <span className="text-stone-400">·</span>
          <Clock size={12} />
          <span>{formatDateTime(version.createdAt)}</span>
        </div>

        {expanded && (
          <div className="mt-2 space-y-2 border-t border-stone-200 pt-2">
            <div>
              <div className="mb-1 flex items-center gap-1 text-stone-500">
                <FileText size={10} />
                <span>台词内容</span>
              </div>
              <p className="rounded bg-white p-2 text-sm text-stone-800">{version.text || '(空)'}</p>
            </div>

            <div>
              <div className="mb-1 flex items-center gap-1 text-stone-500">
                <MapPin size={10} />
                <span>位置尺寸</span>
              </div>
              <p className="font-mono text-xs">
                {getPositionString(version.x, version.y, version.width, version.height)}
              </p>
              <p className="text-stone-500">
                容量: {estimateCapacity(version.width, version.height)} 字
              </p>
            </div>

            {version.remark && (
              <div>
                <div className="mb-1 text-stone-500">备注</div>
                <p className="rounded bg-white p-2 text-xs text-stone-700">{version.remark}</p>
              </div>
            )}

            {diffs.length > 0 && (
              <div>
                <div className="mb-1 flex items-center gap-1 text-stone-500">
                  <ArrowLeftRight size={10} />
                  <span>与当前版本差异</span>
                </div>
                <div className="space-y-1">
                  {diffs.map((diff, idx) => (
                    <div key={idx} className="rounded bg-white p-1.5 text-xs">
                      <span className="text-stone-500">{fieldLabels[diff.field] || diff.field}: </span>
                      <span className="line-through text-red-500">{diff.oldValue}</span>
                      <span className="mx-1 text-stone-400">→</span>
                      <span className="text-emerald-600">{diff.newValue}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {revisions.length > 0 && (
              <div>
                <div className="mb-1 text-stone-500">修订记录</div>
                <div className="space-y-1">
                  {revisions.slice(0, 5).map((rev) => (
                    <div key={rev.id} className="rounded bg-white p-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500">
                          {fieldLabels[rev.fieldName] || rev.fieldName}
                        </span>
                        <span className="text-stone-400">{rev.operator}</span>
                      </div>
                      <div className="mt-0.5">
                        <span className="line-through text-red-500">{rev.oldValue}</span>
                        <span className="mx-1">→</span>
                        <span className="text-emerald-600">{rev.newValue}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-stone-400">
                        {formatDateTime(rev.operatedAt)}
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
}

export function InfoSidebar({
  selectedBubbleId,
  bubble,
  currentVersion,
  allVersions,
  issues,
  onClose,
  onSetCurrentVersion,
  onUpdateRemark,
}: InfoSidebarProps) {
  const [remark, setRemark] = useState(currentVersion?.remark || '');
  const getVersionRevisions = useHistoryStore((state) => state.getVersionRevisions);

  const openIssues = useMemo(() => issues.filter(i => i.status === 'OPEN'), [issues]);
  const resolvedIssues = useMemo(() => issues.filter(i => i.status === 'RESOLVED'), [issues]);

  if (!selectedBubbleId || !bubble || !currentVersion) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-stone-500">
        <div>
          <FileText size={32} className="mx-auto mb-2 text-stone-300" />
          <p>选择一个气泡查看详情</p>
          <p className="mt-1 text-xs text-stone-400">点击画布或表格中的气泡</p>
        </div>
      </div>
    );
  }

  const capacity = estimateCapacity(currentVersion.width, currentVersion.height);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-stone-800 text-xs font-bold text-white">
            {bubble.sequenceNumber}
          </span>
          <span className="font-semibold text-stone-800">气泡详情</span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-600"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <StatusBadge status={bubble.status} size="md" />
            {bubble.hasConflict && (
              <span className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                ⚠ 存在 {bubble.latestVersion} 个版本冲突
              </span>
            )}
          </div>

          {openIssues.length > 0 && (
            <div className="rounded border border-red-200 bg-red-50 p-3">
              <div className="mb-2 flex items-center gap-1 text-sm font-medium text-red-700">
                <AlertTriangle size={14} />
                检测到 {openIssues.length} 个问题
              </div>
              <div className="space-y-1">
                {openIssues.map((issue) => (
                  <div key={issue.id} className="rounded bg-white p-2 text-xs">
                    <div className="flex items-center gap-1">
                      <IssueTag type={issue.type} />
                    </div>
                    <p className="mt-1 text-stone-600">{issue.description}</p>
                    <p className="mt-1 text-[10px] text-stone-400">
                      检测时间: {formatDateTime(issue.detectedAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resolvedIssues.length > 0 && (
            <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
              <div className="mb-2 flex items-center gap-1 text-sm font-medium text-emerald-700">
                <CheckCircle2 size={14} />
                已解决 {resolvedIssues.length} 个问题
              </div>
              <div className="space-y-1">
                {resolvedIssues.map((issue) => (
                  <div key={issue.id} className="rounded bg-white p-2 text-xs text-stone-500">
                    <IssueTag type={issue.type} />
                    <span className="ml-2 line-through">{issue.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">当前台词</label>
              <textarea
                value={currentVersion.text}
                readOnly
                className="w-full resize-none rounded border border-stone-300 bg-white p-2 text-sm text-stone-700"
                rows={3}
              />
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className={currentVersion.text.length > capacity ? 'text-red-600' : 'text-stone-500'}>
                  {currentVersion.text.length} / {capacity} 字
                </span>
                <span className="text-stone-400">
                  位置: {getPositionString(currentVersion.x, currentVersion.y, currentVersion.width, currentVersion.height)}
                </span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">编辑备注</label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                onBlur={() => onUpdateRemark(remark)}
                className="w-full resize-none rounded border border-stone-300 bg-white p-2 text-sm text-stone-700 focus:border-blue-500 focus:outline-none"
                rows={2}
                placeholder="添加编辑备注..."
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-stone-600">版本历史</label>
                <span className="text-xs text-stone-400">共 {allVersions.length} 个版本</span>
              </div>
              <div className="space-y-2">
                {allVersions.map((version) => (
                  <VersionCard
                    key={version.id}
                    version={version}
                    isCurrent={version.id === bubble.currentVersionId}
                    onSetCurrent={() => onSetCurrentVersion(version.id)}
                    revisions={getVersionRevisions(version.id)}
                    compareWith={version.id !== bubble.currentVersionId ? currentVersion : undefined}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-stone-200 bg-stone-50 px-4 py-2 text-xs text-stone-500">
        气泡ID: {bubble.id}
      </div>
    </div>
  );
}
