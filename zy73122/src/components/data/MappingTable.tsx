import { MapPin, ArrowRight, Info } from 'lucide-react';
import { useRecordStore } from '../../store/useRecordStore';

export default function MappingTable() {
  const mappings = useRecordStore(s => s.mappings);

  return (
    <div className="space-y-4">
      <div className="bg-ocean-50 rounded-xl p-4 border border-ocean-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-ocean-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-ocean-800">经纬度格式统一映射</p>
            <p className="text-xs text-ocean-600 mt-1">
              船上记录本与标准经纬度格式的对应关系已留存，接班人可随时查阅转换规则。
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-medium text-slate-800">映射规则列表</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs">
                <th className="px-4 py-2.5 text-left font-medium">浮标编号</th>
                <th className="px-4 py-2.5 text-left font-medium">原始格式</th>
                <th className="px-4 py-2.5 text-left font-medium">船上写法</th>
                <th className="px-4 py-2.5 text-center font-medium">转换</th>
                <th className="px-4 py-2.5 text-left font-medium">标准十进制度</th>
                <th className="px-4 py-2.5 text-left font-medium">转换说明</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mappings.map(mapping => (
                <tr key={mapping.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-700">{mapping.buoyId}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
                      {mapping.rawFormat}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-slate-600 space-y-0.5">
                      <p>{mapping.rawLatExample}</p>
                      <p>{mapping.rawLonExample}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ArrowRight className="w-4 h-4 text-ocean-500 mx-auto" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-green-700 space-y-0.5">
                      <p>{mapping.standardLat.toFixed(5)}°N</p>
                      <p>{mapping.standardLon.toFixed(5)}°E</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {mapping.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-ocean-500" />
          转换公式
        </h3>
        <div className="bg-slate-50 rounded-lg p-4 font-mono text-sm text-slate-700 space-y-2">
          <p><span className="text-ocean-600">十进制度</span> = 度 + 分 / 60</p>
          <p><span className="text-ocean-600">分</span> = (十进制度 - 度) × 60</p>
          <p className="text-xs text-slate-400 pt-2 border-t border-slate-200">
            北纬/东经为正，南纬/西经为负
          </p>
        </div>
      </div>
    </div>
  );
}
