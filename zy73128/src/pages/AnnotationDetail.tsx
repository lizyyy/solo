import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  AlertTriangle,
  Save,
  Edit3,
  RotateCcw,
  Check,
  FileText,
  Settings,
  MessageSquareText,
} from 'lucide-react';
import { useAnnotationStore } from '@/store/useAnnotationStore';
import type { BleachingSeverity, CloudMask } from '@/shared/types';
import ScreenshotViewer from '@/components/ScreenshotViewer';
import TripleEditor from '@/components/TripleEditor';
import AuditTimeline from '@/components/AuditTimeline';
import AnomalyDrawer from '@/components/AnomalyDrawer';
import { triggerExportAll } from '@/utils/export';
import { cn } from '@/lib/utils';

export default function AnnotationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getAnnotation, getAuditTrails, editWithAudit, markCloudCover, reviseSeverity } =
    useAnnotationStore();

  const annotation = getAnnotation(id || '');
  const trails = getAuditTrails(id || '');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [highlightRef, setHighlightRef] = useState<string | undefined>();
  const [isEditing, setIsEditing] = useState(false);
  const [localScene, setLocalScene] = useState(annotation?.sceneLabel ?? '');
  const [localSideNote, setLocalSideNote] = useState(annotation?.sideNote ?? '');
  const [localSeverity, setLocalSeverity] = useState<BleachingSeverity>(
    (annotation?.severity as BleachingSeverity) ?? '正常',
  );
  const [localArea, setLocalArea] = useState(annotation?.bleachingArea ?? 0);
  const [editReason, setEditReason] = useState('');
  const [reviseReason, setReviseReason] = useState('');
  const [screenshotAnchor, setScreenshotAnchor] = useState(annotation?.badDataRef ?? '');
  const [showReviseForm, setShowReviseForm] = useState(false);
  const [saveSuccessFlash, setSaveSuccessFlash] = useState(false);

  const handleJumpAnchor = useCallback((anchor: string) => {
    setHighlightRef(anchor);
  }, []);

  const handleHighlightCleared = useCallback(() => {
    setHighlightRef(undefined);
  }, []);

  const handleStartEdit = useCallback(() => {
    if (!annotation) return;
    setLocalScene(annotation.sceneLabel);
    setLocalSideNote(annotation.sideNote);
    setLocalSeverity(annotation.severity as BleachingSeverity);
    setLocalArea(annotation.bleachingArea);
    setEditReason('');
    setScreenshotAnchor(annotation.badDataRef ?? '');
    setIsEditing(true);
  }, [annotation]);

  const handleCancelEdit = useCallback(() => {
    if (!annotation) return;
    setLocalScene(annotation.sceneLabel);
    setLocalSideNote(annotation.sideNote);
    setLocalSeverity(annotation.severity as BleachingSeverity);
    setLocalArea(annotation.bleachingArea);
    setEditReason('');
    setIsEditing(false);
  }, [annotation]);

  const handleSaveEdit = useCallback(() => {
    if (!annotation) return;

    const hasSeverityChange = localSeverity !== annotation.severity;
    const hasAreaChange = localArea !== annotation.bleachingArea;
    const hasSceneChange = localScene !== annotation.sceneLabel;
    const hasSideNoteChange = localSideNote !== annotation.sideNote;

    if (!hasSeverityChange && !hasAreaChange && !hasSceneChange && !hasSideNoteChange) {
      setIsEditing(false);
      return;
    }

    const actionType = hasSeverityChange || hasAreaChange ? '改判' : '编辑';
    const defaultReason = hasSeverityChange
      ? `白化等级由「${annotation.severity}」调整为「${localSeverity}」`
      : hasAreaChange
      ? `白化面积由 ${annotation.bleachingArea.toFixed(2)} km² 调整为 ${localArea.toFixed(2)} km²`
      : '编辑场景标注或侧边说明';

    const finalReason = editReason.trim() || defaultReason;

    const result = editWithAudit(
      annotation.id,
      {
        severity: localSeverity,
        bleachingArea: localArea,
        sceneLabel: localScene,
        sideNote: localSideNote,
        ...(actionType === '改判' ? { status: '异常' as const } : {}),
      },
      {
        reason: finalReason,
        operator: '小宋',
        action: actionType,
        screenshotAnchor: screenshotAnchor || annotation.badDataRef || undefined,
      },
    );

    if (result.changed) {
      setSaveSuccessFlash(true);
      setTimeout(() => setSaveSuccessFlash(false), 2000);
    }
    setIsEditing(false);
  }, [annotation, localSeverity, localArea, localScene, localSideNote, editReason, screenshotAnchor, editWithAudit]);

  const handleRevise = useCallback(() => {
    if (!annotation) return;
    reviseSeverity(
      annotation.id,
      annotation.severity as BleachingSeverity,
      localSeverity,
      localArea,
      localScene,
      localSideNote,
      reviseReason || '人工复核改判',
      '小宋',
      screenshotAnchor || annotation.badDataRef || undefined,
    );
    setShowReviseForm(false);
    setIsEditing(false);
    setSaveSuccessFlash(true);
    setTimeout(() => setSaveSuccessFlash(false), 2000);
  }, [annotation, localSeverity, localArea, localScene, localSideNote, reviseReason, screenshotAnchor, reviseSeverity]);

  const handleSaveCloudMask = useCallback(
    (mask: CloudMask) => {
      if (!annotation) return;
      markCloudCover(annotation.id, mask, {
        operator: '小宋',
        reason: '人工标记云遮挡区域，已从正常汇总中排除',
      });
      setDrawerOpen(false);
      setSaveSuccessFlash(true);
      setTimeout(() => setSaveSuccessFlash(false), 2000);
    },
    [annotation, markCloudCover],
  );

  const handleJumpBadData = useCallback(() => {
    if (annotation?.badDataRef) {
      setHighlightRef(annotation.badDataRef);
    }
  }, [annotation]);

  const handleExportSingle = useCallback(() => {
    if (!annotation) return;
    triggerExportAll([annotation], trails, '小宋');
  }, [annotation, trails]);

  const displayAnnotation = isEditing && annotation
    ? {
        ...annotation,
        sceneLabel: localScene,
        sideNote: localSideNote,
        severity: localSeverity,
        bleachingArea: localArea,
      }
    : annotation;

  if (!annotation) {
    return (
      <div className="min-h-screen bg-ocean-900 flex items-center justify-center text-ocean-300">
        未找到该记录
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-ocean-900 via-ocean-800 to-ocean-900">
      <header className="sticky top-0 z-30 border-b border-ocean-600/30 bg-ocean-800/80 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-ocean-300 hover:text-ocean-50 hover:bg-ocean-700/50 rounded-lg text-sm transition"
            >
              <ArrowLeft size={16} />
              返回汇总
            </button>
            <div className="h-5 w-px bg-ocean-600/50" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif font-semibold text-ocean-50">{annotation.station}</h1>
                <span
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full font-medium text-white',
                    annotation.status === '正常' && 'bg-status-normal',
                    annotation.status === '补录' && 'bg-status-supplement',
                    annotation.status === '异常' && 'bg-status-anomaly',
                    annotation.status === '云遮挡' && 'bg-status-cloud',
                  )}
                >
                  {annotation.status}
                </span>
                {saveSuccessFlash && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-status-normal text-white animate-pulse">
                    ✓ 已保存
                  </span>
                )}
              </div>
              <p className="text-[11px] text-ocean-400 font-mono">{annotation.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                onClick={handleStartEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-ocean-700/60 hover:bg-ocean-600/60 text-ocean-100 rounded-lg text-sm transition"
              >
                <Edit3 size={14} />
                编辑
              </button>
            ) : (
              <>
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-ocean-700/60 hover:bg-ocean-600/60 text-ocean-100 rounded-lg text-sm transition"
                >
                  <RotateCcw size={14} />
                  取消
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-status-normal hover:bg-status-normal/90 text-white rounded-lg text-sm transition"
                >
                  <Save size={14} />
                  保存
                </button>
              </>
            )}

            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-status-anomaly/90 hover:bg-status-anomaly text-white rounded-lg text-sm transition"
            >
              <AlertTriangle size={14} />
              异常标记
            </button>

            <button
              onClick={handleExportSingle}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-coral-500 hover:bg-coral-600 text-white rounded-lg text-sm transition"
            >
              <Download size={14} />
              导出
            </button>
          </div>
        </div>
      </header>

      {isEditing && (
        <div className="bg-coral-500/10 border-b border-coral-400/30">
          <div className="max-w-[1600px] mx-auto px-5 py-3 flex items-center gap-4">
            <MessageSquareText size={18} className="text-coral-400 flex-shrink-0" />
            <div className="flex-1">
              <label className="text-[11px] text-ocean-300 mb-1 block">修改理由（保存后自动写入线索链）</label>
              <input
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="请简要说明修改原因，如：复核发现西北侧浅礁盘漏判、实验数据更新..."
                className="w-full bg-ocean-900/60 border border-ocean-600/40 rounded-md px-3 py-1.5 text-sm text-ocean-50 focus:outline-none focus:border-coral-400/60 focus:ring-1 focus:ring-coral-400/30"
              />
            </div>
            <div className="text-right">
              <div className="text-[10px] text-ocean-400">操作人</div>
              <div className="text-xs text-ocean-200 font-medium">小宋</div>
            </div>
          </div>
        </div>
      )}

      {showReviseForm && isEditing && (
        <div className="bg-status-anomaly/10 border-b border-status-anomaly/30">
          <div className="max-w-[1600px] mx-auto px-5 py-3 flex items-center gap-4">
            <AlertTriangle size={18} className="text-status-anomaly flex-shrink-0" />
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-ocean-300 mb-1 block">改判理由</label>
                <input
                  type="text"
                  value={reviseReason}
                  onChange={(e) => setReviseReason(e.target.value)}
                  placeholder="请填写改判原因，将写入线索链"
                  className="w-full bg-ocean-900/60 border border-ocean-600/40 rounded px-3 py-1.5 text-sm text-ocean-50 focus:outline-none focus:border-coral-400"
                />
              </div>
              <div>
                <label className="text-[11px] text-ocean-300 mb-1 block">截图锚点</label>
                <input
                  type="text"
                  value={screenshotAnchor}
                  onChange={(e) => setScreenshotAnchor(e.target.value)}
                  placeholder="pixel:x1,y1-x2,y2"
                  className="w-full bg-ocean-900/60 border border-ocean-600/40 rounded px-3 py-1.5 text-sm text-ocean-50 font-mono focus:outline-none focus:border-coral-400"
                />
              </div>
            </div>
            <button
              onClick={handleRevise}
              className="flex items-center gap-1.5 px-4 py-2 bg-status-anomaly hover:bg-status-anomaly/90 text-white rounded-lg text-sm font-medium transition"
            >
              <Check size={14} />
              确认改判
            </button>
            <button
              onClick={() => setShowReviseForm(false)}
              className="text-ocean-400 hover:text-ocean-200 text-sm"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <main className="max-w-[1600px] mx-auto px-5 py-5">
        <div className="grid grid-cols-12 gap-4" style={{ minHeight: 'calc(100vh - 140px)' }}>
          <div className="col-span-4">
            <ScreenshotViewer
              annotation={annotation}
              highlightRef={highlightRef}
              onHighlightCleared={handleHighlightCleared}
              className="h-full"
            />

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-ocean-800/50 rounded-lg border border-ocean-600/30 p-3">
                <div className="text-[11px] text-ocean-400 mb-1">采样时间</div>
                <div className="text-ocean-50 font-mono text-sm">
                  {new Date(annotation.sampleTime).toLocaleString('zh-CN')}
                </div>
              </div>
              <div className="bg-ocean-800/50 rounded-lg border border-ocean-600/30 p-3">
                <div className="text-[11px] text-ocean-400 mb-1">实验结果时间</div>
                <div className="text-ocean-50 font-mono text-sm">
                  {new Date(annotation.experimentResult).toLocaleString('zh-CN')}
                </div>
              </div>
            </div>

            {annotation.status === '补录' && (
              <div className="mt-3 bg-status-supplement/10 border border-status-supplement/30 rounded-lg p-3">
                <div className="text-[11px] text-status-supplement font-medium mb-1 flex items-center gap-1.5">
                  <FileText size={12} />
                  补录提示
                </div>
                <p className="text-[11px] text-ocean-200 leading-relaxed">
                  本记录为补录记录，原始创建时间保留不变。补录操作已写入线索链，
                  可追溯补录前后的字段差异。
                </p>
              </div>
            )}

            {annotation.status === '异常' && (
              <div className="mt-3 bg-status-anomaly/10 border border-status-anomaly/30 rounded-lg p-3">
                <div className="text-[11px] text-status-anomaly font-medium mb-1 flex items-center gap-1.5">
                  <AlertTriangle size={12} />
                  异常记录提示
                </div>
                <p className="text-[11px] text-ocean-200 leading-relaxed">
                  本记录存在人工改判，结论已变化。请沿右侧线索链查看每次改判的原因和证据，
                  点击「跳转截图锚点」可回到遥感截图原始位置。
                </p>
              </div>
            )}

            {annotation.status === '云遮挡' && annotation.cloudMask && (
              <div className="mt-3 bg-status-cloud/10 border border-status-cloud/30 rounded-lg p-3">
                <div className="text-[11px] text-status-cloud font-medium mb-1 flex items-center gap-1.5">
                  <Settings size={12} />
                  云遮挡已排除
                </div>
                <p className="text-[11px] text-ocean-200 leading-relaxed">
                  影响面积 {annotation.cloudMask.affectedArea}km² 已从白化汇总中扣除。
                  补看来源：{annotation.cloudMask.reviewSource.split(' ').slice(0, 3).join(' ')}
                </p>
              </div>
            )}
          </div>

          <div className="col-span-5">
            {displayAnnotation ? (
              <TripleEditor
                annotation={displayAnnotation}
                onSceneChange={setLocalScene}
                onSideNoteChange={setLocalSideNote}
                onSeverityChange={setLocalSeverity}
                onBleachingAreaChange={setLocalArea}
                editable={isEditing}
                className="h-full"
              />
            ) : null}
          </div>

          <div className="col-span-3">
            <div className="bg-ocean-800/50 rounded-xl border border-ocean-600/30 overflow-hidden h-full flex flex-col" style={{ minHeight: 560 }}>
              <AuditTimeline
                trails={trails}
                onJumpToAnchor={handleJumpAnchor}
                className="flex-1 flex flex-col"
              />
            </div>
          </div>
        </div>
      </main>

      <AnomalyDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        annotation={annotation}
        onSaveCloudMask={handleSaveCloudMask}
        onJumpBadData={handleJumpBadData}
        onRevise={() => {
          setDrawerOpen(false);
          handleStartEdit();
          setShowReviseForm(true);
        }}
      />
    </div>
  );
}
