import { useEffect, useState } from 'react';
import { inventoryApi } from '../services/api';
import { Inventory } from '../types';

const InventoryPage = () => {
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      const res = await inventoryApi.getAll();
      setInventory(res.data);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    inventoryApi.export();
  };

  if (loading) {
    return <div className="text-center py-12">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">库存管理</h1>
        <button
          onClick={handleExport}
          className="btn btn-secondary"
        >
          📥 导出库存CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {inventory.map((item) => (
          <div key={item.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">{item.materialName}</h3>
                <p className="text-sm text-gray-500">{item.batchName}</p>
              </div>
              <span className="text-2xl">📦</span>
            </div>
            <div className="mt-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">总数量</span>
                <span className="font-semibold">{item.totalQuantity} {item.materialUnit}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">已发放</span>
                <span className="font-semibold text-blue-600">{item.distributedQuantity} {item.materialUnit}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">已退回</span>
                <span className="font-semibold text-orange-600">{item.returnedQuantity || 0} {item.materialUnit}</span>
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="text-gray-700 font-medium">可用库存</span>
                <span className={`font-bold text-xl ${item.availableQuantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {item.availableQuantity} {item.materialUnit}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((item.distributedQuantity / item.totalQuantity) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 text-right">
                已发放 {Math.round((item.distributedQuantity / item.totalQuantity) * 100)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InventoryPage;
