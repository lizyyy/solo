import { Facility } from '../types';

interface FacilityPanelProps {
  facilities: Facility[];
  hasFire: boolean;
  hasShelter: boolean;
  hasFriday: boolean;
}

const FacilityPanel = ({ facilities, hasFire, hasShelter, hasFriday }: FacilityPanelProps) => {
  return (
    <div className="card">
      <h2 className="text-xl font-bold text-gray-800 mb-4">🏕️ 营地设施</h2>

      <div className="flex flex-wrap gap-2 mb-4">
        {hasShelter && (
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
            🏠 庇护所
          </span>
        )}
        {hasFire && (
          <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
            🔥 火堆
          </span>
        )}
        {hasFriday && (
          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
            👤 星期五
          </span>
        )}
      </div>

      <div className="space-y-3">
        {facilities.map((facility) => (
          <div
            key={facility.id}
            className={`p-3 rounded-lg border transition-all duration-200 ${
              facility.built
                ? 'bg-green-50 border-green-200'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-gray-800">{facility.name}</h3>
                <p className="text-xs text-gray-600 mt-1">{facility.description}</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-700">
                  {facility.level} / {facility.maxLevel}
                </div>
                <div className="text-xs text-gray-500">
                  {facility.built ? '已建造' : '未建造'}
                </div>
              </div>
            </div>
            <div className="mt-2">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    facility.built ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                  style={{ width: `${(facility.level / facility.maxLevel) * 100}%` }}
                />
              </div>
            </div>
            {facility.built && (
              <p className="text-xs text-gray-500 mt-2">{facility.effects.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FacilityPanel;
