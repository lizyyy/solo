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
  const { getAnnotation, getAuditTrails, updateAnnotation, reviseSeverity, supplementRecord } =
    useAnnotationStore();

  const annotation = getAnnotation(id || '');
  const trails = getAuditTrails(id || '');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [highlightRef, setHighlightRef] = useState<string | undefined>();
  const [isEditing, setIsEditing] = useState(false);
  const [localScene, setLocalScene] = useState(annotation?.sceneLabel ?? '');
  const [localSideNote, setLocalSideNote] = useState(annotation?.sideNote ?? '');
  const [localSeverity, setLocalSeverity] = useState<BleachingSeverity>(
    annotation?.severity ?? '正常',
  );
  const [localArea, setLocalArea] = useState(annotation?.bleachingArea ?? 0);
  const [reviseReason, setReviseReason] = useState('');
  const [screenshotAnchor, setScreenshotAnchor] = useState(annotation?.badDataRef ?? '');
  const [showReviseForm, setShowReviseForm] = useState(false);

  if (!annotation) {
    return (
      <div className="min-h-screen bg-ocean-900 flex items-center justify-center text-ocean-300">
        未找到该记录
      </div>
    );
  }

  const handleJumpAnchor = useCallback((anchor: string) => {
    setHighlightRef(anchor);
  }, []);

  const handleHighlightCleared = useCallback(() => {
    setHighlightRef(undefined);
  }, []);

  const handleSaveEdit = () => {
    if (!annotation) return;
    updateAnnotation(annotation.id, {
      sceneLabel: localScene,
      sideNote: localSideNote,
      severity: localSeverity,
      bleachingArea: localArea,
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setLocalScene(annotation.sceneLabel);
    setLocalSideNote(annotation.sideNote);
    setLocalSeverity(annotation.severity);
    setLocalArea(annotation.bleachingArea);
    setIsEditing(false);
  };

  const handleRevise = () => {
    if (!annotation) return;
    reviseSeverity(
      annotation.id,
      annotation.severity,
      localSeverity,
      localArea,
      localScene,
      localSideNote,
      reviseReason || '人工复核改判',
      '小宋',
      screenshotAnchor || annotation.badDataRef,
    );
    setShowReviseForm(false);
    setIsEditing(false);
  };

  const handleSaveCloudMask = (mask: CloudMask) => {
    if (!annotation) return;
    updateAnnotation(annotation.id, {
      hasCloudCover: true,
      status: '云遮挡',
      cloudMask: mask,
      sceneLabel: `${annotation.sceneLabel}（已标记云遮挡，影响面积${mask.affectedArea}km²，已从汇总排除）`,
      sideNote: `${annotation.sideNote}\n\n云遮挡说明：${mask.description}\n补看来源：${mask.reviewSource}`,
    });
    setDrawerOpen(false);
  };

  const handleJumpBadData = () => {
    if (annotation?.badDataRef) {
      setHighlightRef(annotation.badDataRef);
    }
  };

  const handleExportSingle = () => {
    triggerExportAll([annotation], trails, '小宋');
  };

  const displayAnnotation = isEditing
    ? {
        ...annotation,
        sceneLabel: localScene,
        sideNote: localSideNote,
        severity: localSeverity,
        bleachingArea: localArea,
      }
    : annotation;

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
              </div>
              <p className="text-[11px] text-ocean-400 font-mono">{annotation.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                onClick={() => {
                  setLocalScene(annotation.sceneLabel);
                  setLocalSideNote(annotation.sideNote);
                  setLocalSeverity(annotation.severity);
                  setLocalArea(annotation.bleachingArea);
                  setIsEditing(true);
                }}
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

      {showReviseForm && isEditing && (
        <div className="bg-coral-500/10 border-b border-coral-400/30">
          <div className="max-w-[1600px] mx-auto px-5 py-3 flex items-center gap-4">
            <AlertTriangle size={18} className="text-coral-400 flex-shrink-0" />
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
              className="flex items-center gap-1.5 px-4 py-2 bg-coral-500 hover:bg-coral-600 text-white rounded-lg text-sm font-medium transition"
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
            <TripleEditor
              annotation={displayAnnotation}
              onSceneChange={setLocalScene}
              onSideNoteChange={setLocalSideNote}
              onSeverityChange={setLocalSeverity}
              onBleachingAreaChange={setLocalArea}
              editable={isEditing}
              className="h-full"
            />
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
          setIsEditing(true);
          setShowReviseForm(true);
        }}
      />
    </div>
  );
}
