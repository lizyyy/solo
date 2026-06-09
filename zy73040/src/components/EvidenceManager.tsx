import { useState } from 'react';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import type { Evidence } from '@/types';
import {
  CheckCircle2, Clock, FileCheck, Camera, FileText, PackageCheck,
  Upload, X, Save
} from 'lucide-react';

export default function EvidenceManager() {
  const selectedOrder = usePlaybackStore((s) => s.workOrders.find((o) => o.id === s.selectedOrderId));
  const updateEv = usePlaybackStore((s) => s.updateEvidenceStatus);
  const [activeTab, setActiveTab] = useState<'all' | 'confirmed' | 'pending'>('all');
  const [editingEv, setEditingEv] = useState<string | null>(null);
  const [editRemark, setEditRemark] = useState('');

  if (!selectedOrder) return null;

  const evTypeConfig: Record<Evidence['type'], { icon: typeof FileCheck; label: string; color: string }> = {
    arrival_proof: { icon: PackageCheck, label: '到货凭证', color: 'text-navy-500' },
    inspection_record: { icon: FileText, label: '巡检记录', color: 'text-jade-500' },
    photo: { icon: Camera, label: '现场照片', color: 'text-amber-500' },
  };

  const filtered = selectedOrder.evidences.filter((e) =>
    activeTab === 'all' ? true : e.status === activeTab
  );

  const confirmedCount = selectedOrder.evidences.filter((e) => e.status === 'confirmed').length;
  const pendingCount = selectedOrder.evidences.filter((e) => e.status === 'pending').length;

  const handleConfirm = (ev: Evidence) => {
    updateEv(selectedOrder.id, ev.id, 'confirmed', editRemark || ev.remark);
    setEditingEv(null);
    setEditRemark('');
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="section-title">
          <FileCheck className="w-4 h-4" />
          证据管理 · 已确认 / 待补
        </h2>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-jade-500 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> 已确认 {confirmedCount}
          </span>
          <span className="inline-flex items-center gap-1.5 text-amber-500 font-medium">
            <Clock className="w-3.5 h-3.5" /> 待补 {pendingCount}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-4 border-b border-coolgray-200">
        {(['all', 'confirmed', 'pending'] as const).map((t) => {
          const isActive = activeTab === t;
          const label = t === 'all' ? '全部' : t === 'confirmed' ? '已确认' : '待补证据';
          const count =
            t === 'all' ? selectedOrder.evidences.length :
            t === 'confirmed' ? confirmedCount : pendingCount;
          const badgeColor = t === 'pending' ? 'bg-amber-400' : t === 'confirmed' ? 'bg-jade-400' : 'bg-navy-400';
          return (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                isActive ? 'text-navy-600' : 'text-coolgray-500 hover:text-coolgray-700'
              }`}
            >
              {label}
              <span className={`ml-1.5 inline-flex items-center justify-center text-[10px] font-bold text-white rounded-full px-1.5 py-0.5 ${badgeColor}`}>
                {count}
              </span>
              {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-navy-500 rounded-t-sm" />}
            </button>
          );
        })}
      </div>

      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-coolgray-400 text-sm">
            该分类暂无证据记录
          </div>
        )}
        {filtered.map((ev) => {
          const cfg = evTypeConfig[ev.type];
          const Icon = cfg.icon;
          const isEditing = editingEv === ev.id;
          const isPending = ev.status === 'pending';

          return (
            <div
              key={ev.id}
              className={`rounded-md border p-3.5 transition-all ${
                isPending
                  ? 'border-amber-200 bg-amber-50/50 hover:bg-amber-50'
                  : 'border-coolgray-200 bg-white hover:bg-coolgray-50/50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className={`w-9 h-9 shrink-0 rounded-sm flex items-center justify-center ${
                      isPending ? 'bg-amber-100' : 'bg-jade-100'
                    }`}
                  >
                    <Icon className={`w-4.5 h-4.5 ${cfg.color}`} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-coolgray-800">{ev.name}</span>
                      <span className={`tag text-[10px] ${
                        isPending
                          ? 'bg-amber-100 text-amber-600 border border-amber-200'
                          : 'bg-jade-50 text-jade-500 border border-jade-200'
                      }`}>
                        {isPending ? (
                          <>
                            <Clock className="w-2.5 h-2.5" /> 待补证据
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-2.5 h-2.5" /> 已确认
                          </>
                        )}
                      </span>
                      <span className={`tag text-[10px] bg-coolgray-100 ${cfg.color} border border-coolgray-200`}>
                        {cfg.label}
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="mt-3 animate-slide-down space-y-2">
                        <textarea
                          value={editRemark}
                          onChange={(e) => setEditRemark(e.target.value)}
                          placeholder="输入补录说明，或直接确认该证据已归档..."
                          className="input-field min-h-[60px] text-xs resize-y"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleConfirm(ev)}
                            className="btn-warning text-xs py-1.5 px-3"
                          >
                            <CheckCircle2 className="w-3 h-3" /> 标记已确认
                          </button>
                          <button
                            onClick={() => {
                              setEditingEv(null);
                              setEditRemark('');
                            }}
                            className="btn-secondary text-xs py-1.5 px-3"
                          >
                            <X className="w-3 h-3" /> 取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {ev.remark && (
                          <p className={`mt-1.5 text-xs leading-relaxed px-2 py-1.5 rounded-sm ${
                            isPending ? 'bg-amber-100 text-amber-700' : 'bg-coolgray-100 text-coolgray-600 italic'
                          }`}>
                            💬 {ev.remark}
                          </p>
                        )}
                        {(ev.uploadTime || ev.uploader) && (
                          <div className="mt-2 text-[10px] text-coolgray-400 font-mono flex items-center gap-2">
                            {ev.uploader && <span>上传人：{ev.uploader}</span>}
                            {ev.uploader && ev.uploadTime && <span>·</span>}
                            {ev.uploadTime && <span>{ev.uploadTime}</span>}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {!isEditing && (
                  <div className="shrink-0">
                    {isPending ? (
                      <button
                        onClick={() => {
                          setEditingEv(ev.id);
                          setEditRemark(ev.remark || '');
                        }}
                        className="btn-warning text-xs py-1.5 px-3"
                      >
                        <Upload className="w-3 h-3" /> 补录
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingEv(ev.id);
                          setEditRemark(ev.remark || '');
                        }}
                        className="btn-secondary text-xs py-1.5 px-3"
                      >
                        <Save className="w-3 h-3" /> 编辑
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
