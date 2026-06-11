import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import {
  ArrowLeft, Save, Camera, FileClock, Layers, AlertTriangle, Plus,
  Shuffle, History as HistoryIcon, Eye,
} from 'lucide-react';
import ViewContextCard from '@/components/ViewContextCard';
import RemarkEditor from '@/components/RemarkEditor';
import MaterialTimeline from '@/components/MaterialTimeline';
import VersionCompare from '@/components/VersionCompare';
import { AbnormalBadge, MaterialTypeTag, StatusTag, ChangeTypeBadge } from '@/components/Tags';
import type { CollisionStatus, MaterialType } from '@shared/types';

export default function CollisionDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const collisions = useAppStore((s) => s.collisions);
  const fetchOne = useAppStore((s) => s.fetchOne);
  const fetchMaterials = useAppStore((s) => s.fetchMaterials);
  const fetchVersions = useAppStore((s) => s.fetchVersions);
  const patchCollision = useAppStore((s) => s.patchCollision);
  const addMaterial = useAppStore((s) => s.addMaterial);
  const materials = useAppStore((s) => s.materialsByCollision)[id] ?? [];
  const versions = useAppStore((s) => s.versionsByCollision)[id] ?? [];
  const user = useAppStore((s) => s.user);

  const c = collisions.find((x) => x.id === id) ?? null;
  const [tab, setTab] = useState<'materials' | 'versions' | 'audit'>('materials');

  const [status, setStatus] = useState<CollisionStatus | ''>('');
  const [conclusion, setConclusion] = useState('');
  const [isAbnormal, setIsAbnormal] = useState(false);
  const [abnormalReason, setAbnormalReason] = useState('');
  const [reason, setReason] = useState('');
  const [reqSave, setReqSave] = useState(false);

  const [newType, setNewType] = useState<MaterialType>('bim_note');
  const [newContent, setNewContent] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    fetchOne(id);
    fetchMaterials(id);
    fetchVersions(id);
  }, [id, fetchOne, fetchMaterials, fetchVersions]);

  useEffect(() => {
    if (c && !reqSave) {
      setStatus(c.status);
      setConclusion(c.conclusion ?? '');
      setIsAbnormal(c.isAbnormal);
      setAbnormalReason(c.abnormalReason ?? '');
    }
  }, [c, reqSave]);

  if (!c) {
    return (
      <div className="max-w-[1200px] mx-auto px-5 py-16 text-center text-history-gray">
        加载碰撞点中…
      </div>
    );
  }

  async function saveHead() {
    if (!user) return;
    const patch: any = { changedBy: user.id, changedByName: user.name };
    if (status && status !== c.status) patch.status = status;
    if (conclusion !== (c.conclusion ?? '')) patch.conclusion = conclusion;
    if (isAbnormal !== c.isAbnormal) patch.isAbnormal = isAbnormal;
    if (abnormalReason !== (c.abnormalReason ?? '')) patch.abnormalReason = abnormalReason;
    const needReason =
      patch.status ||
      patch.conclusion !== undefined ||
      patch.isAbnormal !== undefined;
    if (needReason && !reason.trim()) {
      setReqSave(true);
      setTimeout(() => setReqSave(false), 200);
      return;
    }
    patch.changeReason = reason || undefined;
    if (Object.keys(patch).filter((k) => !['changedBy', 'changedByName', 'changeReason'].includes(k)).length === 0) {
      return;
    }
    await patchCollision(id, patch);
    setReason('');
    setReqSave(false);
  }

  async function submitMaterial() {
    if (!user || !newContent.trim()) return;
    await addMaterial(id, {
      type: newType,
      content: newContent,
      uploader: user.id,
      uploaderName: user.name,
    });
    setNewContent('');
    setAddOpen(false);
  }

  return (
    <div className="max-w-[1600px] mx-auto px-5 py-5">
      <button
        onClick={() => nav('/collisions')}
        className="flex items-center gap-1 text-sm text-engineering-navy hover:underline mb-4"
      >
        <ArrowLeft size={14} />
        返回碰撞点列表
      </button>

      <div className="panel mb-4">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <Camera size={15} className="text-slate-500" />
            <span className="title-font font-semibold text-engineering-navy text-base">
              {c.id}
            </span>
            <StatusTag status={c.status} />
            {c.isAbnormal && <AbnormalBadge />}
            <span className="eng-tag bg-white/60 text-slate-600 border-slate-300 mono">
              <Shuffle size={10} className="inline mr-1" />
              v{c.version}
            </span>
          </div>
          <div className="text-[11px] text-history-gray mono">
            最后修改：{new Date(c.lastModifiedAt).toLocaleString('zh-CN', { hour12: false })} ·{' '}
            {c.lastModifiedByName}（{c.lastModifiedBy}）
          </div>
        </div>
        <div className="p-4">
          <ViewContextCard collision={c} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-7 space-y-4">
          <div className="panel">
            <div className="panel-header">
              <div className="flex items-center gap-1.5">
                <Save size={14} />
                <span className="font-semibold text-sm text-engineering-navy">
                  处理信息（修改会立即同步到后端和导出结果）
                </span>
              </div>
              <button onClick={saveHead} className="eng-btn primary !py-1.5 text-xs">
                保存处理信息
              </button>
            </div>
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 mb-1 block">状态</label>
                  <select
                    className="eng-input text-sm"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                  >
                    <option value="pending">待处理</option>
                    <option value="processing">处理中</option>
                    <option value="resolved">已解决</option>
                    <option value="waived">已豁免</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 mb-1 block">结论</label>
                  <input
                    className="eng-input text-sm"
                    value={conclusion}
                    onChange={(e) => setConclusion(e.target.value)}
                    placeholder="例：调整风管路由；已预留洞；重复碰撞合并"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3 space-y-2">
                <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAbnormal}
                    onChange={(e) => setIsAbnormal(e.target.checked)}
                  />
                  <span className="font-semibold text-caution-orange flex items-center gap-1">
                    <AlertTriangle size={13} />
                    标记为异常记录
                  </span>
                  <span className="text-[10px] text-slate-500">
                    例：重复碰撞、误报、越界、跨月等
                  </span>
                </label>
                {isAbnormal && (
                  <input
                    className="eng-input text-sm border-caution-orange/40"
                    value={abnormalReason}
                    onChange={(e) => setAbnormalReason(e.target.value)}
                    placeholder="【必填】异常原因：为什么这条没有按正常记录走？例：与 CP-2026-06-00018 同坐标，已合并"
                  />
                )}
              </div>

              <div className={`border-t border-slate-200 pt-3 ${reqSave ? 'ring-1 ring-caution-orange/60 rounded p-2 -m-1' : ''}`}>
                <label className="text-[11px] font-semibold text-engineering-navy flex items-center gap-1 mb-1">
                  <Shuffle size={12} />
                  改判原因（改状态/标异常时必填，会写入版本快照和审计历史）
                </label>
                <input
                  className="eng-input text-sm"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="例：设计院助理阿宁13:25口头确认预留洞已放大到800mm，改判为已解决"
                />
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="flex items-center gap-1.5">
                <Eye size={14} />
                <span className="font-semibold text-sm text-engineering-navy">备注（失焦即保存 · 自动同步CSV导出）</span>
              </div>
            </div>
            <div className="p-3">
              <RemarkEditor collisionId={c.id} initialValue={c.remark ?? ''} />
            </div>
          </div>

          {c.isAbnormal && (
            <div className="panel !border-caution-orange/60 bg-caution-orange/5">
              <div className="panel-header !bg-caution-orange/20 !border-caution-orange/40">
                <div className="flex items-center gap-1.5 text-caution-orange">
                  <AlertTriangle size={15} />
                  <span className="font-bold text-sm">异常说明 — 为什么没有按正常记录走</span>
                </div>
              </div>
              <div className="p-3 text-[13px] text-slate-800 whitespace-pre-wrap leading-relaxed">
                {c.abnormalReason || '（已标异常但未填写原因，请在上文补充）'}
              </div>
            </div>
          )}
        </div>

        <div className="col-span-5 space-y-4">
          <div className="panel !p-0">
            <div className="flex border-b border-slate-200">
              {[
                { k: 'materials', label: '材料档案', icon: Layers, count: materials.length },
                { k: 'versions', label: '版本历史 & Diff', icon: FileClock, count: versions.length },
                { k: 'audit', label: '快速审计', icon: HistoryIcon },
              ].map((t) => (
                <button
                  key={t.k}
                  onClick={() => setTab(t.k as any)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-r last:border-r-0 border-slate-200 transition-colors ${
                    tab === t.k
                      ? 'bg-white text-engineering-navy border-b-2 border-b-caution-orange !border-b-caution-orange font-semibold'
                      : 'bg-slate-50 text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <t.icon size={13} />
                  {t.label}
                  {t.count !== undefined && (
                    <span className="eng-tag text-[10px] bg-white/60 border-slate-300 text-slate-600 !py-0 px-1.5">
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-3">
              {tab === 'materials' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-slate-500">阿宁上传的 BIM/边界/口头说明 一览</span>
                    <button
                      onClick={() => setAddOpen((x) => !x)}
                      className="eng-btn secondary !py-1 text-xs flex items-center gap-1"
                    >
                      <Plus size={12} />
                      补录材料
                    </button>
                  </div>
                  {addOpen && (
                    <div className="mb-4 p-3 border border-slate-300 bg-slate-50 space-y-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 mb-1 block">材料类型</label>
                        <select
                          className="eng-input text-sm"
                          value={newType}
                          onChange={(e) => setNewType(e.target.value as any)}
                        >
                          <option value="bim_note">BIM 模型备注</option>
                          <option value="boundary_sample">边界样本</option>
                          <option value="verbal_note">临时口头说明</option>
                          <option value="supplement">补录材料</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 mb-1 block">内容</label>
                        <textarea
                          className="eng-input text-xs mono"
                          rows={4}
                          value={newContent}
                          onChange={(e) => setNewContent(e.target.value)}
                          placeholder="请粘贴/输入材料原文…系统会按内容MD5自动识别是否改过口径"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setAddOpen(false)}
                          className="eng-btn ghost !py-1 text-xs"
                        >
                          取消
                        </button>
                        <button
                          onClick={submitMaterial}
                          className="eng-btn primary !py-1 text-xs"
                        >
                          上传（自动计算MD5并生成快照）
                        </button>
                      </div>
                    </div>
                  )}
                  <MaterialTimeline materials={materials} />
                </div>
              )}

              {tab === 'versions' && (
                <div>
                  <div className="text-[11px] text-slate-500 mb-3">
                    选择两版对比查看字段级 Diff — 包含旧备注/新备注/改判原因
                  </div>
                  {versions.length >= 1 ? (
                    <VersionCompare versions={versions} />
                  ) : (
                    <div className="py-10 text-center text-sm text-history-gray">
                      （暂未发生任何变更）
                    </div>
                  )}
                </div>
              )}

              {tab === 'audit' && (
                <div>
                  <div className="text-[11px] text-slate-500 mb-3">
                    快速查看此碰撞点的变更操作（按时间倒序）
                  </div>
                  <div className="space-y-2">
                    {versions.map((v) => (
                      <div key={v.id} className="panel !py-2 !px-3 flex items-center gap-3">
                        <div className="w-10 text-[10px] mono text-slate-500">v{v.version}</div>
                        <ChangeTypeBadge t={v.changeType} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] text-slate-700 truncate">
                            <span className="font-semibold">{v.changedByName}</span>
                            {v.changeReason && ` · ${v.changeReason}`}
                          </div>
                          <div className="text-[10px] text-history-gray mono">
                            {new Date(v.changedAt).toLocaleString('zh-CN', { hour12: false })}
                          </div>
                        </div>
                      </div>
                    ))}
                    {!versions.length && (
                      <div className="text-center py-8 text-sm text-history-gray">
                        （暂无变更记录）
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
