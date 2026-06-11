import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import {
  History, Search, Filter, ArrowRight, User, Clock, AlertTriangle,
  ShieldCheck, FileEdit, Tag,
} from 'lucide-react';
import { ChangeTypeBadge } from '@/components/Tags';
import { useNavigate } from 'react-router-dom';
import type { AuditLog } from '@shared/types';

export default function AuditHistory() {
  const audits = useAppStore((s) => s.audits);
  const fetchAudits = useAppStore((s) => s.fetchAudits);
  const loading = useAppStore((s) => s.loading);
  const nav = useNavigate();

  const [kw, setKw] = useState('');
  const [operator, setOperator] = useState('');
  const [type, setType] = useState<string>('');

  useEffect(() => {
    fetchAudits();
  }, [fetchAudits]);

  const byDay = new Map<string, AuditLog[]>();
  for (const a of audits) {
    const d = new Date(a.timestamp).toLocaleDateString('zh-CN');
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(a);
  }
  const days = [...byDay.keys()].sort((a, b) => +new Date(b) - +new Date(a));

  const operators = Array.from(new Set(audits.map((a) => a.operatorName)));
  const types = Array.from(new Set(audits.map((a) => a.action)));

  function visible(a: AuditLog) {
    if (operator && a.operatorName !== operator) return false;
    if (type && a.action !== type) return false;
    if (kw) {
      const k = kw.toLowerCase();
      if (
        !a.collisionId.toLowerCase().includes(k) &&
        !a.detail.toLowerCase().includes(k) &&
        !(a.reason ?? '').toLowerCase().includes(k)
      )
        return false;
    }
    return true;
  }

  return (
    <div className="max-w-[1400px] mx-auto px-5 py-5">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="title-font text-xl font-semibold text-engineering-navy flex items-center gap-2">
            <ShieldCheck size={20} />
            审计历史 · 交接班追溯
          </h1>
          <p className="text-[12px] text-history-gray mt-0.5">
            下一班同事可以在这里追到设计院助理阿宁那次临时改判、夜班李工补录、以及为什么标记异常
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="eng-tag bg-slate-100 text-slate-700 border-slate-300">
            共 {audits.length} 条
          </span>
        </div>
      </div>

      <div className="panel mb-4">
        <div className="panel-header">
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-slate-500" />
            <span className="font-semibold text-sm text-engineering-navy">审计筛选</span>
          </div>
        </div>
        <div className="p-3 grid grid-cols-12 gap-3 items-end">
          <div className="col-span-5">
            <label className="text-[11px] text-slate-500 mb-1 block">关键词</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="eng-input pl-8 text-sm"
                value={kw}
                onChange={(e) => setKw(e.target.value)}
                placeholder="碰撞编号 / 详情 / 原因…"
              />
            </div>
          </div>
          <div className="col-span-3">
            <label className="text-[11px] text-slate-500 mb-1 block">操作人</label>
            <select
              className="eng-input text-sm"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
            >
              <option value="">全部</option>
              {operators.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-3">
            <label className="text-[11px] text-slate-500 mb-1 block">变更类型</label>
            <select
              className="eng-input text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">全部</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-1">
            <button
              onClick={() => {
                setKw('');
                setOperator('');
                setType('');
              }}
              className="eng-btn secondary w-full !py-2 text-xs"
            >
              重置
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {loading.audits && (
          <div className="panel py-10 text-center text-sm text-history-gray">加载中…</div>
        )}
        {days.map((d) => {
          const arr = byDay.get(d)!.filter(visible);
          if (!arr.length) return null;
          return (
            <div key={d}>
              <div className="flex items-center gap-2 mb-2.5 pl-1">
                <div className="w-7 h-7 rounded-sm bg-engineering-navy text-white flex items-center justify-center text-[11px] font-semibold title-font">
                  {d.split('/')[2] ?? d.split('-')[2] ?? '·'}
                </div>
                <div className="text-sm font-semibold text-engineering-navy">{d}</div>
                <div className="text-[10px] text-history-gray mono">
                  {arr.length} 条操作
                </div>
              </div>
              <div className="relative pl-6 border-l-2 border-slate-200 ml-3 space-y-3">
                {arr.map((a, idx) => (
                  <div
                    key={a.id}
                    className="relative panel cursor-pointer hover:ring-1 hover:ring-engineering-navy/30"
                    onClick={() => nav(`/collisions/${a.collisionId}`)}
                  >
                    <div
                      className={`absolute -left-[24px] top-3 w-3.5 h-3.5 rounded-full border-2 border-white`}
                      style={{ background: a.actionBadgeColor ?? '#64748b' }}
                    />
                    <div className="panel-header">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="text-xs mono font-semibold text-engineering-navy"
                          title={`${a.collisionId}`}
                        >
                          #{a.collisionId.slice(-8)}
                        </span>
                        <ActionBadge action={a.action} color={a.actionBadgeColor} />
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 mono shrink-0">
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {new Date(a.timestamp).toLocaleTimeString('zh-CN', { hour12: false })}
                        </span>
                      </div>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="text-[12px] text-slate-800 flex items-start gap-2">
                        <div className="w-6 h-6 rounded-sm bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                          <User size={12} className="text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <div>
                            <span className="font-semibold">{a.operatorName}</span>
                            <span className="mono text-history-gray ml-1.5 text-[10px]">
                              · {a.operator}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                            {a.detail}
                          </div>
                        </div>
                      </div>
                      {a.reason && (
                        <div className="ml-8 border-l-2 border-caution-orange pl-2.5 py-0.5 text-[11px] text-caution-orange bg-caution-orange/5">
                          <span className="font-semibold flex items-center gap-1">
                            <AlertTriangle size={11} /> 变更原因：
                          </span>
                          {a.reason}
                        </div>
                      )}
                      <div className="text-right text-[10px] text-history-gray">
                        → 点击跳转到碰撞点详情
                        <ArrowRight size={10} className="inline ml-0.5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {!loading.audits && [...byDay.values()].every((arr) => !arr.filter(visible).length) && (
          <div className="panel py-10 text-center text-sm text-history-gray">
            无符合条件的审计记录
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBadge({ action, color }: { action: string; color?: string }) {
  const style = color
    ? { background: `${color}20`, borderColor: color, color }
    : undefined;
  return (
    <span
      className="eng-tag text-[11px] font-medium"
      style={style ?? {}}
    >
      <Tag size={10} className="inline mr-0.5" />
      {action}
    </span>
  );
}
