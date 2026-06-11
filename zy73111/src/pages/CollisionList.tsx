import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Filter, ArrowRight, AlertTriangle, FileText, Layers, Clock,
} from 'lucide-react';
import { AbnormalBadge, StatusTag, ModifiedBadge } from '@/components/Tags';
import ViewContextCard from '@/components/ViewContextCard';
import type { Collision, CollisionStatus } from '@shared/types';

export default function CollisionList() {
  const fetchCollisions = useAppStore((s) => s.fetchCollisions);
  const collisions = useAppStore((s) => s.collisions);
  const loading = useAppStore((s) => s.loading);
  const [q, setQ] = useSearchParams();
  const navigate = useNavigate();
  const materialsByCid = useAppStore((s) => s.materialsByCollision);
  const fetchMaterials = useAppStore((s) => s.fetchMaterials);

  const [keyword, setKeyword] = useState(q.get('k') ?? '');
  const [status, setStatus] = useState<CollisionStatus | 'all'>(
    (q.get('status') as CollisionStatus | 'all') ?? 'all',
  );
  const [onlyAbnormal, setOnlyAbnormal] = useState(q.get('ab') === '1');
  const [onlyModified, setOnlyModified] = useState(q.get('md') === '1');
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    const s: any = {};
    if (status && status !== 'all') s.status = status;
    if (onlyAbnormal) s.isAbnormal = '1';
    fetchCollisions(Object.keys(s).length ? s : undefined);
  }, [fetchCollisions, status, onlyAbnormal]);

  useEffect(() => {
    if (previewId && !materialsByCid[previewId]) fetchMaterials(previewId);
  }, [previewId, materialsByCid, fetchMaterials]);

  function applyFilter() {
    const params: any = {};
    if (keyword) params.k = keyword;
    if (status !== 'all') params.status = status;
    if (onlyAbnormal) params.ab = '1';
    if (onlyModified) params.md = '1';
    setQ(params);
  }

  function hasModified(c: Collision) {
    const ms = materialsByCid[c.id];
    return ms?.some((m) => m.isModifiedSinceLast) ?? false;
  }

  const list = collisions.filter((c) => {
    if (keyword) {
      const k = keyword.toLowerCase();
      if (
        !c.id.toLowerCase().includes(k) &&
        !c.floor.toLowerCase().includes(k) &&
        !c.discipline.toLowerCase().includes(k) &&
        !(c.conclusion ?? '').toLowerCase().includes(k) &&
        !(c.remark ?? '').toLowerCase().includes(k)
      )
        return false;
    }
    if (onlyModified && !hasModified(c)) return false;
    return true;
  });

  const preview = list.find((c) => c.id === previewId) ?? null;

  return (
    <div className="max-w-[1600px] mx-auto px-5 py-5">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="title-font text-xl font-semibold text-engineering-navy">
            碰撞点列表 · 共 {list.length} 条
          </h1>
          <p className="text-[12px] text-history-gray mt-0.5">
            悬浮在一行上即可看到完整视角参数截图，点击查看材料档案、版本历史、改判审计链
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-1 eng-tag bg-blue-50 text-blue-700 border-blue-300">
            <Layers size={12} />
            {list.filter((c) => c.version > 1).length} 条含版本变更
          </span>
          <span className="flex items-center gap-1 eng-tag bg-red-50 text-red-700 border-red-300">
            <AlertTriangle size={12} />
            {list.filter((c) => c.isAbnormal).length} 条异常记录
          </span>
        </div>
      </div>

      <div className="panel mb-4">
        <div className="panel-header">
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-slate-500" />
            <span className="font-semibold text-sm text-engineering-navy">筛选条件</span>
          </div>
        </div>
        <div className="p-3 grid grid-cols-12 gap-3 items-end">
          <div className="col-span-5">
            <label className="text-[11px] text-slate-500 mb-1 block">关键词</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="eng-input pl-8 text-sm"
                placeholder="搜索编号、楼层、专业、结论、备注…"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
              />
            </div>
          </div>
          <div className="col-span-2">
            <label className="text-[11px] text-slate-500 mb-1 block">状态</label>
            <select
              className="eng-input text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="all">全部</option>
              <option value="pending">待处理</option>
              <option value="processing">处理中</option>
              <option value="resolved">已解决</option>
              <option value="waived">已豁免</option>
            </select>
          </div>
          <div className="col-span-2 flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[12px] text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyAbnormal}
                onChange={(e) => setOnlyAbnormal(e.target.checked)}
              />
              仅异常
            </label>
            <label className="flex items-center gap-1.5 text-[12px] text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyModified}
                onChange={(e) => setOnlyModified(e.target.checked)}
              />
              仅改过口径
            </label>
          </div>
          <div className="col-span-3 flex gap-2">
            <button onClick={applyFilter} className="eng-btn primary flex-1 !py-2 text-sm">
              应用筛选
            </button>
            <button
              onClick={() => {
                setKeyword('');
                setStatus('all');
                setOnlyAbnormal(false);
                setOnlyModified(false);
                setQ({});
              }}
              className="eng-btn secondary flex-1 !py-2 text-sm"
            >
              重置
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className={`${preview ? 'col-span-7' : 'col-span-12'} transition-all`}>
          <div className="panel !p-0 overflow-hidden">
            <table className="eng-table">
              <thead>
                <tr>
                  <th style={{ width: 160 }}>碰撞编号</th>
                  <th>楼层</th>
                  <th>专业</th>
                  <th style={{ width: 100 }}>状态</th>
                  <th style={{ width: 80 }}>版本</th>
                  <th style={{ width: 240 }}>当前结论</th>
                  <th style={{ width: 180 }}>最后修改</th>
                  <th style={{ width: 80 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr
                    key={c.id}
                    onMouseEnter={() => setPreviewId(c.id)}
                    className={`${previewId === c.id ? 'bg-blue-50/60' : ''}`}
                  >
                    <td className="mono font-semibold text-engineering-navy">
                      <div className="flex flex-col gap-1">
                        <span>{c.id.slice(-11)}</span>
                        <div className="flex gap-1">
                          {c.isAbnormal && <AbnormalBadge />}
                          {hasModified(c) && <ModifiedBadge />}
                        </div>
                      </div>
                    </td>
                    <td>{c.floor}</td>
                    <td>{c.discipline}</td>
                    <td>
                      <StatusTag status={c.status} />
                    </td>
                    <td className="mono text-center">{c.version}</td>
                    <td className="text-[12px]">
                      {c.conclusion ? (
                        <span className="text-slate-700">{c.conclusion}</span>
                      ) : (
                        <span className="text-history-gray">（暂未下结论）</span>
                      )}
                      {c.remark && (
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate mono">
                          📝 {c.remark}
                        </div>
                      )}
                    </td>
                    <td className="text-[11px]">
                      <div className="flex items-center gap-1 text-slate-600">
                        <Clock size={11} className="text-slate-400" />
                        {new Date(c.lastModifiedAt).toLocaleDateString('zh-CN')}
                      </div>
                      <div className="text-[10px] text-history-gray mono mt-0.5">
                        {c.lastModifiedByName}
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() => navigate(`/collisions/${c.id}`)}
                        className="eng-btn primary !py-1 text-xs flex items-center gap-1"
                      >
                        查看
                        <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!list.length && (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-history-gray text-sm">
                      {loading.collisions ? '加载中…' : '暂无符合条件的碰撞点'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="col-span-5">
          <div className="sticky top-4">
            <div className="panel">
              <div className="panel-header">
                <div className="flex items-center gap-1.5">
                  <FileText size={14} />
                  <span className="font-semibold text-sm text-engineering-navy">
                    {preview ? '视角上下文 · ' + preview.id.slice(-10) : '视角预览'}
                  </span>
                </div>
              </div>
              <div className="p-3">
                {preview ? (
                  <ViewContextCard collision={preview} compact />
                ) : (
                  <div className="h-[230px] border border-dashed border-slate-300 flex items-center justify-center text-sm text-history-gray bg-slate-50">
                    将鼠标悬浮到左侧碰撞点，可直接看到视角参数、坐标和截图
                  </div>
                )}
              </div>
            </div>
            {preview && (
              <div className="mt-3 text-[11px] text-slate-500 px-1">
                💡 截图 + 相机参数（位置/朝向/FOV） + 坐标 三者一起锁定，避免离开视角就说不清。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
