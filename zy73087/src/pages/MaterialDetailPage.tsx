import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  GitCompareArrows,
  FileText,
  Layers,
  AlertTriangle,
  RefreshCw,
  Save,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { api } from '@/api/client';
import { StatusBadge, formatDate } from '@/components/common/Badges';
import { HistoryTimeline } from '@/components/common/HistoryTimeline';
import { RejudgeModal } from '@/components/modals/RejudgeModal';
import type { MaterialStatus } from '../../shared/types';
import { STATUS_LABELS } from '../../shared/types';
import { clsx } from 'clsx';

type TabKey = 'info' | 'rejudge' | 'cad' | 'change' | 'history';

function InfoItem({ label, value, highlight }: { label: string; value?: React.ReactNode; highlight?: boolean }) {
  const isEmpty = value === undefined || value === null || value === '';
  return (
    <div className="py-2">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={clsx(
        'text-sm',
        highlight ? 'font-semibold text-slate-900' : 'text-slate-700',
        isEmpty && 'text-slate-400 italic',
      )}>
        {isEmpty ? '（未填写）' : value}
      </div>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  subtitle,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className={clsx('px-5 py-3 flex items-center gap-2.5 border-b border-slate-200', accent || 'bg-slate-50')}>
        <div className="text-slate-600">{icon}</div>
        <div className="flex-1">
          <div className="font-semibold text-slate-800 text-sm">{title}</div>
          {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function MaterialDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialTab = (params.get('tab') as TabKey) || 'info';

  const fetchDetail = useAppStore(s => s.fetchMaterialDetail);
  const material = useAppStore(s => s.selectedMaterial);
  const history = useAppStore(s => s.selectedMaterialHistory);
  const loading = useAppStore(s => s.loading);

  const [tab, setTab] = useState<TabKey>(initialTab);
  const [rejudgeOpen, setRejudgeOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // CAD表单
  const [cadNote, setCadNote] = useState('');
  const [cadJudgmentChange, setCadJudgmentChange] = useState('');
  const [cadSaving, setCadSaving] = useState(false);

  // 变更单表单
  const [changeNo, setChangeNo] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [changeImpact, setChangeImpact] = useState('');
  const [changeSaving, setChangeSaving] = useState(false);

  // 人工备注
  const [manualNote, setManualNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  useEffect(() => {
    if (id) fetchDetail(id);
  }, [id, fetchDetail]);

  useEffect(() => {
    if (initialTab === 'rejudge' && material) setRejudgeOpen(true);
  }, [initialTab, material]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (material) {
      setCadNote(material.cadNote);
      setCadJudgmentChange(material.cadJudgmentChange);
      setChangeNo(material.changeOrderNo);
      setChangeReason(material.changeOrderReason);
      setChangeImpact(material.changeOrderImpact);
      setManualNote(material.manualNote);
    }
  }, [material?.id]);

  if (!material && loading) {
    return (
      <div className="text-center py-20 text-slate-500">
        <div className="inline-flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-[#1e3a5f] rounded-full animate-spin" />
          加载材料详情...
        </div>
      </div>
    );
  }

  if (!material) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-500" />
        <div className="text-slate-700 mb-4">未找到该材料，或已被删除</div>
        <button onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white hover:bg-[#152a47]">
          <ArrowLeft className="w-4 h-4" /> 返回列表
        </button>
      </div>
    );
  }

  const statusColor: Record<MaterialStatus, string> = {
    pending: 'from-amber-400/20 to-transparent border-amber-300',
    normal: 'from-teal-400/20 to-transparent border-teal-300',
    rejudged: 'from-blue-400/20 to-transparent border-blue-300',
    changing: 'from-purple-400/20 to-transparent border-purple-300',
    archived: 'from-slate-300/30 to-transparent border-slate-300',
  };

  const saveCadNote = async () => {
    setCadSaving(true);
    try {
      await api.updateCadNote(material.id, { cadNote, cadJudgmentChange, operator: '阿宁' });
      setToast({ type: 'success', msg: 'CAD图层备注已保存，已写入历史记录' });
      await fetchDetail(material.id);
    } catch (e: any) {
      setToast({ type: 'error', msg: '保存失败：' + e.message });
    } finally {
      setCadSaving(false);
    }
  };

  const saveChangeOrder = async () => {
    if (!changeNo.trim() || !changeReason.trim() || !changeImpact.trim()) {
      setToast({ type: 'error', msg: '变更单号、确认理由、影响范围三项必填' });
      return;
    }
    setChangeSaving(true);
    try {
      await api.updateChangeOrder(material.id, {
        changeOrderNo: changeNo.trim(),
        changeOrderReason: changeReason.trim(),
        changeOrderImpact: changeImpact.trim(),
        operator: '阿宁',
      });
      setToast({ type: 'success', msg: '变更单补录完成，理由和影响范围已保留在结果中' });
      await fetchDetail(material.id);
    } catch (e: any) {
      setToast({ type: 'error', msg: '保存失败：' + e.message });
    } finally {
      setChangeSaving(false);
    }
  };

  const saveManualNote = async () => {
    setNoteSaving(true);
    try {
      await api.updateMaterial(material.id, { manualNote });
      setToast({ type: 'success', msg: '人工备注已保存（后续重复导入不会覆盖）' });
      await fetchDetail(material.id);
    } catch (e: any) {
      setToast({ type: 'error', msg: '保存失败：' + e.message });
    } finally {
      setNoteSaving(false);
    }
  };

  const exportCsv = async () => {
    try {
      const blob = await api.csvExport();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const d = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      a.download = `材料明细_${material.materialCode}_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setToast({ type: 'error', msg: '导出失败：' + e.message });
    }
  };

  const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode; condition?: boolean }> = [
    { key: 'info', label: '基本信息', icon: <FileText className="w-4 h-4" /> },
    { key: 'rejudge', label: '改判操作', icon: <GitCompareArrows className="w-4 h-4" /> },
    { key: 'cad', label: 'CAD图层备注', icon: <Layers className="w-4 h-4" /> },
    { key: 'change', label: '变更单补录', icon: <RefreshCw className="w-4 h-4" /> },
    { key: 'history', label: '操作历史', icon: <FileText className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> 返回列表
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: '"Source Han Serif SC", serif' }}>
                {material.materialName}
              </h1>
              <StatusBadge status={material.status} />
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span className="font-mono">{material.materialCode}</span>
              <span>·</span>
              <span>{material.projectName || '未分配项目'}</span>
              <span>·</span>
              <span>更新于 {formatDate(material.updatedAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" /> 导出该条CSV明细
          </button>
          <button
            onClick={() => setRejudgeOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1e3a5f] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#152a47] transition-colors shadow-sm"
          >
            <GitCompareArrows className="w-4 h-4" /> 状态改判
          </button>
        </div>
      </div>

      <div className={`rounded-xl border-2 bg-gradient-to-br ${statusColor[material.status]} p-5`}>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          <InfoItem label="当前状态" value={<StatusBadge status={material.status} />} highlight />
          <InfoItem label="数量 / 单位" value={`${material.quantity} ${material.unit}`} highlight />
          <InfoItem label="规格型号" value={material.specification} />
          <InfoItem label="CAD图层号" value={material.layerCode} />
          <InfoItem label="图纸位置" value={material.position} />
          <InfoItem label="导入批次" value={material.importBatchNo || '（手动录入）'} />
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200 px-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.key
                ? 'text-[#1e3a5f] border-[#1e3a5f]'
                : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard icon={<FileText className="w-4 h-4" />} title="材料完整信息">
            <div className="grid grid-cols-2 gap-x-6">
              <InfoItem label="材料编号" value={<span className="font-mono">{material.materialCode}</span>} />
              <InfoItem label="材料名称" value={material.materialName} highlight />
              <InfoItem label="规格型号" value={material.specification} />
              <InfoItem label="计量单位" value={material.unit} />
              <InfoItem label="所属项目" value={material.projectName} />
              <InfoItem label="导入批次号" value={material.importBatchNo || '-'} />
              <InfoItem label="CAD图层" value={material.layerCode} />
              <InfoItem label="图纸位置" value={material.position} />
              <InfoItem label="碰撞点说明" value={material.collisionPoint} />
              <InfoItem label="创建时间" value={formatDate(material.createdAt)} />
              <InfoItem label="最后更新" value={formatDate(material.updatedAt)} />
              <InfoItem label="当前状态" value={<StatusBadge status={material.status} />} />
            </div>
          </SectionCard>

          <SectionCard
            icon={<AlertTriangle className="w-4 h-4 text-teal-600" />}
            title="人工备注"
            subtitle="注：此处填写的备注在CSV重复导入时不会被覆盖"
            accent="bg-teal-50"
          >
            <textarea
              value={manualNote}
              onChange={e => setManualNote(e.target.value)}
              rows={6}
              placeholder="填写人工备注，例如：现场清点数量无误；与监理确认过；材料批次报告已存档等。重复导入CSV时此段文字将原样保留。"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
            />
            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-slate-500">
                {material.manualNote && (
                  <span className="inline-flex items-center gap-1 text-teal-700">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 已存在人工备注，重复导入会自动保留
                  </span>
                )}
              </div>
              <button
                onClick={saveManualNote}
                disabled={noteSaving || manualNote === material.manualNote}
                className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                {noteSaving ? '保存中...' : '保存备注'}
              </button>
            </div>
          </SectionCard>

          {(material.cadNote || material.cadJudgmentChange) && (
            <SectionCard
              icon={<Layers className="w-4 h-4 text-amber-600" />}
              title="CAD图层备注（灰度补充）"
              subtitle="记录从CAD图层观察到的判断变化"
              accent="bg-amber-50"
            >
              <InfoItem label="CAD图层备注" value={material.cadNote} />
              <div className="border-t border-slate-100 mt-2 pt-2" />
              <InfoItem label="改变了哪些判断" value={material.cadJudgmentChange} highlight />
            </SectionCard>
          )}

          {material.changeOrderNo && (
            <SectionCard
              icon={<RefreshCw className="w-4 h-4 text-purple-600" />}
              title="变更单补录（晚到处理）"
              subtitle="晚到的变更单及人工确认记录"
              accent="bg-purple-50"
            >
              <div className="grid grid-cols-1 gap-x-6">
                <InfoItem label="变更单号" value={<span className="font-mono">{material.changeOrderNo}</span>} highlight />
                <InfoItem label="人工确认理由" value={material.changeOrderReason} />
                <InfoItem label="影响范围" value={material.changeOrderImpact} />
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {tab === 'rejudge' && (
        <SectionCard
          icon={<GitCompareArrows className="w-4 h-4 text-blue-600" />}
          title="状态改判"
          subtitle="变更材料状态时必须填写理由，所有改判操作写入历史记录"
          accent="bg-blue-50"
        >
          <div className="space-y-5">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-sm text-slate-600">当前状态：</div>
              <StatusBadge status={material.status} />
              <button
                onClick={() => setRejudgeOpen(true)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white hover:bg-[#152a47]"
              >
                <GitCompareArrows className="w-4 h-4" /> 发起改判
              </button>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-700 mb-2">改判前后历史预览：</div>
              {history.filter(h => h.action === 'rejudge').length === 0 ? (
                <div className="text-sm text-slate-400 italic p-4 border border-dashed border-slate-200 rounded-lg text-center">
                  暂无改判记录
                </div>
              ) : (
                <HistoryTimeline history={history.filter(h => h.action === 'rejudge')} compact />
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {tab === 'cad' && (
        <SectionCard
          icon={<Layers className="w-4 h-4 text-amber-600" />}
          title="CAD图层备注（灰度发布临时补充）"
          subtitle="说明从CAD图层中观察到的内容，以及它改变了原清单的哪些判断"
          accent="bg-amber-50"
        >
          <div className="space-y-5">
            <div className="rounded-lg border-2 border-amber-200 bg-gradient-to-br from-amber-50/70 to-white p-4">
              <div className="text-xs font-semibold text-amber-900 mb-1">💡 灰度说明</div>
              <p className="text-sm text-amber-800 leading-relaxed">
                阿宁在CAD图层上能拼出材料主线，但碰撞点截图离开视角就说不清。
                请在此记录每一次CAD图层观察发现的<strong>具体图层号、碰撞位置、原清单判断</strong>以及
                <strong>改变后的新判断</strong>，这些信息会自动写入历史记录，后续改判和对账都可以引用。
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">CAD图层备注内容</label>
              <textarea
                value={cadNote}
                onChange={e => setCadNote(e.target.value)}
                rows={4}
                placeholder="例如：LAYER-CFRP-03图层上3层B区梁底，碰撞点靠近水管，原清单宽度100mm与CAD实际标注50mm不一致..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                它改变了哪些判断 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={cadJudgmentChange}
                onChange={e => setCadJudgmentChange(e.target.value)}
                rows={4}
                placeholder="例如：1. 原判断材料数量120m²，现调整为150m²；2. 原状态正常，现需改判为变更中；3. 原图层编号LAYER-CFRP-01与实际LAYER-CFRP-03不一致..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
              />
            </div>

            <div className="flex items-center justify-end">
              <button
                onClick={saveCadNote}
                disabled={cadSaving}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4" />
                {cadSaving ? '保存中...' : '保存CAD备注（写入历史）'}
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      {tab === 'change' && (
        <SectionCard
          icon={<RefreshCw className="w-4 h-4 text-purple-600" />}
          title="变更单晚到补录"
          subtitle="变更单到达时间晚于材料录入时，必须在此补录人工确认理由和影响范围"
          accent="bg-purple-50"
        >
          <div className="space-y-5">
            <div className="rounded-lg border-2 border-purple-200 bg-gradient-to-br from-purple-50/70 to-white p-4">
              <div className="text-xs font-semibold text-purple-900 mb-1">📋 晚到变更处理规则</div>
              <ol className="text-sm text-purple-800 leading-relaxed space-y-1 list-decimal list-inside">
                <li>变更单号必填，便于后续与纸质单据对账</li>
                <li>人工确认理由必须写清是谁确认、通过什么方式、何时确认</li>
                <li>影响范围要具体到楼层、区域、涉及其他哪些材料、是否影响工期</li>
                <li>所有补录内容自动写入历史记录，后续CSV导出会一并带出</li>
              </ol>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  变更单号 <span className="text-red-500">*</span>
                </label>
                <input
                  value={changeNo}
                  onChange={e => setChangeNo(e.target.value)}
                  placeholder="例如：BG-2024-05-12-003"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30 font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  人工确认理由 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={changeReason}
                  onChange={e => setChangeReason(e.target.value)}
                  rows={3}
                  placeholder="例如：5月12日下午与结构工程师王工通过腾讯会议口头确认，晚到原因是设计方走盖章流程延误，次日补传纸质版。"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  影响范围 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={changeImpact}
                  onChange={e => setChangeImpact(e.target.value)}
                  rows={3}
                  placeholder="例如：影响3层B区CFRP-03~05梁共3根梁，增加碳纤维布约30m²，工期预计顺延1天，与JG-2024-005材料批次相关。"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                onClick={saveChangeOrder}
                disabled={changeSaving}
                className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4" />
                {changeSaving ? '保存中...' : '补录变更单（写入历史）'}
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      {tab === 'history' && (
        <SectionCard
          icon={<FileText className="w-4 h-4" />}
          title={`操作历史（共 ${history.length} 条）`}
          subtitle="所有操作均留痕，重启后仍可查看，CSV导出会与当前状态互相印证"
        >
          <HistoryTimeline history={history} />
        </SectionCard>
      )}

      <RejudgeModal
        open={rejudgeOpen}
        onClose={() => setRejudgeOpen(false)}
        materialId={material.id}
        materialCode={material.materialCode}
        currentStatus={material.status}
      />

      {toast && (
        <div className={clsx(
          'fixed bottom-6 right-6 z-50 rounded-lg shadow-xl px-5 py-3 flex items-center gap-2 animate-[fadeIn_.2s_ease-out]',
          toast.type === 'success' ? 'bg-teal-600 text-white' : 'bg-red-600 text-white',
        )}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

export default MaterialDetailPage;
