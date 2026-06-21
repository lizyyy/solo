import { useState } from 'react';
import { AlertTriangle, Search, Trash2, RotateCcw, Link, FileText, ExternalLink } from 'lucide-react';
import type { MaterialChange, BimNote } from '../types';
import StatusBadge from './StatusBadge';

interface BadDataProps {
  materialChanges: MaterialChange[];
  bimNotes: BimNote[];
  onViewBimNote?: (noteId: string) => void;
}

export default function BadData({ materialChanges, bimNotes, onViewBimNote }: BadDataProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const badDataItems = materialChanges.filter((m) => m.isBadData);

  const filtered = badDataItems.filter((item) => {
    if (searchTerm && !item.title.includes(searchTerm) && !item.badDataReason?.includes(searchTerm)) return false;
    return true;
  });

  const selected = badDataItems.find((m) => m.id === selectedId);
  const originalNote = selected?.originalRecordId
    ? bimNotes.find((n) => n.id === selected.originalRecordId)
    : null;

  return (
    <div className="h-full flex">
      <div className="w-80 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">坏数据中心</h3>
              <p className="text-xs text-slate-500">共 {badDataItems.length} 条坏数据</p>
            </div>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜索坏数据..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                selectedId === item.id
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-white border border-slate-200 hover:border-red-300'
              }`}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 line-clamp-1">{item.title}</p>
                  <p className="text-xs text-red-600 mt-1 line-clamp-2">{item.badDataReason}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 ml-6">
                <span className="text-xs text-slate-400">{item.author}</span>
                <span className="text-xs text-slate-400">
                  {new Date(item.updatedAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white overflow-y-auto">
        {selected ? (
          <div className="p-6 space-y-6">
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={20} className="text-red-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-slate-800">{selected.title}</h2>
                  <p className="text-sm text-slate-500 mt-1">{selected.description}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <StatusBadge status="bad_data" />
                    <span className="text-sm text-slate-500">
                      录入人：{selected.author}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <Trash2 size={16} className="text-red-500" />
                  坏数据原因
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">{selected.badDataReason}</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <Link size={16} className="text-blue-500" />
                  线索保留
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">{selected.badDataClue}</p>
                {originalNote && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 font-medium">原始BIM备注</p>
                    <p className="text-sm text-blue-800 mt-1">{originalNote.title}</p>
                    <p className="text-xs text-blue-600 mt-1 font-mono">{originalNote.id}</p>
                  </div>
                )}
              </div>
            </div>

            {selected.materials.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                  <h4 className="font-medium text-slate-800">涉及材料（数据待确认）</h4>
                </div>
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">
                        材料名称
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">
                        规格
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">
                        数量
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">
                        单位
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">
                        变更原因
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selected.materials.map((mat) => (
                      <tr key={mat.id} className="bg-slate-50/50">
                        <td className="px-4 py-3 text-sm text-slate-600">{mat.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{mat.spec}</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-500">
                          {mat.quantity}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">{mat.unit}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{mat.changeReason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {originalNote && (
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-slate-800 flex items-center gap-2">
                    <FileText size={16} className="text-blue-500" />
                    指向的原始BIM备注
                  </h4>
                  {onViewBimNote && (
                    <button
                      onClick={() => onViewBimNote(originalNote.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <ExternalLink size={12} />
                      查看原始备注
                    </button>
                  )}
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="font-medium text-slate-800">{originalNote.title}</p>
                  <p className="text-sm text-slate-600 mt-2">{originalNote.content}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                    <span>作者：{originalNote.author}</span>
                    <span>版本：{originalNote.modelVersion}</span>
                    <span>创建：{new Date(originalNote.createdAt).toLocaleDateString('zh-CN')}</span>
                  </div>
                  {originalNote.isDeleted && (
                    <div className="mt-3 p-2 bg-amber-100 text-amber-700 text-xs rounded">
                      注意：此原始备注已作废
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <RotateCcw size={16} />
                修复数据
              </button>
              <button className="px-4 py-2.5 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                联系录入人
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <AlertTriangle size={48} className="mx-auto mb-3 opacity-50" />
              <p>选择一条坏数据查看详情</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
