import React from 'react';
import { useApp } from '../context/AppContext';

export const StepRoomInfo: React.FC = () => {
  const { state, setFieldValue, addOpening, removeOpening, updateOpening } = useApp();
  const { inputData } = state;
  const { room, openings } = inputData;

  const handleChange = (field: string, value: string | number) => {
    setFieldValue(field, value, 'StepRoomInfo');
  };

  const handleOpeningChange = (id: string, field: string, value: string | number) => {
    updateOpening(id, field, value, 'StepRoomInfo');
  };

  const roomArea = (room.width * room.length) / 10000;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          🏠 房间尺寸
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              房间宽度 (cm)
            </label>
            <input
              type="number"
              value={room.width}
              onChange={(e) => handleChange('room.width', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="例如: 400"
            />
            <p className="text-xs text-gray-500 mt-1">标准单位：厘米</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              房间长度 (cm)
            </label>
            <input
              type="number"
              value={room.length}
              onChange={(e) => handleChange('room.length', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="例如: 500"
            />
            <p className="text-xs text-gray-500 mt-1">标准单位：厘米</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              房间高度 (cm)
            </label>
            <input
              type="number"
              value={room.height || ''}
              onChange={(e) => handleChange('room.height', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="例如: 280"
            />
            <p className="text-xs text-gray-500 mt-1">仅用于墙砖计算</p>
          </div>
        </div>
        <div className="mt-4 p-4 bg-white rounded-lg">
          <p className="text-sm text-gray-600">
            <span className="font-medium">房间面积：</span>
            <span className="text-2xl font-bold text-blue-600">
              {roomArea.toFixed(2)} ㎡
            </span>
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-6 rounded-xl border border-orange-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            🚪 门洞/窗洞 (需要扣除的区域)
          </h3>
          <button
            onClick={addOpening}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
          >
            + 添加洞口
          </button>
        </div>
        
        {openings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg mb-2">📋</p>
            <p className="text-sm">暂无洞口，点击上方按钮添加</p>
          </div>
        ) : (
          <div className="space-y-4">
            {openings.map((opening, index) => (
              <div key={opening.id} className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">
                    {opening.type === 'door' ? '🚪 门洞' : 
                     opening.type === 'window' ? '🪟 窗洞' : '📐 其他洞口'} #{index + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={opening.type}
                      onChange={(e) => handleOpeningChange(opening.id, 'type', e.target.value)}
                      className="px-2 py-1 text-sm border rounded"
                    >
                      <option value="door">门洞</option>
                      <option value="window">窗洞</option>
                      <option value="other">其他</option>
                    </select>
                    <button
                      onClick={() => removeOpening(opening.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">宽度 (cm)</label>
                    <input
                      type="number"
                      value={opening.width}
                      onChange={(e) => handleOpeningChange(opening.id, 'width', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">高度 (cm)</label>
                    <input
                      type="number"
                      value={opening.height}
                      onChange={(e) => handleOpeningChange(opening.id, 'height', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">X偏移 (cm)</label>
                    <input
                      type="number"
                      value={opening.offsetX}
                      onChange={(e) => handleOpeningChange(opening.id, 'offsetX', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">面积 (㎡)</label>
                    <div className="w-full px-3 py-2 bg-gray-100 rounded text-sm text-gray-600">
                      {((opening.width * opening.height) / 10000).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
          <p className="text-xs text-yellow-800">
            💡 <strong>提示：</strong>每个门洞/窗洞会额外增加约2%的切割损耗。标准门洞尺寸通常为90×210cm。
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          📝 关键假设
        </h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>• 房间形状为规则矩形</li>
          <li>• 所有尺寸单位统一为厘米</li>
          <li>• 门洞/窗洞面积会从铺贴总面积中扣除</li>
          <li>• 边缘切割损耗已计入模型考虑</li>
        </ul>
      </div>
    </div>
  );
};
