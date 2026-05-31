import React, { useState } from 'react';
import { Edit2, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { Artwork, DimensionUnit, User } from '@/types';
import { StatusBadge } from './StatusBadge';
import { normalizeDimensions } from '@/utils/unitValidation';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface ArtworkListProps {
  artworks: Artwork[];
  currentUser: User;
  onUpdateUnit: (artworkId: string, newUnit: DimensionUnit) => void;
}

export const ArtworkList: React.FC<ArtworkListProps> = ({ artworks, currentUser, onUpdateUnit }) => {
  const [editingUnit, setEditingUnit] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<DimensionUnit>('cm');

  const activeArtworks = artworks.filter(a => a.status !== 'replaced');
  const replacedArtworks = artworks.filter(a => a.status === 'replaced');

  const statusLabels: Record<string, string> = {
    normal: '正常',
    pending_confirmation: '待确认',
    replaced: '已替换',
  };

  const unitOptions: DimensionUnit[] = ['cm', 'mm', 'm', 'inch'];

  const handleUnitSave = (artworkId: string) => {
    onUpdateUnit(artworkId, selectedUnit);
    setEditingUnit(null);
  };

  const renderArtworkRow = (artwork: Artwork) => (
    <tr key={artwork.id} className={`${artwork.status === 'pending_confirmation' ? 'bg-yellow-50' : ''} hover:bg-gray-50`}>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-800">{artwork.title}</div>
        <div className="text-sm text-gray-500">{artwork.artist} · {artwork.year}</div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {editingUnit === artwork.id ? (
            <div className="flex items-center gap-2">
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value as DimensionUnit)}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                {unitOptions.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <button
                onClick={() => handleUnitSave(artwork.id)}
                className="text-xs bg-green-600 text-white px-2 py-1 rounded"
              >
                保存
              </button>
              <button
                onClick={() => setEditingUnit(null)}
                className="text-xs bg-gray-300 text-gray-700 px-2 py-1 rounded"
              >
                取消
              </button>
            </div>
          ) : (
            <>
              <span className="text-gray-700">{normalizeDimensions(artwork)}</span>
              {currentUser.role === 'assistant' && (
                <button
                  onClick={() => {
                    setEditingUnit(artwork.id);
                    setSelectedUnit(artwork.unit);
                  }}
                  className="text-gray-400 hover:text-blue-600"
                >
                  <Edit2 size={14} />
                </button>
              )}
            </>
          )}
        </div>
        {!artwork.unitConfirmed && (
          <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
            <AlertTriangle size={12} />
            <span>单位未确认</span>
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-gray-600">{artwork.location}</td>
      <td className="px-4 py-3">
        <StatusBadge status={artwork.status}>
          {statusLabels[artwork.status]}
        </StatusBadge>
      </td>
      <td className="px-4 py-3">
        <div className="text-xs text-gray-500">
          <div>最后修改：{format(new Date(artwork.lastModifiedAt), 'MM-dd HH:mm', { locale: zhCN })}</div>
          {artwork.manualChange && artwork.changeReason && (
            <div className="text-orange-600 mt-1 flex items-center gap-1">
              <RefreshCw size={10} />
              {artwork.changeReason}
            </div>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">作品列表</h2>
        <div className="flex gap-2">
          <span className="text-sm text-gray-500">
            共 {activeArtworks.length} 件展品
          </span>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">作品信息</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">尺寸</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">位置</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">修改记录</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {activeArtworks.map(renderArtworkRow)}
          </tbody>
        </table>
      </div>

      {replacedArtworks.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <span className="text-gray-400"><CheckCircle size={16} /></span>
            <h3 className="font-medium text-gray-600">已替换作品 ({replacedArtworks.length})</h3>
          </div>
          <div className="card-body">
            <table className="w-full text-sm">
              <thead className="text-gray-500">
                <tr>
                  <th className="text-left pb-2">作品</th>
                  <th className="text-left pb-2">替换为</th>
                  <th className="text-left pb-2">替换原因</th>
                  <th className="text-left pb-2">时间</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                {replacedArtworks.map(artwork => {
                  const replacement = artworks.find(a => a.id === artwork.replacedBy);
                  return (
                    <tr key={artwork.id} className="border-t border-gray-100">
                      <td className="py-2 line-through text-gray-400">{artwork.title}</td>
                      <td className="py-2">{replacement?.title || '-'}</td>
                      <td className="py-2">{artwork.replacementNote || '-'}</td>
                      <td className="py-2 text-xs">
                        {format(new Date(artwork.lastModifiedAt), 'MM-dd HH:mm', { locale: zhCN })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
