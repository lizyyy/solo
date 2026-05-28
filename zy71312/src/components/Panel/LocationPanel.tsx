import React, { useState } from 'react';
import { MapPin, AlertTriangle, Info } from 'lucide-react';
import { useSolarStore } from '../../store/useSolarStore';
import citiesData from '../../data/cities.json';

export const LocationPanel: React.FC = () => {
  const { params, warnings, setCity, setLatitude } = useSolarStore();
  const [showCustomLat, setShowCustomLat] = useState(false);

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cityName = e.target.value;
    const city = citiesData.find((c) => c.name === cityName);
    if (city) {
      setCity(city.name, city.latitude);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-800">位置设置</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            选择城市
          </label>
          <select
            value={params.city}
            onChange={handleCityChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            {citiesData.map((city) => (
              <option key={city.name} value={city.name}>
                {city.name} (纬度: {city.latitude}°)
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCustomLat(!showCustomLat)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {showCustomLat ? '使用城市选择' : '手动输入纬度'}
          </button>
        </div>

        {showCustomLat && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              纬度 (°)
              {warnings.latitudeWarning && (
                <span className="ml-2 text-amber-600 text-xs">
                  * 有警告
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="number"
                value={params.latitude}
                onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                step="0.1"
                min="-90"
                max="90"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  warnings.latitudeWarning ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                }`}
              />
              {warnings.latitudeWarning && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
              )}
            </div>
            {warnings.latitudeWarning && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-start gap-1">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{warnings.latitudeWarning}</span>
              </div>
            )}
          </div>
        )}

        <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
          <div className="font-medium text-gray-700 mb-1">当前位置信息</div>
          <div>城市: <span className="text-gray-800">{params.city}</span></div>
          <div>纬度: <span className="text-gray-800">{params.latitude}°</span></div>
          <div className="text-xs mt-1 text-gray-400">
            纬度影响太阳高度角和全年日照分布
          </div>
        </div>
      </div>
    </div>
  );
};
