import { Package, Snowflake, AlertTriangle, Weight, Zap } from 'lucide-react';
import { Cargo, CargoType } from '../../types';
import { useStore } from '../../store/useStore';
import { dangerLevelNames } from '../../utils/sampleData';

interface CargoCardProps {
  cargo: Cargo;
  isLoaded: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

function CargoCard({ cargo, isLoaded, isSelected, onSelect }: CargoCardProps) {
  const typeConfig = {
    heavy: { icon: Weight, color: 'bg-blue-600', border: 'border-blue-500', label: '重货' },
    reefer: { icon: Snowflake, color: 'bg-teal-600', border: 'border-teal-500', label: '冷藏' },
    dangerous: { icon: AlertTriangle, color: 'bg-red-600', border: 'border-red-500', label: '危险品' },
  };

  const config = typeConfig[cargo.type];
  const TypeIcon = config.icon;

  return (
    <div
      className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
        isLoaded
          ? 'opacity-50 cursor-not-allowed'
          : isSelected
          ? `${config.border} bg-gray-800 shadow-lg`
          : 'border-gray-700 bg-gray-800 hover:bg-gray-750 hover:border-gray-600'
      }`}
      onClick={() => !isLoaded && onSelect()}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded ${config.color}`}>
            <TypeIcon className="w-4 h-4 text-white" />
          </div>
          <span className="font-medium text-white text-sm">{cargo.name}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded ${config.color} text-white`}>
          {config.label}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <Weight className="w-3 h-3" />
          {cargo.weight}吨
        </span>
        {cargo.requiresPower && (
          <span className="flex items-center gap-1 text-teal-400">
            <Zap className="w-3 h-3" />
            需供电
          </span>
        )}
        {cargo.dangerLevel && (
          <span className="text-red-400">
            {dangerLevelNames[cargo.dangerLevel]}
          </span>
        )}
      </div>

      {isLoaded && (
        <div className="mt-2 text-xs text-gray-500">已装载</div>
      )}
    </div>
  );
}

export function CargoList() {
  const cargoList = useStore((state) => state.cargoList);
  const bays = useStore((state) => state.bays);
  const selectedCargo = useStore((state) => state.selectedCargo);
  const filterType = useStore((state) => state.filterType);
  const setSelectedCargo = useStore((state) => state.setSelectedCargo);
  const setFilterType = useStore((state) => state.setFilterType);

  const loadedCargoIds = new Set(bays.filter((b) => b.occupiedBy).map((b) => b.occupiedBy));

  const filteredCargo = cargoList.filter(
    (cargo) => filterType === 'all' || cargo.type === filterType
  );

  const filterOptions: { value: CargoType | 'all'; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'heavy', label: '重货' },
    { value: 'reefer', label: '冷藏' },
    { value: 'dangerous', label: '危险品' },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <Package className="w-5 h-5" />
          货物清单
        </h2>

        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                filterType === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => setFilterType(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredCargo.map((cargo) => (
          <CargoCard
          key={cargo.id}
          cargo={cargo}
          isLoaded={loadedCargoIds.has(cargo.id)}
          isSelected={selectedCargo === cargo.id}
          onSelect={() => setSelectedCargo(
            selectedCargo === cargo.id ? null : cargo.id
          )}
        />
        ))}
      </div>

      <div className="p-3 border-t border-gray-700 text-xs text-gray-500">
        提示: 点击选择货物后，点击舱位进行装载
      </div>
    </div>
  );
}
