import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { groupExhibitionItems, getStatusCount } from '../../logic/statusClassifier';
import type { ProcessingStatus } from '../../data/types';
import ColumnHeader from './ColumnHeader';
import ArtworkCard from './ArtworkCard';

const columns: { status: ProcessingStatus; description: string }[] = [
  { status: 'confirmed', description: '所有数据一致，无冲突，可直接布展' },
  { status: 'pending', description: '存在待确认事项，需补充信息后再布展' },
  { status: 'manual-modified', description: '策展人已人工调整，以处理口径为准' },
];

export default function ExhibitionView() {
  const { exhibitionItems } = useApp();

  const groupedItems = useMemo(() => groupExhibitionItems(exhibitionItems), [exhibitionItems]);
  const counts = useMemo(() => getStatusCount(exhibitionItems), [exhibitionItems]);

  return (
    <div>
      <div className="mb-8">
        <h2 className="font-display text-3xl text-gray-900 mb-2">布展清单</h2>
        <p className="font-body text-gray-600 text-sm">
          按处理口径分类展示作品，明确已确认、待补和人工改过的记录，所有调整均保留处理口径说明
        </p>
      </div>

      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="font-body font-semibold text-gray-700 mb-2">分类说明</h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          {columns.map((col) => (
            <div key={col.status}>
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs font-medium mr-2 ${
                  col.status === 'confirmed'
                    ? 'bg-green-100 text-green-700'
                    : col.status === 'pending'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {col.status === 'confirmed' ? '已确认' : col.status === 'pending' ? '待补' : '人工改过'}
              </span>
              <span className="text-gray-600">{col.description}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {columns.map((col) => (
          <div key={col.status} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <ColumnHeader status={col.status} count={counts[col.status]} />
            <div className="p-4 max-h-[calc(100vh-320px)] overflow-y-auto">
              {groupedItems[col.status].length > 0 ? (
                groupedItems[col.status].map((item) => (
                  <ArtworkCard key={item.id} item={item} />
                ))
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">
                  暂无{col.status === 'confirmed' ? '已确认' : col.status === 'pending' ? '待补' : '人工改过'}的记录
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-body font-semibold text-blue-700 mb-2">操作提示</h4>
        <ul className="text-sm text-blue-600 space-y-1">
          <li>• 鼠标悬停在作品卡片上，点击右上角菜单按钮可切换作品状态</li>
          <li>• 切换到「人工改过」时需填写处理口径说明，记录调整原因</li>
          <li>• 所有状态变更都会自动记录时间戳和处理口径，便于追溯</li>
          <li>• 「待补」状态的作品请优先处理，确认后再安排布展</li>
        </ul>
      </div>
    </div>
  );
}
