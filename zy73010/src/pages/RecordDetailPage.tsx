import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReviewStore } from '@/store/reviewStore.js';
import { WeightChart } from '@/components/WeightChart.js';
import { PhotoWall } from '@/components/PhotoWall.js';
import { InfluenceTimeline } from '@/components/InfluenceTimeline.js';
import { RemarkEditor } from '@/components/RemarkEditor.js';
import { StatusBadge, AnomalyBadge } from '@/components/StatusBadge.js';
import type { WeightPoint } from '../../shared/types.js';
import {
  Calendar, Phone, PawPrint, User, AlertCircle, CheckCircle,
  ArrowRight, Syringe,
} from 'lucide-react';

export default function RecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const record = useReviewStore(s => s.recordDetail);
  const loading = useReviewStore(s => s.loading.record);
  const remarkLoading = useReviewStore(s => s.loading.remark);
  const supplementLoading = useReviewStore(s => s.loading.supplement);
  const fetchRecord = useReviewStore(s => s.fetchRecord);
  const updateRemark = useReviewStore(s => s.updateRemark);
  const supplementRemark = useReviewStore(s => s.supplementRemark);

  const [hlDate, setHlDate] = useState<string | null>(null);
  const photosRef = useRef<HTMLDivElement>(null);
  const remarksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) fetchRecord(id);
  }, [id]);

  const onPointClick = (pt: WeightPoint) => {
    setHlDate(pt.date);
    if (pt.photoUrl && photosRef.current) {
      photosRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (loading) {
    return (
      <div className="card p-16 text-center text-ink-300">
        <div className="animate-pulse text-sm">正在加载寄养记录详情...</div>
      </div>
    );
  }

  if (!record) {
    return <div className="card p-16 text-center text-warn-500">记录不存在</div>;
  }

  return (
    <div className="space-y-6 stagger">
      <section className="card p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex items-start gap-4 flex-1">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 text-white flex items-center justify-center shadow-lg shadow-brand-600/20 shrink-0">
              <PawPrint size={32} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-serif font-bold text-2xl text-ink-700">{record.petName}</h2>
                <span className="text-[11px] px-2 py-0.5 rounded bg-ink-100 text-ink-500 font-medium">{record.id}</span>
                <StatusBadge status={record.reviewStatus} />
              </div>
              <div className="text-sm text-ink-500 mt-0.5">{record.petBreed}</div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4 text-xs">
                <div className="flex items-center gap-2 text-ink-500">
                  <User size={13} /> <span className="font-medium">{record.ownerName}</span>
                </div>
                <div className="flex items-center gap-2 text-ink-500">
                  <Phone size={13} /> <span className="font-medium">{record.ownerPhone}</span>
                </div>
                <div className="flex items-center gap-2 text-ink-500 col-span-2">
                  <Calendar size={13} /> 寄养时段：<span className="font-medium">{record.startDate} ~ {record.endDate}</span>
                </div>
              </div>

              <div className="mt-4 space-y-1">
                <div className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">复核结论</div>
                <div className="text-sm text-ink-700 bg-gradient-to-r from-brand-50 to-white rounded-xl px-4 py-3 border border-brand-100/60 inline-flex items-start gap-2">
                  {record.reviewStatus === 'approved' ? <CheckCircle size={16} className="text-brand-600 mt-0.5 shrink-0" /> :
                    record.reviewStatus === 'exception' ? <AlertCircle size={16} className="text-warn-500 mt-0.5 shrink-0" /> :
                    <AlertCircle size={16} className="text-accent-500 mt-0.5 shrink-0" />}
                  <span>{record.conclusion}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:w-64 flex flex-col gap-2.5">
            <div className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">异常痕迹</div>
            <div className="flex flex-wrap gap-1.5">
              {record.hasWeightAnomaly && <AnomalyBadge kind="weight" />}
              {record.hasVaccineMissing && <AnomalyBadge kind="vaccine" />}
              {record.abnormalPhotos.length > 0 && <AnomalyBadge kind="photo" />}
              {record.remarks.some(r => r.isSupplement) && <AnomalyBadge kind="supplement" />}
              {!record.hasWeightAnomaly && !record.hasVaccineMissing && !record.abnormalPhotos.length && !record.remarks.some(r => r.isSupplement) && (
                <span className="chip bg-brand-100 text-brand-700">无异常标记</span>
              )}
            </div>
            <div className="mt-2 text-xs text-ink-500 leading-relaxed">
              💡 点击体重曲线上的异常节点，可联动跳转到当日异常照片。筛选和导出时这些异常都会被保留痕迹。
            </div>
            <button
              onClick={() => nav('/exceptions')}
              className="mt-2 w-full btn-secondary text-xs py-2">
              追溯到异常队列 <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </section>

      <section className="card p-6" ref={photosRef}>
        <div className="section-title mb-4 flex items-center gap-2">
          <span>📈 体重曲线（含旧版对比）</span>
        </div>
        <WeightChart points={record.weightPoints} onPointClick={onPointClick} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className="card p-6 lg:col-span-3 space-y-5">
          <div className="section-title mb-1 flex items-center gap-2">
            <Syringe size={18} className="text-brand-600" />
            <span>疫苗信息</span>
            <span className="text-xs text-ink-300 font-normal">缺失项会在筛选与导出中留下异常痕迹</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-ink-100">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th">疫苗名称</th>
                  <th className="table-th">接种日期</th>
                  <th className="table-th">状态</th>
                </tr>
              </thead>
              <tbody>
                {record.vaccines.map((v, i) => (
                  <tr key={i} className={`${v.isMissing ? 'bg-warn-400/5' : ''}`}>
                    <td className="table-td font-medium">{v.name}</td>
                    <td className="table-td">
                      {v.date || <span className="text-warn-500 font-medium">未提供</span>}
                    </td>
                    <td className="table-td">
                      {v.isMissing ? (
                        <span className="inline-flex items-center gap-1.5 chip bg-warn-500/15 text-warn-600 ring-1 ring-inset ring-warn-400/40 animate-pulse-soft">
                          ⚠ 缺失
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 chip bg-brand-100 text-brand-700">✓ 齐全</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div className="section-title mb-3">🖼️ 异常照片墙</div>
            <PhotoWall
              photos={record.abnormalPhotos.map(p => ({ url: p.url, caption: p.caption, date: p.date }))}
              relatedWeights={record.weightPoints}
              highlightDate={hlDate}
            />
          </div>
        </section>

        <section className="card p-6 lg:col-span-2">
          <div className="section-title mb-1">📋 复核备注编辑</div>
          <div className="text-xs text-ink-500 mb-4">
            修改备注后将实时同步后端数据、异常队列和导出结果
          </div>
          <div ref={remarksRef}>
            <RemarkEditor
              recordId={record.id}
              remarks={record.remarks}
              loading={remarkLoading}
              supplementLoading={supplementLoading}
              onSave={(content, status) => updateRemark(record.id, content, status)}
              onSupplement={(content) => supplementRemark(record.id, content)}
              onNavigateExport={() => nav('/export')}
            />
          </div>
        </section>
      </div>

      <section className="card p-6">
        <div className="section-title mb-1">🔍 复核影响追踪</div>
        <div className="text-xs text-ink-500 mb-5">
          区分本次复核中混入的<span className="text-brand-700 font-semibold">旧版体重曲线</span>、
          <span className="text-ink-500 font-semibold">撤回记录</span>、
          <span className="text-accent-500 font-semibold">口头备注</span>，
          明确哪些因素影响了最终结论。
        </div>
        <InfluenceTimeline items={record.influenceTrace} />
      </section>
    </div>
  );
}
