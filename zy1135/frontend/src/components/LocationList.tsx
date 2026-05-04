import { Location } from '../types';

interface LocationListProps {
  locations: Location[];
  selectedLocation: string | null;
  onSelectLocation: (locationId: string) => void;
}

const LocationList = ({
  locations,
  selectedLocation,
  onSelectLocation,
}: LocationListProps) => {
  const discoveredLocations = locations.filter((l) => l.discovered);
  const undiscoveredCount = locations.filter((l) => !l.discovered).length;

  return (
    <div className="card">
      <h2 className="text-xl font-bold text-gray-800 mb-4">🗺️ 地点</h2>

      <div className="space-y-2">
        {discoveredLocations.map((location) => (
          <div
            key={location.id}
            onClick={() => onSelectLocation(location.id)}
            className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
              selectedLocation === location.id
                ? 'bg-forest bg-opacity-20 border-2 border-forest'
                : 'bg-white border border-gray-200 hover:border-forest hover:shadow-sm'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-gray-800">{location.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{location.description}</p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  location.explored
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {location.explorationProgress}%
              </span>
            </div>
            <div className="mt-2">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    location.explored ? 'bg-green-500' : 'bg-forest'
                  }`}
                  style={{ width: `${location.explorationProgress}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {undiscoveredCount > 0 && (
        <div className="mt-4 text-center text-sm text-gray-500">
          还有 {undiscoveredCount} 个地点待发现...
        </div>
      )}
    </div>
  );
};

export default LocationList;
