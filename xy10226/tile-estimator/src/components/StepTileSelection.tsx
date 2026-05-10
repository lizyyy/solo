import React from 'react';
import { useApp } from '../context/AppContext';
import { TILE_PRESETS } from '../config/defaults';

export const StepTileSelection: React.FC = () => {
  const { state, setFieldValue, updateInputData } = useApp();
  const { inputData } = state;
  const { tile } = inputData;

  const handlePresetSelect = (presetTile: typeof TILE_PRESETS[0]) => {
    updateInputData({
      tile: {
        ...tile,
        ...presetTile,
        id: tile.id,
        batch: tile.batch,
        colorTolerance: tile.colorTolerance,
      },
    });
  };

  const handleChange = (field: string, value: string | number) => {
    setFieldValue(field, value, 'StepTileSelection');
  };

  const tileArea = (tile.width * tile.height) / 10000;
  const areaPerBox = tileArea * tile.tilesPerBox;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          🔧 瓷砖预设
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {TILE_PRESETS.map((preset) => {
            const isSelected = 
              preset.width === tile.width && 
              preset.height === tile.height && 
              preset.tilesPerBox === tile.tilesPerBox;
            
            return (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset)}
                className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                  isSelected
                    ? 'border-green-500 bg-green-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-green-300 hover:shadow'
                }`}
              >
                <div className="text-2xl font-bold text-gray-800">
                  {preset.width}×{preset.height}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {preset.name}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {preset.tilesPerBox}块/盒
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 p-6 rounded-xl border border-teal-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          🎨 自定义瓷砖参数
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              瓷砖宽度 (cm)
            </label>
            <input
              type="number"
              value={tile.width}
              onChange={(e) => handleChange('tile.width', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              瓷砖高度 (cm)
            </label>
            <input
              type="number"
              value={tile.height}
              onChange={(e) => handleChange('tile.height', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              瓷砖名称
            </label>
            <input
              type="text"
              value={tile.name}
              onChange={(e) => handleChange('tile.name', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              placeholder="例如: 抛光砖 60×60"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              每盒数量 (块)
            </label>
            <input
              type="number"
              value={tile.tilesPerBox}
              onChange={(e) => handleChange('tile.tilesPerBox', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              每盒价格 (元)
            </label>
            <input
              type="number"
              value={tile.pricePerBox}
              onChange={(e) => handleChange('tile.pricePerBox', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              批次号
            </label>
            <input
              type="text"
              value={tile.batch || ''}
              onChange={(e) => handleChange('tile.batch', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              placeholder="例如: A2024001"
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg">
            <p className="text-xs text-gray-500">单片面积</p>
            <p className="text-xl font-bold text-teal-600">
              {tileArea.toFixed(4)} ㎡
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <p className="text-xs text-gray-500">每盒面积</p>
            <p className="text-xl font-bold text-teal-600">
              {areaPerBox.toFixed(2)} ㎡
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <p className="text-xs text-gray-500">每㎡单价</p>
            <p className="text-xl font-bold text-teal-600">
              ¥{areaPerBox > 0 ? (tile.pricePerBox / areaPerBox).toFixed(2) : '-'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-xl border border-amber-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          📝 关键假设
        </h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>• 瓷砖尺寸为公称尺寸，实际铺贴需考虑缝宽</li>
          <li>• 批次号用于颜色一致性管理，不同批次可能存在色差</li>
          <li>• 每盒数量和价格用于最终采购量计算</li>
          <li>• 非正方形瓷砖会限制某些铺贴图案（如人字铺）</li>
        </ul>
      </div>

      {tile.width !== tile.height && (
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <p className="text-sm text-yellow-800">
            ⚠️ <strong>注意：</strong>当前选择的是非正方形瓷砖 ({tile.width}×{tile.height}cm)，人字铺铺贴图案将不可用。
          </p>
        </div>
      )}
    </div>
  );
};
