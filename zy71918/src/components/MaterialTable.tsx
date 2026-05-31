import React, { useState } from 'react';
import type { Material, SourceType } from 'shared/types';
import { SOURCE_TYPE_CONFIG, formatDate, getSourceResponsiblePerson } from 'shared/constants';
import SourceTag from './SourceTag';
import { CheckCircle2, XCircle, User, FileText, Plus, X } from 'lucide-react';
import { useClipStore } from '@/store/clipStore';

interface MaterialTableProps {
  materials: Material[];
  clipId: string;
  canAdd?: boolean;
}

const MaterialTable: React.FC<MaterialTableProps> = ({
  materials,
  clipId,
  canAdd = true,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    name: '',
    sourceType: 'edit_point' as SourceType,
    url: '',
    remark: '',
  });
  const { addMaterial, loading } = useClipStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaterial.name.trim()) return;

    await addMaterial(clipId, {
      name: newMaterial.name,
      sourceType: newMaterial.sourceType,
      url: newMaterial.url || undefined,
      remark: newMaterial.remark || undefined,
      operatorId: '',
    });

    setNewMaterial({ name: '', sourceType: 'edit_point', url: '', remark: '' });
    setShowAddForm(false);
  };

  const groupedMaterials = materials.reduce(
    (acc, m) => {
      if (!acc[m.sourceType]) acc[m.sourceType] = [];
      acc[m.sourceType].push(m);
      return acc;
    },
    {} as Record<SourceType, Material[]>,
  );

  return (
    <div>
      {canAdd && (
        <div className="mb-4">
          {!showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              添加素材
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="card p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-slate-850">添加新素材</h4>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="p-1 hover:bg-studio-border rounded"
                >
                  <X className="w-4 h-4 text-studio-muted" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-studio-muted mb-1">
                    素材名称
                  </label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    value={newMaterial.name}
                    onChange={e =>
                      setNewMaterial({ ...newMaterial, name: e.target.value })
                    }
                    placeholder="请输入素材名称"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-studio-muted mb-1">
                    来源类型
                  </label>
                  <select
                    className="select-field text-sm"
                    value={newMaterial.sourceType}
                    onChange={e =>
                      setNewMaterial({
                        ...newMaterial,
                        sourceType: e.target.value as SourceType,
                      })
                    }
                  >
                    <option value="edit_point">剪辑点</option>
                    <option value="ad_script">广告口播表</option>
                    <option value="audio_track">原始音轨</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-studio-muted mb-1">
                  文件链接（可选，不填则标记为缺失）
                </label>
                <input
                  type="text"
                  className="input-field text-sm"
                  value={newMaterial.url}
                  onChange={e =>
                    setNewMaterial({ ...newMaterial, url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-xs text-studio-muted mb-1">
                  备注（可选）
                </label>
                <input
                  type="text"
                  className="input-field text-sm"
                  value={newMaterial.remark}
                  onChange={e =>
                    setNewMaterial({ ...newMaterial, remark: e.target.value })
                  }
                  placeholder="备注说明"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="btn-ghost text-sm"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn-primary text-sm"
                  disabled={loading}
                >
                  {loading ? '添加中...' : '确认添加'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="space-y-4">
        {(Object.keys(groupedMaterials) as SourceType[]).map(sourceType => {
          const config = SOURCE_TYPE_CONFIG[sourceType];
          const items = groupedMaterials[sourceType];
          const missingItems = items.filter(m => m.status === 'missing');
          const responsible = getSourceResponsiblePerson(sourceType);

          return (
            <div key={sourceType}>
              <div
                className="flex items-center gap-2 mb-2 px-3 py-2 rounded-t-lg"
                style={{ backgroundColor: `${config.color}10` }}
              >
                <SourceTag type={sourceType} />
                <span className="text-sm text-studio-muted">
                  共 {items.length} 项
                </span>
                {missingItems.length > 0 && (
                  <span className="text-sm text-red-600 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" />
                    {missingItems.length} 项缺失
                  </span>
                )}
                {responsible && (
                  <span className="text-xs text-studio-muted ml-auto flex items-center gap-1">
                    <User className="w-3 h-3" />
                    责任人：{responsible.name}（{responsible.role === 'editor' ? '剪辑师' : '运营'}）
                  </span>
                )}
              </div>

              <div className="overflow-hidden rounded-b-lg border border-studio-border">
                <table className="w-full">
                  <thead>
                    <tr className="bg-studio-bg border-b border-studio-border">
                      <th className="px-4 py-2 text-left text-xs font-medium text-studio-muted">
                        素材名称
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-studio-muted">
                        状态
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-studio-muted">
                        上传人
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-studio-muted">
                        上传时间
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-studio-muted">
                        备注
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-studio-border">
                    {items.map(material => (
                      <tr
                        key={material.id}
                        className={`hover:bg-studio-bg/50 ${
                          material.status === 'missing' ? 'bg-red-50/30' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <FileText
                              className={`w-4 h-4 ${
                                material.status === 'missing'
                                  ? 'text-red-400'
                                  : 'text-studio-muted'
                              }`}
                            />
                            {material.url ? (
                              <a
                                href={material.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-amber-700 hover:underline"
                              >
                                {material.name}
                              </a>
                            ) : (
                              <span
                                className={
                                  material.status === 'missing'
                                    ? 'text-red-600'
                                    : ''
                                }
                              >
                                {material.name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {material.status === 'available' ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-700">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              已提供
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-red-600">
                              <XCircle className="w-3.5 h-3.5" />
                              缺失
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-studio-muted">
                          {material.uploadedBy
                            ? items.find(
                                m => m.uploadedBy === material.uploadedBy,
                              )?.uploadedBy || '未知'
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-studio-muted">
                          {material.uploadedAt ? formatDate(material.uploadedAt) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-studio-muted">
                          {material.remark || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {materials.length === 0 && (
          <div className="text-center py-8 text-studio-muted">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>暂无素材记录</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MaterialTable;
