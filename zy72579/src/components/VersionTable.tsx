import type { FeatureVersion } from '@/types';

interface VersionTableProps {
  versions: FeatureVersion[];
}

export function VersionTable({ versions }: VersionTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-slate-200">
            <th className="text-left py-3 px-4 font-semibold text-slate-900 font-serif">版本号</th>
            <th className="text-left py-3 px-4 font-semibold text-slate-900 font-serif">特征名称</th>
            <th className="text-left py-3 px-4 font-semibold text-slate-900 font-serif">特征口径</th>
            <th className="text-left py-3 px-4 font-semibold text-slate-900 font-serif">更新时间</th>
            <th className="text-left py-3 px-4 font-semibold text-slate-900 font-serif">操作人</th>
            <th className="text-left py-3 px-4 font-semibold text-slate-900 font-serif">备注</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((v, index) => (
            <tr
              key={v.version}
              className={`border-b border-slate-100 ${index === 0 ? 'bg-teal-50/50' : ''}`}
            >
              <td className="py-3 px-4">
                <code className="bg-slate-100 px-2 py-1 text-xs font-mono text-teal-700">
                  {v.version}
                  {index === 0 && <span className="ml-2 text-emerald-600 font-medium">最新</span>}
                </code>
              </td>
              <td className="py-3 px-4 font-mono text-xs text-slate-700">{v.featureName}</td>
              <td className="py-3 px-4 text-slate-600">{v.caliber}</td>
              <td className="py-3 px-4 text-slate-500 text-xs">{v.updateTime}</td>
              <td className="py-3 px-4 text-slate-600">{v.operator}</td>
              <td className="py-3 px-4 text-slate-500 text-xs">{v.remark}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
