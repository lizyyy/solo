import { Resources, RESOURCE_NAMES, RESOURCE_COLORS, RESOURCE_ICONS } from '../types';

interface ResourceDisplayProps {
  resources: Resources;
  maxResources: Resources;
  actionPoints: number;
  maxActionPoints: number;
  currentDay: number;
}

const ResourceDisplay = ({
  resources,
  maxResources,
  actionPoints,
  maxActionPoints,
  currentDay,
}: ResourceDisplayProps) => {
  const getResourcePercentage = (current: number, max: number) => {
    return Math.max(0, Math.min(100, (current / max) * 100));
  };

  const getResourceColor = (current: number, max: number, baseColor: string) => {
    const percentage = getResourcePercentage(current, max);
    if (percentage <= 20) return 'bg-red-500';
    if (percentage <= 40) return 'bg-amber-500';
    return baseColor;
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">📊 状态</h2>
        <div className="text-lg font-semibold text-ocean">
          第 {currentDay} 天
        </div>
      </div>

      <div className="mb-6 p-3 bg-ocean bg-opacity-10 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <span className="font-semibold text-ocean-dark">⚡ 行动点</span>
          <span className="text-lg font-bold text-ocean-dark">
            {actionPoints} / {maxActionPoints}
          </span>
        </div>
        <div className="resource-bar">
          <div
            className="resource-fill bg-ocean"
            style={{ width: `${(actionPoints / maxActionPoints) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {(Object.keys(resources) as Array<keyof Resources>).map((key) => (
          <div key={key}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700">
                {RESOURCE_ICONS[key]} {RESOURCE_NAMES[key]}
              </span>
              <span className="text-sm font-semibold text-gray-800">
                {resources[key]} / {maxResources[key]}
              </span>
            </div>
            <div className="resource-bar">
              <div
                className={`resource-fill ${getResourceColor(
                  resources[key],
                  maxResources[key],
                  RESOURCE_COLORS[key]
                )}`}
                style={{ width: `${getResourcePercentage(resources[key], maxResources[key])}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResourceDisplay;
