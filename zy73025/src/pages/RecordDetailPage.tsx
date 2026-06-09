import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  Calendar,
  User,
  PawPrint,
  Shield,
  Clock,
  History as HistoryIcon,
  Gavel,
  Plus,
  CheckCircle,
  MessageCircle,
  FileText,
  AlertCircle,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import StatusBadge from '@/components/StatusBadge';
import TempChart from '@/components/TempChart';
import WeightChart from '@/components/WeightChart';
import FactorPanel from '@/components/FactorPanel';
import VaccineWarning from '@/components/VaccineWarning';
import RejudgeModal from '@/components/RejudgeModal';
import SupplementModal from '@/components/SupplementModal';
import type {
  Conclusion,
  Note,
  SupplementType,
  VaccineSupplementContent,
  WeightSupplementContent,
  NoteSupplementContent,
} from '@shared/types';
import { cn } from '@/lib/utils';

interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'error';
}

type SupplementPayload =
  | { type: 'vaccine'; content: VaccineSupplementContent }
  | { type: 'weight'; content: WeightSupplementContent }
  | { type: 'note'; content: NoteSupplementContent };

const conclusionText: Record<Conclusion, string> = {
  normal: '正常',
  observe: '观察',
  abnormal: '异常',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentRecord, recordLoading, fetchRecord, rejudge, supplement, lastError } =
    useAppStore();

  const [rejudgeOpen, setRejudgeOpen] = useState(false);
  const [supplementOpen, setSupplementOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>({ visible: false, message: '', type: 'success' });
  const [localPendingReason, setLocalPendingReason] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (id) {
      fetchRecord(id);
    }
  }, [id, fetchRecord]);

  useEffect(() => {
    if (lastError) {
      showToast(lastError, 'error');
    }
  }, [lastError]);

  const showToast = (message: string, type: ToastState['type'] = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 3000);
  };

  const hasVaccineMissing = currentRecord
    ? currentRecord.factors.some((f) => f.type === 'vaccine_missing') ||
      currentRecord.vaccines.some((v) => v.date === null)
    : false;

  const vaccineAffectedRecords = currentRecord
    ? Array.from(
        new Set(
          currentRecord.factors
            .filter((f) => f.type === 'vaccine_missing')
            .flatMap((f) => f.affectedRecords),
        ),
      )
    : [];

  const handleRejudgeConfirm = async (payload: {
    conclusion: Conclusion;
    reason: string;
    supplementIds: string[];
  }) => {
    if (!id) return;
    try {
      await rejudge(id, {
        conclusion: payload.conclusion,
        reason: payload.reason,
        operator: '阿宁',
      });
      showToast('改判成功！结论已更新并记录历史');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '改判失败', 'error');
      throw err;
    }
  };

  const handleSupplementConfirm = async (payload: SupplementPayload) => {
    if (!id) return;
    try {
      await supplement(id, {
        type: payload.type as SupplementType,
        content: payload.content,
        operator: '阿宁',
      });
      showToast('补录成功！信息已添加并记录历史');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '补录失败', 'error');
      throw err;
    }
  };

  const handleSetPending = (reason: string) => {
    setLocalPendingReason(reason);
    showToast('已填写待确认理由');
  };

  if (recordLoading && !currentRecord) {
    return (
      <div className="min-h-screen bg-mist-50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-6 bg-mist-200 rounded w-1/3" />
            <div className="card">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="h-40 bg-mist-100 rounded-xl" />
                <div className="h-40 bg-mist-100 rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="h-72 bg-mist-100 rounded-xl" />
              <div className="h-72 bg-mist-100 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentRecord) {
    return (
      <div className="min-h-screen bg-mist-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-mist-300 mx-auto mb-4" />
          <p className="font-serif text-xl text-mist-700 mb-2">记录不存在</p>
          <button onClick={() => navigate('/')} className="btn-primary">
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const record = currentRecord;
  const sortedNotes = [...record.notes].sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
  );
  const pendingReason = localPendingReason ?? record.pendingReason;

  return (
    <div className="min-h-screen bg-mist-50 pb-32">
      {toast.visible && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
          <div
            className={cn(
              'flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border',
              toast.type === 'success'
                ? 'bg-forest-700 text-white border-forest-600'
                : 'bg-cinnabar-600 text-white border-cinnabar-500',
            )}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 shrink-0" />
            ) : (
              <X className="w-5 h-5 shrink-0" />
            )}
            <span className="font-medium text-sm">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/')}
            className="btn-ghost gap-1.5 px-3 -ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </button>
          <nav className="flex items-center text-sm text-mist-500">
            <Link to="/" className="hover:text-forest-700 transition-colors">
              列表
            </Link>
            <ChevronRight className="w-4 h-4 mx-1 text-mist-300" />
            <span className="text-mist-800 font-medium">记录详情</span>
          </nav>
        </div>

        <div className="card mb-6 border-t-4 border-t-forest-700">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-mist-400 font-mono">{record.code}</span>
                <StatusBadge status={record.status} />
              </div>
              <div className="flex items-center gap-2">
                <PawPrint className="w-7 h-7 text-forest-600" />
                <h1 className="font-serif text-3xl font-bold text-mist-900">
                  {record.petName}
                </h1>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                <InfoItem icon={User} label="主人" value={record.ownerName} />
                <InfoItem icon={PawPrint} label="宠物类型" value={record.petType} />
                <InfoItem icon={Calendar} label="就诊日期" value={formatDate(record.visitDate)} />
                <InfoItem icon={Shield} label="复核员" value={record.reviewer} />
              </div>
            </div>

            <div className="lg:w-56 shrink-0 flex flex-col items-center lg:items-end gap-3 lg:border-l lg:border-mist-200 lg:pl-6">
              <p className="text-xs text-mist-400 uppercase tracking-wider">当前结论</p>
              <StatusBadge conclusion={record.conclusion} />
              <p className="font-serif text-4xl font-bold text-mist-900">
                {conclusionText[record.conclusion]}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-mist-400">
                <Clock className="w-3 h-3" />
                更新于 {formatDateTime(record.updatedAt)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          <TempChart
            tempCurve={record.tempCurve}
            tempThreshold={record.tempThreshold}
          />
          <WeightChart
            weightCurve={record.weightCurve}
            hasLegacyCurve={record.hasLegacyCurve}
          />
        </div>

        {hasVaccineMissing && (
          <div className="mb-6">
            <VaccineWarning
              vaccines={record.vaccines}
              pendingReason={pendingReason}
              affectedRecords={vaccineAffectedRecords}
              onSupplement={() => setSupplementOpen(true)}
              onSetPending={handleSetPending}
            />
          </div>
        )}

        <div className="mb-6">
          <FactorPanel factors={record.factors} />
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title !mb-0 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-forest-600" />
              备注列表
              <span className="text-xs font-normal text-mist-500 ml-1">
                ({sortedNotes.length})
              </span>
            </h3>
          </div>

          {sortedNotes.length === 0 ? (
            <div className="text-center py-10 text-mist-400 text-sm">
              暂无备注记录
            </div>
          ) : (
            <div className="space-y-3">
              {sortedNotes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-mist-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            to={`/records/${record.id}/history`}
            className="btn-secondary"
          >
            <HistoryIcon className="w-4 h-4" />
            查看历史
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSupplementOpen(true)}
              className="btn-secondary"
            >
              <Plus className="w-4 h-4" />
              补录
            </button>
            <button
              onClick={() => setRejudgeOpen(true)}
              disabled={hasVaccineMissing}
              className={cn(
                hasVaccineMissing ? 'btn-secondary' : 'btn-primary',
              )}
              title={hasVaccineMissing ? '疫苗缺失时无法直接标记为正常，请先处理异常' : ''}
            >
              <Gavel className="w-4 h-4" />
              改判
            </button>
          </div>
        </div>
      </div>

      <RejudgeModal
        open={rejudgeOpen}
        originalConclusion={record.conclusion}
        onClose={() => setRejudgeOpen(false)}
        onConfirm={handleRejudgeConfirm}
      />

      <SupplementModal
        open={supplementOpen}
        onClose={() => setSupplementOpen(false)}
        onConfirm={handleSupplementConfirm}
      />
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-mist-400 mb-1">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <p className="text-sm font-medium text-mist-800">{value}</p>
    </div>
  );
}

function NoteCard({ note }: { note: Note }) {
  const isVerbal = note.source === 'verbal';
  return (
    <div
      className={cn(
        'rounded-xl p-4 border transition-all',
        isVerbal
          ? 'bg-amber-50/50 border-amber-200 border-l-4 border-l-amber-500'
          : 'bg-white border-mist-200',
      )}
    >
      {isVerbal && (
        <div className="flex items-center gap-1.5 mb-2">
          <MessageCircle className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
            口头转达
          </span>
        </div>
      )}
      <p
        className={cn(
          'text-mist-800 leading-relaxed',
          isVerbal ? 'italic font-serif text-base' : 'text-sm',
        )}
      >
        {isVerbal && <span className="text-amber-400 font-serif text-2xl leading-none align-top mr-1 select-none">"</span>}
        {note.content}
        {isVerbal && <span className="text-amber-400 font-serif text-2xl leading-none align-bottom ml-1 select-none">"</span>}
      </p>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-mist-100">
        <div className="flex items-center gap-3 text-xs text-mist-500">
          {!isVerbal && (
            <span className="inline-flex items-center gap-1">
              <FileText className="w-3 h-3" />
              书面记录
            </span>
          )}
          <span>操作人：<span className="font-medium text-mist-700">{note.operator}</span></span>
        </div>
        <span className="text-xs text-mist-400">{formatDateTime(note.time)}</span>
      </div>
    </div>
  );
}
