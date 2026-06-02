import { Edit2, Download, RefreshCw, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import TagBadge from '../common/TagBadge';
import { exportToExcel } from '../../utils/export';
import { resetToMockData } from '../../utils/storage';

const MaterialTable = () => {
  const { getFilteredMaterials, openEditModal, updateMaterial, addToast, setMaterials } = useStore();
  const materials = getFilteredMaterials();

  const handleExport = () => {
    exportToExcel(materials);
    addToast('success', `已导出 ${materials.length} 条记录`);
  };

  const handleReset = () => {
    if (confirm('确定要重置所有数据到初始状态吗？这会丢失所有修改。')) {
      const resetData = resetToMockData();
      setMaterials(resetData);
      addToast('info', '已重置为初始数据');
    }
  };

  const getRowBgClass = (status: string, hasUnresolvedException: boolean) => {
    if (hasUnresolvedException) return 'bg-red-50/50 hover:bg-red-50';
    if (status === 'reviewed') return 'bg-emerald-50/30 hover:bg-emerald-50/50';
    return 'hover:bg-slate-50';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <h2 className="font-semibold text-slate-700">素材列表</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            重置数据
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            导出当前筛选 ({materials.length})
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                文件名
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                曲目名称
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                情绪标签
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                状态
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                来源
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                备注
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                异常
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                处理时间
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {materials.map((material) => {
              const hasUnresolvedException = material.exceptions.some((e) => !e.resolved);
              return (
                <tr
                  key={material.id}
                  className={`${getRowBgClass(material.status, hasUnresolvedException)} transition-colors cursor-pointer`}
                  onClick={() => openEditModal(material)}
                >
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-700 font-mono max-w-[200px] truncate">
                      {material.fileName}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-700 font-medium">{material.trackName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <TagBadge type="emotion" value={material.emotionTag} />
                  </td>
                  <td className="px-4 py-3">
                    <TagBadge type="status" value={material.status} />
                  </td>
                  <td className="px-4 py-3">
                    <TagBadge type="source" value={material.source} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-600 max-w-[200px] truncate">
                      {material.remark || <span className="text-slate-400">-</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {material.exceptions.filter((e) => !e.resolved).length > 0 ? (
                        material.exceptions
                          .filter((e) => !e.resolved)
                          .map((exc, idx) => (
                            <TagBadge key={idx} type="exception" value={exc.type} />
                          ))
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-slate-500">
                      {new Date(material.processedAt).toLocaleDateString('zh-CN')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(material);
                        }}
                        className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {materials.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-slate-500">没有符合条件的素材</p>
            <p className="text-sm text-slate-400 mt-1">试试调整筛选条件？</p>
          </div>
        )}
      </div>

      <div className="px-6 py-3 border-t border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>共 {materials.length} 条记录</span>
          <span>💡 点击任意行可快速编辑</span>
        </div>
      </div>
    </div>
  );
};

export default MaterialTable;
