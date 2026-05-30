import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useBatchStore } from '@/store/batchStore';
import { compareVersions, generateDiffSummary, generateFileHash } from '@/utils/version/versionCompare';
import { Material, MATERIAL_TYPE_LABELS, MATERIAL_TYPE_COLORS, MaterialType } from '@/types';
import { GitCompare, ArrowRight, FileText, CheckCircle, AlertCircle, Plus, Minus, Edit3, Eye, Hash, User, Clock } from 'lucide-react';

const VersionCompare: React.FC = () => {
  const { materials, currentBatch } = useBatchStore();
  const [selectedType, setSelectedType] = useState<MaterialType>('holding');
  const [version1, setVersion1] = useState<number | null>(null);
  const [version2, setVersion2] = useState<number | null>(null);

  const typeMaterials = materials.filter(m => m.type === selectedType).sort((a, b) => b.version - a.version);

  const getMaterialByVersion = (type: MaterialType, version: number): Material | undefined => {
    return materials.find(m => m.type === type && m.version === version);
  };

  const handleCompare = () => {
    if (version1 === null || version2 === null) return;
    const v1 = getMaterialByVersion(selectedType, version1);
    const v2 = getMaterialByVersion(selectedType, version2);
    if (!v1 || !v2) return;
    return compareVersions([v1], [v2]);
  };

  const diffResult = version1 !== null && version2 !== null ? handleCompare() : null;

  const renderChangeIcon = (type: 'added' | 'modified' | 'deleted') => {
    switch (type) {
      case 'added': return <Plus className="w-4 h-4 text-emerald-500" />;
      case 'modified': return <Edit3 className="w-4 h-4 text-amber-500" />;
      case 'deleted': return <Minus className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">版本对比</h1>
            <p className="mt-1 text-sm text-slate-400">
              对比不同版本材料的差异，识别更新内容和重复提交
            </p>
          </div>
          <Link to="/export">
            <Button variant="primary">
              导出报告 <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>

        <Card className="p-4">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm text-slate-400">选择材料类型：</span>
            <div className="flex items-center gap-2">
              {(['holding', 'target', 'price'] as MaterialType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setSelectedType(type);
                    setVersion1(null);
                    setVersion2(null);
                  }}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    selectedType === type
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${MATERIAL_TYPE_COLORS[type]}`} />
                  {MATERIAL_TYPE_LABELS[type]}
                  <Badge variant="secondary" size="sm">
                    {materials.filter(m => m.type === type).length} 个版本
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          {typeMaterials.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无{MATERIAL_TYPE_LABELS[selectedType]}材料</p>
              <Link to="/import" className="inline-block mt-3">
                <Button variant="secondary" size="sm">
                  去导入
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-2">基准版本 (V1)</label>
                  <select
                    value={version1 ?? ''}
                    onChange={(e) => setVersion1(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-600"
                  >
                    <option value="">选择版本</option>
                    {typeMaterials.map((m) => (
                      <option key={m.id} value={m.version}>
                        版本 {m.version} · {m.fileName} · {new Date(m.uploadedAt).toLocaleString('zh-CN')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-2">对比版本 (V2)</label>
                  <select
                    value={version2 ?? ''}
                    onChange={(e) => setVersion2(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-600"
                  >
                    <option value="">选择版本</option>
                    {typeMaterials.map((m) => (
                      <option key={m.id} value={m.version}>
                        版本 {m.version} · {m.fileName} · {new Date(m.uploadedAt).toLocaleString('zh-CN')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {version1 !== null && version2 !== null && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {[version1, version2].map((v, idx) => {
                    const material = getMaterialByVersion(selectedType, v);
                    if (!material) return null;
                    return (
                      <Card key={v} className="p-3 bg-slate-800/30">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant={idx === 0 ? 'secondary' : 'info'}>V{idx + 1} · 版本 {v}</Badge>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1 text-slate-400">
                            <FileText className="w-3 h-3" />
                            {material.fileName}
                          </div>
                          <div className="flex items-center gap-1 text-slate-500">
                            <User className="w-3 h-3" />
                            {material.uploadedBy}
                          </div>
                          <div className="flex items-center gap-1 text-slate-500">
                            <Clock className="w-3 h-3" />
                            {new Date(material.uploadedAt).toLocaleString('zh-CN')}
                          </div>
                          <div className="flex items-center gap-1 text-slate-500">
                            <Hash className="w-3 h-3" />
                            {material.fileHash.slice(0, 16)}...
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </Card>

        {diffResult && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-white flex items-center gap-2">
                <GitCompare className="w-4 h-4" />
                对比结果
              </h3>
              {diffResult.isDuplicate ? (
                <Badge variant="success" className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  内容完全相同（重复提交）
                </Badge>
              ) : (
                <Badge variant="warning" className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  存在 {diffResult.changes.length} 处变更
                </Badge>
              )}
            </div>

            {diffResult.isDuplicate ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-md">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-emerald-400 mb-1">检测到重复提交</h4>
                    <p className="text-sm text-slate-400">
                      两个版本的文件内容完全相同，文件指纹一致。此次提交不会产生新的数据变更，
                      系统将保留历史版本记录但不重复解析。
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 p-3 bg-slate-800/50 rounded-md">
                  <div className="text-sm text-slate-300">
                    {generateDiffSummary(diffResult.changes)}
                  </div>
                </div>

                {diffResult.changes.map((change, idx) => (
                  <div key={idx} className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      {renderChangeIcon(change.type)}
                      <span className="text-sm font-medium text-white">
                        {change.type === 'added' ? '新增' : change.type === 'modified' ? '修改' : '删除'}
                        {MATERIAL_TYPE_LABELS[change.materialType]}
                      </span>
                    </div>

                    {change.rowChanges && change.rowChanges.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-700">
                              <th className="text-left py-2 px-2 text-slate-500 w-16">行号</th>
                              <th className="text-left py-2 px-2 text-slate-500 w-16">操作</th>
                              <th className="text-left py-2 px-2 text-slate-500">字段变更</th>
                            </tr>
                          </thead>
                          <tbody>
                            {change.rowChanges.map((row, rowIdx) => (
                              <tr key={rowIdx} className="border-b border-slate-800">
                                <td className="py-2 px-2 font-mono text-slate-500">
                                  {row.rowIndex + 1}
                                </td>
                                <td className="py-2 px-2">
                                  <div className="flex items-center gap-1">
                                    {renderChangeIcon(row.type)}
                                    <span className={
                                      row.type === 'added' ? 'text-emerald-400' :
                                      row.type === 'deleted' ? 'text-red-400' : 'text-amber-400'
                                    }>
                                      {row.type === 'added' ? '新增' : row.type === 'deleted' ? '删除' : '修改'}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2 px-2">
                                  {row.type === 'added' && row.newData && (
                                    <div className="font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                                      {JSON.stringify(row.newData).slice(0, 100)}...
                                    </div>
                                  )}
                                  {row.type === 'deleted' && row.oldData && (
                                    <div className="font-mono text-red-400 bg-red-500/10 px-2 py-1 rounded line-through">
                                      {JSON.stringify(row.oldData).slice(0, 100)}...
                                    </div>
                                  )}
                                  {row.type === 'modified' && change.fieldChanges && (
                                    <div className="space-y-1">
                                      {change.fieldChanges.map((field, fIdx) => (
                                        <div key={fIdx} className="flex items-center gap-2">
                                          <span className="text-slate-400">{field.field}:</span>
                                          <span className="text-red-400 line-through">{String(field.oldValue)}</span>
                                          <span className="text-slate-500">→</span>
                                          <span className="text-emerald-400">{String(field.newValue)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </Card>
        )}

        <Card className="p-4">
          <h3 className="font-medium text-white mb-4">版本历史</h3>
          <div className="space-y-2">
            {typeMaterials.map((material, idx) => (
              <div 
                key={material.id}
                className="flex items-center justify-between p-3 bg-slate-800/30 rounded-md hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-3 h-3 rounded-full ${MATERIAL_TYPE_COLORS[material.type]}`} />
                    {idx < typeMaterials.length - 1 && (
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-slate-700" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-medium">{material.fileName}</span>
                      <Badge variant="secondary" size="sm">v{material.version}</Badge>
                      {material.isDuplicate && (
                        <Badge variant="info" size="sm">重复提交</Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {material.source} · {material.uploadedBy} · {new Date(material.uploadedAt).toLocaleString('zh-CN')}
                    </div>
                    {material.diffFromPrevious && material.diffFromPrevious.changes.length > 0 && (
                      <div className="text-xs text-amber-400 mt-0.5">
                        {generateDiffSummary(material.diffFromPrevious.changes)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      if (version1 === null) {
                        setVersion1(material.version);
                      } else {
                        setVersion2(material.version);
                      }
                    }}
                  >
                    <GitCompare className="w-3 h-3 mr-1" />
                    对比
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
};

export default VersionCompare;
