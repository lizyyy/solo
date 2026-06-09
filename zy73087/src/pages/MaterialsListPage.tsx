import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Upload, Plus, Eye, GitCompareArrows, Layers, FileText, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { StatusBadge, formatDate } from '@/components/common/Badges';
import { StatsCards } from '@/components/common/StatsCards';
import { CsvImportModal } from '@/components/modals/CsvImportModal';
import type { MaterialStatus, CsvImportResult } from '../../shared/types';
import { clsx } from 'clsx';

function MaterialsListPage() {
  const navigate = useNavigate();
  const fetchStats = useAppStore(s => s.fetchStats);
  const fetchMaterials = useAppStore(s => s.fetchMaterials);
  const stats = useAppStore(s => s.stats);
  const materials = useAppStore(s => s.materials);
  const total = useAppStore(s => s.materialsTotal);
  const loading = useAppStore(s => s.loading);
  const lastError = useAppStore(s => s.lastError);
  const setError = useAppStore(s => s.setError);

  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<MaterialStatus | undefined>();
  const [project, setProject] = useState('');
  const [layer, setLayer] = useState('');
  const [page, setPage] = useState(1);
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const pageSize = 20;

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    setPage(1);
  }, [keyword, status, project, layer]);

  useEffect(() => {
    fetchMaterials({ keyword, status, project, layer, page, pageSize });
  }, [keyword, status, project, layer, page, fetchMaterials]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleImportSuccess = (r: CsvImportResult) => {
    setToast({
      type: 'success',
      msg: `导入完成：新增${r.newCount}条，更新${r.updatedCount}条，跳过${r.skippedCount}条`,
    });
    fetchStats();
  };

  const projects = Array.from(new Set(materials.map(m => m.projectName).filter(Boolean)));
  const layers = Array.from(new Set(materials.map(m => m.layerCode).filter(Boolean)));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: '"Source Han Serif SC", serif' }}>
            结构加固材料追踪 · 总览
          </h1>
          <p className="text-sm text-slate-500 mt-1">从CAD图层拼出材料主线，碰撞点和变更有迹可循</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => alert('新增材料功能：请通过CSV批量导入或联系管理员开启单条录入')}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Plus className="w-4 h-4" /> 单条新增
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1e3a5f] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#152a47] transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" /> 导入CSV
          </button>
        </div>
      </div>

      <StatsCards stats={stats} onSelectStatus={setStatus} activeStatus={status} />

      {lastError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">操作出现问题</div>
            <div>{lastError}</div>
          </div>
          <button
            className="ml-auto text-xs text-red-600 hover:underline"
            onClick={() => setError(null)}
          >
            关闭
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-br from-slate-50 to-white">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="搜索：材料编号/名称/规格/位置"
                className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]/30"
              />
            </div>
            <select
              value={project}
              onChange={e => setProject(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]/30"
            >
              <option value="">全部项目</option>
              {projects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              value={layer}
              onChange={e => setLayer(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]/30"
            >
              <option value="">全部CAD图层</option>
              {layers.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <button
              onClick={() => { setKeyword(''); setProject(''); setLayer(''); setStatus(undefined); setPage(1); }}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              重置筛选
            </button>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200/60">
            <div className="text-xs text-slate-500">
              共 <span className="font-semibold text-slate-700">{total}</span> 条记录
              {(keyword || status || project || layer) && <span className="ml-1">（已筛选）</span>}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3 font-semibold">材料编号</th>
                <th className="text-left px-5 py-3 font-semibold">材料名称 / 规格</th>
                <th className="text-left px-5 py-3 font-semibold">数量</th>
                <th className="text-left px-5 py-3 font-semibold">项目 / 图层</th>
                <th className="text-left px-5 py-3 font-semibold">状态</th>
                <th className="text-left px-5 py-3 font-semibold">特殊标记</th>
                <th className="text-left px-5 py-3 font-semibold">更新时间</th>
                <th className="text-right px-5 py-3 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-slate-400">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-[#1e3a5f] rounded-full animate-spin" />
                      加载中...
                    </div>
                  </td>
                </tr>
              ) : materials.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    暂无数据，点击右上角「导入CSV」添加材料
                  </td>
                </tr>
              ) : (
                materials.map(m => {
                  const hasCad = m.cadNote || m.cadJudgmentChange;
                  const hasChange = m.changeOrderNo;
                  const hasCollision = m.collisionPoint;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-5 py-3.5 font-mono text-xs font-medium text-[#1e3a5f]">
                        {m.materialCode}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-900">{m.materialName}</div>
                        {m.specification && (
                          <div className="text-xs text-slate-500 mt-0.5">{m.specification}</div>
                        )}
                        {m.position && (
                          <div className="text-xs text-slate-400 mt-0.5">📍 {m.position}</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-slate-800">{m.quantity}</span>
                        <span className="text-xs text-slate-500 ml-1">{m.unit}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-slate-700 text-xs">{m.projectName || '-'}</div>
                        {m.layerCode && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            <Layers className="w-3 h-3" />{m.layerCode}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={m.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {hasCad && (
                            <span title={`CAD备注: ${m.cadNote}`} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              CAD
                            </span>
                          )}
                          {hasChange && (
                            <span title={`变更单: ${m.changeOrderNo}`} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                              变更
                            </span>
                          )}
                          {hasCollision && (
                            <span title={`碰撞点: ${m.collisionPoint}`} className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                              碰撞
                            </span>
                          )}
                          {m.manualNote && (
                            <span title={`人工备注: ${m.manualNote}`} className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                              备注
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">
                        {formatDate(m.updatedAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => navigate(`/materials/${m.id}`)}
                            className="rounded p-1.5 hover:bg-[#1e3a5f]/10 text-slate-600 hover:text-[#1e3a5f] transition-colors"
                            title="查看详情 / 改判"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/materials/${m.id}?tab=rejudge`)}
                            className="rounded p-1.5 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors"
                            title="快速改判"
                          >
                            <GitCompareArrows className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50/50">
            <div className="text-xs text-slate-500">
              第 {page} / {totalPages} 页
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className={clsx(
                  'rounded px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                  'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
                )}
              >
                上一页
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 5) p = i + 1;
                else if (page <= 3) p = i + 1;
                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                else p = page - 2 + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={clsx(
                      'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                      page === p
                        ? 'bg-[#1e3a5f] text-white'
                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
                    )}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={clsx(
                  'rounded px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                  'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
                )}
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      <CsvImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={handleImportSuccess}
      />

      {toast && (
        <div className={clsx(
          'fixed bottom-6 right-6 z-50 rounded-lg shadow-xl px-5 py-3 flex items-center gap-2 animate-[fadeIn_.2s_ease-out]',
          toast.type === 'success' ? 'bg-teal-600 text-white' : 'bg-red-600 text-white',
        )}>
          {toast.type === 'success' ? <FileText className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

export default MaterialsListPage;
