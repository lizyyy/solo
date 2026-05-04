import { InventoryItem } from '../types';

interface InventoryDisplayProps {
  inventory: InventoryItem[];
}

const InventoryDisplay = ({ inventory }: InventoryDisplayProps) => {
  const getTypeIcon = (type: InventoryItem['type']) => {
    switch (type) {
      case 'material':
        return '🪵';
      case 'tool':
        return '🔧';
      case 'food':
        return '🍖';
      case 'medicine':
        return '💊';
      case 'special':
        return '✨';
      default:
        return '📦';
    }
  };

  return (
    <div className="card">
      <h2 className="text-xl font-bold text-gray-800 mb-4">🎒 库存</h2>

      {inventory.length === 0 ? (
        <div className="text-center text-gray-500 py-4">
          背包是空的...
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {inventory.map((item) => (
            <div
              key={item.id}
              className="p-2 bg-gray-50 rounded-lg border border-gray-200"
              title={item.description}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{getTypeIcon(item.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">x{item.quantity}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InventoryDisplay;
