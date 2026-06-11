import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import {
  Download, FileSpreadsheet, Link, CheckCircle2, AlertTriangle,
  Check, RefreshCcw, FileCheck,
} from 'lucide-react';
import { exportApi } from '@/api/client';
import { AbnormalBadge, ModifiedBadge, StatusTag } from '@/components/Tags';
import { useNavigate } from 'react-router-dom';

export default function ExportCenter() {
  const rows = useAppStore((s) => s.exportRows);
  const fetchExport = useAppStore((s) => s.fetchExport);
  const loading = useAppStore((s) => s.loading);
  const nav = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);
  const materialsByCid = useAppStore((s) => s.materialsByCollision);
  const fetchMaterials = useAppStore((s) => s.fetchMaterials);

  useEffect(() => {
    fetchExport();
  }, [fetchExport]);

  useEffect(() => {
    rows.slice(0, 10).forEach((r) => {
      if (!materialsByCid[r.collisionId]) fetchMaterials(r.collisionId);
    });
  }, [rows, materialsByCid, fetchMaterials]);

  function hasModified(cid: string) {
    return materialsByCid[cid]?.some((m) => m.isModifiedSinceLast) ?? false;
  }

  function download() {
    setDownloading(true);
    setDownloadDone(false);
    const a = document.createElement('a');
    a.href = exportApi.csvUrl;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      setDownloading(false);
      setDownloadDone(true);
    }, 1500);
  }

  const stat = {
    total: rows.length,
    abnormal: rows.filter((r) => r.isAbnormal).length,
    resolved: rows.filter((r) => r.status === 'resolved').length,
    waived: rows.filter((r) => r.status === 'waived').length,
  };

  return (
    <div className="max-w-[1600px] mx-auto px-5 py-5">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="title-font text-xl font-semibold text-engineering-navy flex items-center gap-2">
            <FileCheck size={20} />
            导出中心 · 交付设计院助理阿宁
          </h1>
          <p className="text-[12px] text-history-gray mt-0.5">
            CSV 每行都把 BIM 模型备注里的"原始说法" 和当前"处理结论"接在一起，避免封账时反复核对
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchExport()}
            className="eng-btn secondary !py-2 text-xs flex items-center gap-1"
          >
            <RefreshCcw size={12} />
            刷新预览
          </button>
          <button
            onClick={download}
            disabled={downloading}
            className={`eng-btn primary !py-2 text-sm flex items-center gap-1.5 !pl-4 !pr-4 ${
              downloading ? 'opacity-80' : ''
            }`}
          >
            <Download size={14} />
            {downloadDone ? (
              <span className="flex items-center gap-1">
                <Check size={13} /> 已生成下载
              </span>
            ) : downloading ? (
              '正在生成 CSV…'
            ) : (
              '导出 CSV（给阿宁）'
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatCard label="总记录" value={stat.total} color="navy" icon={<FileSpreadsheet size={15} />} />
        <StatCard label="已解决" value={stat.resolved} color="green" icon={<CheckCircle2 size={15} />} />
        <StatCard label="已豁免" value={stat.waived} color="amber" icon={<Link size={15} />} />
        <StatCard label="异常记录" value={stat.abnormal} color="red" icon={<AlertTriangle size={15} />} />
      </div>

      <div className="panel mb-4 !border-engineering-navy/40 bg-blue-50/40">
        <div className="panel-header !bg-engineering-navy !text-white">
          <div className="flex items-center gap-1.5">
            <FileSpreadsheet size={14} />
            <span className="font-semibold text-sm">CSV 字段对照（闭环说明）</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 p-4 text-[12px] text-slate-700">
          <Column title="📌 bimNoteOriginal（BIM 原文）" desc="直接提取自阿宁上传的 BIM 模型备注最新版，和她在 Revit 里写的一字不差">
            <Example ex={`"F3-机电-走廊南侧：风管630x250与结构梁800高碰撞，建议上翻300"`} />
          </Column>
          <Column title="🖊 remark（算法值班人备注）" desc="失焦即保存，实时同步到后端、预览和导出 — 不会出现前后端口径不一">
            <Example ex={`"06-24 13:25 张工：按阿宁口头指示，已上翻400mm避梁"`} />
          </Column>
          <Column title="✅ conclusion（最终结论）" desc="处理结果：和 BIM 原文一行对照，封账时一眼看全">
            <Example ex={`"调整路由，上翻400避梁"`} />
          </Column>
        </div>
      </div>

      <div className="panel !p-0 overflow-hidden">
        <div className="panel-header !border-b-0">
          <div className="flex items-center gap-1.5">
            <FileSpreadsheet size={14} />
            <span className="font-semibold text-sm text-engineering-navy">
              导出预览（共 {rows.length} 行）
            </span>
          </div>
          <div className="text-[11px] text-history-gray">
            实际 CSV 带 UTF-8 BOM · 文件名带时间戳与版本号
          </div>
        </div>
        <table className="eng-table">
          <thead>
            <tr>
              <th style={{ width: 140 }}>碰撞编号</th>
              <th style={{ width: 90 }}>楼层</th>
              <th style={{ width: 90 }}>专业</th>
              <th style={{ width: 80 }}>状态</th>
              <th>BIM 模型原文（来自材料档案 bim_note）</th>
              <th>算法备注</th>
              <th>最终结论</th>
              <th style={{ width: 120 }}>最后修改</th>
            </tr>
          </thead>
          <tbody>
            {loading.export && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-history-gray text-sm">
                  加载导出预览…
                </td>
              </tr>
            )}
            {!loading.export &&
              rows.map((r) => (
                <tr
                  key={r.collisionId}
                  onClick={() => nav(`/collisions/${r.collisionId}`)}
                  className="cursor-pointer"
                >
                  <td className="mono font-semibold text-engineering-navy">
                    <div className="flex flex-col gap-1">
                      <span>#{r.collisionId.slice(-10)}</span>
                      <div className="flex gap-1 flex-wrap">
                        {r.isAbnormal && <AbnormalBadge />}
                        {hasModified(r.collisionId) && <ModifiedBadge />}
                      </div>
                    </div>
                  </td>
                  <td>{r.floor}</td>
                  <td>{r.discipline}</td>
                  <td>
                    <StatusTag status={r.status as any} />
                  </td>
                  <td>
                    <div className="text-[11.5px] mono leading-relaxed max-w-xs line-clamp-2 text-slate-700">
                      {r.bimNoteOriginal || (
                        <span className="text-history-gray">（阿宁尚未上传 BIM 备注）</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="text-[11.5px] mono leading-relaxed max-w-xs line-clamp-2 text-slate-700">
                      {r.remark || <span className="text-history-gray">—</span>}
                    </div>
                  </td>
                  <td>
                    <div className="text-[12px] leading-relaxed max-w-xs line-clamp-2">
                      {r.conclusion || (
                        <span className="text-history-gray italic">未下结论</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="text-[11px] text-slate-600">
                      {new Date(r.lastModifiedAt).toLocaleDateString('zh-CN')}
                    </div>
                    <div className="text-[10px] text-history-gray mono">
                      {r.lastModifiedByName}
                    </div>
                    {r.isAbnormal && r.abnormalReason && (
                      <div className="text-[10px] text-caution-orange mt-1 truncate max-w-[150px]" title={r.abnormalReason}>
                        ⚠ {r.abnormalReason}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Column({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-slate-200 bg-white p-3 rounded-sm">
      <div className="font-semibold text-engineering-navy text-[12px] mb-0.5">{title}</div>
      <div className="text-[11px] text-slate-500 mb-2 leading-relaxed">{desc}</div>
      {children}
    </div>
  );
}
function Example({ ex }: { ex: string }) {
  return (
    <div className="text-[10.5px] mono text-slate-600 bg-slate-50 border border-slate-200 p-2 leading-relaxed">
      {ex}
    </div>
  );
}
function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: 'navy' | 'green' | 'amber' | 'red';
  icon: React.ReactNode;
}) {
  const bg: Record<string, string> = {
    navy: 'from-navy-500 to-engineering-navy',
    green: 'from-green-500 to-audit-green',
    amber: 'from-amber-500 to-orange-500',
    red: 'from-red-500 to-caution-orange',
  };
  return (
    <div className="panel !p-0 overflow-hidden">
      <div className="flex items-center">
        <div
          className={`bg-gradient-to-br ${bg[color]} text-white w-14 h-16 flex items-center justify-center`}
        >
          {icon}
        </div>
        <div className="px-3 py-3 flex-1">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
          <div className="text-2xl font-bold text-engineering-navy title-font">{value}</div>
        </div>
      </div>
    </div>
  );
}
