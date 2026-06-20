import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Wrench, ShieldAlert, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useWorkorderStore } from '@/store/workorderStore';
import SparePartTable from '@/components/table/SparePartTable';
import RecallTimeline from '@/components/exception/RecallTimeline';
import StatusBadge from '@/components/status/StatusBadge';
import { handoverSuggestion } from '@/utils/handover';
import { CATEGORY_EMOJI, STATUS_COLOR_MAP } from '@/constants/enums';

export default function WorkorderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { workorders, getPartsByWorkorder, getRecallsByWorkorder, updateWorkorder, refreshHandoverStatus } =
    useWorkorderStore();

  const workorder = workorders.find(w => w.id === id);
  const parts = useMemo(() => (id ? getPartsByWorkorder(id) : []), [id, getPartsByWorkorder]);
  const recalls = useMemo(() => (id ? getRecallsByWorkorder(id) : []), [id, getRecallsByWorkorder]);

  if (!workorder) {
    return (
      <div className="card p-8 text-center">
        <XCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
        <h2 className="text-xl font-semibold mb-2">未找到工单</h2>
        <p className="text-slate-400 mb-4">工单编号 {id} 不存在</p>
        <button className="btn-ghost" onClick={() => navigate('/')}>返回总览</button>
      </div>
    );
  }

  const suggestion = handoverSuggestion(workorder, parts);
  const statusColor = STATUS_COLOR_MAP[workorder.handover_status];
  const totalAmount = parts.reduce((s, p) => s + (p.req_qty || 0) * (p.price || 0), 0);
  const tempCount = parts.filter(p => p.is_temp).length;
  const exceptionCount = recalls.length;

  const changeStatus = (status: '可放行' | '缺材料待补' | '异常待核' | '待交接') => {
    if (!id) return;
    updateWorkorder(id, { handover_status: status });
    refreshHandoverStatus(id);
  };

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="btn-ghost !px-3 !py-1.5" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" /> 返回
          </button>
          <h1 className="text-2xl font-mono font-bold tracking-tight">
            <span className="text-shield-300">#</span> {workorder.id}
          </h1>
          <StatusBadge status={workorder.handover_status} />
          {workorder.is_duplicate && (
            <span className="badge border-amber-500 bg-amber-500/10 text-amber-300">
              <AlertTriangle className="w-3 h-3" /> 重复导入记录
            </span>
          )}
        </div>
        <Link to="/review" className="btn-ghost">
          <ShieldAlert className="w-4 h-4" /> 异常复核
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <section className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-shield-400" />
              <h2 className="font-semibold">工单基础信息</h2>
            </div>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
              <InfoItem label="设备编号" value={workorder.device_no} mono highlight={workorder.is_duplicate} />
              <InfoItem label="刀盘型号" value={workorder.cutter_model} />
              <InfoItem label="工单类型" value={workorder.work_type} />
              <InfoItem label="施工部位" value={workorder.location} />
              <InfoItem label="工单日期" value={workorder.work_date} />
              <InfoItem label="班组" value={workorder.team} />
              <InfoItem label="工单状态" value={workorder.work_status} />
              <InfoItem label="导入批次" value={workorder.import_batch} mono />
              <InfoItem label="更新时间" value={workorder.updated_at} />
            </dl>
            <div className="mt-5 p-3 border border-slate-600/50 bg-slate-800/40 rounded-sm">
              <div className="flex items-center gap-2 mb-1.5 text-xs uppercase tracking-wider text-slate-400">
                <ShieldAlert className="w-3.5 h-3.5" />
                人工备注（导入时不会被覆盖）
              </div>
              <div className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
                {workorder.handover_note || <span className="text-slate-500 italic">（无备注）</span>}
              </div>
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-shield-400" />
                <h2 className="font-semibold">备件清单</h2>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>共 <strong className="text-slate-200 font-mono">{parts.length}</strong> 项</span>
                {tempCount > 0 && (
                  <span className="text-violet-300">含 <strong className="font-mono">{tempCount}</strong> 项临时材料</span>
                )}
                <span>申报总价 <strong className="text-emerald-300 font-mono">¥{totalAmount.toLocaleString()}</strong></span>
              </div>
            </div>
            {parts.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">未关联备件清单</div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <SparePartTable parts={parts} />
              </div>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="card p-5 border-t-4" style={{ borderTopColor: 'currentColor' }}>
            <div className={statusColor.replace('bg-', 'text-')}>
              <h2 className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> 交接状态判定
              </h2>
            </div>
            <div className={`mt-3 px-4 py-3 rounded-sm border ${statusColor}/20 border-current ${statusColor.replace('bg-', 'border-')}`}>
              <div className="font-mono text-lg font-bold">{workorder.handover_status}</div>
              <div className="text-sm mt-1 text-slate-300">{suggestion}</div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className={`btn !py-1.5 text-xs ${workorder.handover_status === '可放行' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => changeStatus('可放行')}
              >✅ 可放行</button>
              <button
                className={`btn !py-1.5 text-xs ${workorder.handover_status === '缺材料待补' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => changeStatus('缺材料待补')}
              >🟠 缺材料待补</button>
              <button
                className={`btn !py-1.5 text-xs ${workorder.handover_status === '异常待核' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => changeStatus('异常待核')}
              >🔴 异常待核</button>
              <button
                className={`btn !py-1.5 text-xs ${workorder.handover_status === '待交接' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => changeStatus('待交接')}
              >⏳ 待交接</button>
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <h2 className="font-semibold">撤回 / 异常记录</h2>
              </div>
              <span className="text-xs text-slate-400 font-mono">{exceptionCount} 条</span>
            </div>
            {recalls.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">无异常撤回记录</div>
            ) : (
              <RecallTimeline workorderId={workorder.id} />
            )}
            {exceptionCount > 0 && (
              <div className="mt-3 text-xs text-slate-400">
                {CATEGORY_EMOJI.公式问题} 公式 &nbsp;
                {CATEGORY_EMOJI.单位问题} 单位 &nbsp;
                {CATEGORY_EMOJI.阈值问题} 阈值 &nbsp;
                三类问题分别留痕，未藏在备注中
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-slate-500 mb-0.5">{label}</dt>
      <dd
        className={`${mono ? 'font-mono' : ''} ${highlight ? 'text-amber-300 font-semibold duplicate-stripe px-1.5 -mx-1.5 inline-block rounded-sm' : 'text-slate-200'}`}
      >
        {value || '—'}
      </dd>
    </div>
  );
}
