import { Link } from 'react-router-dom';
import { Eye, TriangleAlert, Star, UserRound, Layers } from 'lucide-react';
import type { CollisionRecord } from '@/types';
import { StatusTag } from '@/components/StatusTag';

interface Props {
  rows: CollisionRecord[];
  onOpenRejudge: (r: CollisionRecord) => void;
}

export function CollisionTable({ rows, onOpenRejudge }: Props) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-16 text-center">
        <div className="text-slate-300 mb-3">
          <Layers className="w-14 h-14 mx-auto" strokeWidth={1.2} />
        </div>
        <div className="text-slate-500 text-sm">未筛选到碰撞记录</div>
        <div className="text-slate-400 text-xs mt-1">尝试调整筛选条件</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-slate-100 text-xs">
            <tr>
              <th className="px-4 py-3 text-left font-semibold w-12">样例</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">编号</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">项目·楼层·节点</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">碰撞类型</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">碰撞双方</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">主视角</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">状态</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                <UserRound className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />负责人
              </th>
              <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, idx) => {
              const isZebra = idx % 2 === 1;
              return (
                <tr
                  key={r.id}
                  className={`group relative transition-colors
                    ${isZebra ? 'bg-slate-50/40' : 'bg-white'}
                    ${r.isCoordinateOffset ? 'bg-gradient-to-r from-red-50/60 to-transparent' : ''}
                    ${r.isSample ? 'bg-gradient-to-r from-amber-50/60 to-transparent' : ''}
                    hover:bg-brand-50/50`}
                >
                  {r.isCoordinateOffset && (
                    <td className="absolute left-0 top-0 bottom-0 w-1 bg-status-rejected" aria-hidden />
                  )}
                  <td className="pl-5 pr-3 py-3.5 relative">
                    <div className="flex items-center">
                      {r.isSample ? (
                        <Star className="w-4 h-4 text-sample-star fill-sample-star/30" />
                      ) : (
                        <span className="w-4 h-4" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <code className="tnum font-mono text-xs text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                        {r.id}
                      </code>
                      {r.isCoordinateOffset && (
                        <TriangleAlert className="w-4 h-4 text-status-rejected animate-pulse" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-slate-800 text-xs leading-tight">{r.projectName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      <span className="inline-block bg-slate-100 px-1.5 py-0.5 rounded mr-1 tnum">{r.floor}</span>
                      <span className="tnum font-mono">{r.nodeCode}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-block px-2 py-0.5 text-xs bg-slate-800/5 text-slate-700 border border-slate-200 rounded">
                      {r.collisionType}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="text-xs text-slate-600 leading-tight space-y-0.5">
                      <div className="font-medium text-slate-700">A · {r.elementA}</div>
                      <div className="text-slate-400">↕ 冲突</div>
                      <div className="font-medium text-slate-700">B · {r.elementB}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="w-20 h-14 rounded overflow-hidden border border-slate-200 bg-slate-50 group-hover:border-brand-400 transition-colors">
                      <img
                        src={r.screenshots[0]?.url}
                        alt="主视角"
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusTag status={r.status} rejudgeCount={r.rejudgeCount} />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                        <UserRound className="w-3.5 h-3.5" />
                      </div>
                      <span>{r.responsiblePerson}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        to={`/collisions/${r.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 rounded border border-brand-200/60 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>详情</span>
                      </Link>
                      <button
                        onClick={() => onOpenRejudge(r)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-status-manual bg-status-manual/10 hover:bg-status-manual/20 rounded border border-status-manual/30 transition-colors"
                      >
                        <span>改判</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
