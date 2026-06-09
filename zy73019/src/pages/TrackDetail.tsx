import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit3, Clock, UserCircle, AlertCircle } from 'lucide-react';
import {
  STATUS_LABEL,
  ISSUE_LABEL,
  type TrackStatus,
} from '../../shared/types';
import { useTracksStore } from '@/store/tracks';
import StatusBadge from '@/components/StatusBadge';
import MaterialCard from '@/components/MaterialCard';
import Timeline from '@/components/Timeline';
import HandoffPanel from '@/components/HandoffPanel';
import ReviseModal from '@/components/ReviseModal';
import { cn } from '@/lib/utils';

const statusBannerConfig: Record<TrackStatus, { bg: string; text: string; border: string }> = {
  pending: {
    bg: 'bg-gradient-to-r from-slate-100 to-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
  },
  observing: {
    bg: 'bg-gradient-to-r from-sand/30 to-sand/15',
    text: 'text-sand-dark',
    border: 'border-sand/40',
  },
  recovered: {
    bg: 'bg-gradient-to-r from-sage/30 to-sage/15',
    text: 'text-sage-dark',
    border: 'border-sage/40',
  },
  transferred: {
    bg: 'bg-gradient-to-r from-ochre/30 to-ochre/15',
    text: 'text-ochre-dark',
    border: 'border-ochre/40',
  },
  closed_normal: {
    bg: 'bg-gradient-to-r from-sage/35 to-sage/20',
    text: 'text-sage-dark',
    border: 'border-sage/50',
  },
  closed_abnormal: {
    bg: 'bg-gradient-to-r from-brick/25 to-brick/10',
    text: 'text-brick-dark',
    border: 'border-brick/40',
  },
};

const TrackDetail = () => {
    const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentTrack,
    timeline,
    handoff,
    fetchDetail,
    fetchTimeline,
    fetchHandoff,
    revise,
  } = useTracksStore();

  const [showReviseModal, setShowReviseModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(true);

  useEffect(() => {
    if (id) {
      setDetailLoading(true);
      Promise.all([fetchDetail(id), fetchTimeline(id), fetchHandoff(id)])
        .finally(() => setDetailLoading(false));
    }
  }, [id]);

  const handleReviseConfirm = async (data: any) => {
    if (id) {
      setDetailLoading(true);
      try {
        await revise(id, data);
        await Promise.all([fetchDetail(id), fetchTimeline(id), fetchHandoff(id)]);
      } finally {
        setDetailLoading(false);
      }
    }
    setShowReviseModal(false);
  };

  if (detailLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-stone">加载中...</div>
      </div>
    );
  }

  if (!currentTrack) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-6xl mb-4 opacity-30">😿</div>
        <p className="text-slate-stone mb-4">未找到该追踪记录</p>
        <button
          onClick={() => navigate('/tracks')}
          className="px-5 py-2 rounded-xl bg-sand text-white text-sm font-medium hover:bg-sand-dark transition-colors"
        >
          返回列表
        </button>
      </div>
    );
  }

  const bannerConfig = statusBannerConfig[currentTrack.status];

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-30 bg-cream/90 backdrop-blur-md border-b border-sand/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/tracks')}
              className="p-2 rounded-xl hover:bg-white/70 text-slate-stone hover:text-slate-stone-dark transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-slate-stone-dark truncate">
                  {currentTrack.petName}
                </h1>
                {currentTrack.aliases && currentTrack.aliases.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {currentTrack.aliases.map((alias, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-sand/15 text-sand-dark border border-sand/25"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-stone">
                <span>初诊：{new Date(currentTrack.initialVisitDate).toLocaleDateString('zh-CN')}</span>
                <span>·</span>
                <span>{ISSUE_LABEL[currentTrack.issueType]}</span>
                {currentTrack.revisionCount > 0 && (
                  <>
                    <span>·</span>
                    <span>改判 {currentTrack.revisionCount} 次</span>
                  </>
                )}
              </div>
            </div>
            <StatusBadge status={currentTrack.status} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div
          className={cn(
            'rounded-2xl border-2 p-5 sm:p-6 overflow-hidden',
            bannerConfig.bg,
            bannerConfig.border
          )}
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className={cn('text-3xl font-extrabold tracking-wide', bannerConfig.text)}>
                  {STATUS_LABEL[currentTrack.status]}
                </span>
              </div>

              {currentTrack.currentNote && (
                <div className="mb-3 p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-white/80">
                  <p className="text-sm text-slate-stone-dark leading-relaxed">
                    {currentTrack.currentNote}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-stone">
                <div className="flex items-center gap-1.5">
                  <UserCircle className="w-4 h-4" />
                  <span>最后操作人：<span className="font-medium text-slate-stone-dark">{currentTrack.lastOperator}</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>更新于：{new Date(currentTrack.updatedAt).toLocaleString('zh-CN')}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowReviseModal(true)}
              className={cn(
                'flex-shrink-0 self-start sm:self-center flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all',
                'bg-white/90 hover:bg-white border border-white text-slate-stone-dark hover:shadow-md',
                'backdrop-blur-sm'
              )}
            >
              <Edit3 className="w-4.5 h-4.5" />
              改判
            </button>
          </div>

          {currentTrack.abnormalReason && (
            <div className="mt-5 p-4 rounded-xl bg-brick/12 border border-brick/30">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-brick/25 flex items-center justify-center">
                  <AlertCircle className="w-4.5 h-4.5 text-brick-dark" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-brick-dark mb-1">异常原因说明</p>
                  <p className="text-sm text-brick-dark/85 leading-relaxed">
                    {currentTrack.abnormalReason}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-stone-dark flex items-center gap-2">
              📋 病历与材料
              <span className="text-sm font-normal text-slate-stone">
                ({currentTrack.materials?.length || 0})
              </span>
            </h3>
          </div>
          {!currentTrack.materials || currentTrack.materials.length === 0 ? (
            <div className="py-12 text-center bg-cream/50 rounded-xl border border-dashed border-sand/30">
              <div className="text-4xl mb-2 opacity-40">📄</div>
              <p className="text-sm text-slate-stone">暂无上传材料</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentTrack.materials.map((material) => (
                <MaterialCard key={material.id} material={material} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-lg font-bold text-slate-stone-dark mb-4 flex items-center gap-2">
            🕒 处理历史时间线
          </h3>
          <Timeline nodes={timeline} />
        </section>

        <section>
          <h3 className="text-lg font-bold text-slate-stone-dark mb-4 flex items-center gap-2">
            🔄 交接说明
          </h3>
          <HandoffPanel text={handoff} />
        </section>
      </main>

      {currentTrack && (
        <ReviseModal
          open={showReviseModal}
          onClose={() => setShowReviseModal(false)}
          onConfirm={handleReviseConfirm}
          currentStatus={currentTrack.status}
          currentNote={currentTrack.currentNote}
        />
      )}
    </div>
  );
};

export default TrackDetail;
