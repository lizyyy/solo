import { Plus, Minus } from 'lucide-react';
import type { Product } from '@/types/game';

interface GameControlsProps {
  products: Product[];
  prices: Record<string, number>;
  inventory: Record<string, number>;
  revenue: number;
  onSetPrice: (productId: string, price: number) => void;
  onRestock: (productId: string, amount: number) => void;
}

export function GameControls({ products, prices, inventory, revenue, onSetPrice, onRestock }: GameControlsProps) {
  const handlePriceChange = (productId: string, delta: number) => {
    const currentPrice = prices[productId] || 0;
    onSetPrice(productId, currentPrice + delta);
  };

  const handleRestock = (productId: string) => {
    onRestock(productId, 5);
  };

  return (
    <div className="bg-night-surface/80 backdrop-blur-md rounded-2xl p-4 border border-night-card">
      <h3 className="font-title text-lg text-neon-orange mb-4">🎮 商品管理</h3>

      <div className="space-y-3">
        {products.map((product) => {
          const stock = inventory[product.id] || 0;
          const price = prices[product.id] || product.basePrice;
          const profit = price - product.baseCost;

          return (
            <div
              key={product.id}
              className="bg-night-card rounded-xl p-3 flex items-center gap-3"
            >
              <span className="text-3xl">{product.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-body text-white font-medium truncate">
                    {product.name}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      stock > 0 ? 'bg-neon-green/20 text-neon-green' : 'bg-neon-pink/20 text-neon-pink'
                    }`}
                  >
                    库存: {stock}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handlePriceChange(product.id, -1)}
                      className="p-1 rounded hover:bg-night-surface transition-colors"
                      disabled={price <= 1}
                    >
                      <Minus size={14} className="text-gray-400" />
                    </button>
                    <span className="font-title text-neon-yellow min-w-[60px] text-center">
                      ¥{price}
                    </span>
                    <button
                      onClick={() => handlePriceChange(product.id, 1)}
                      className="p-1 rounded hover:bg-night-surface transition-colors"
                    >
                      <Plus size={14} className="text-gray-400" />
                    </button>
                  </div>
                  <span
                    className={`text-xs ${
                      profit > 0 ? 'text-neon-green' : profit < 0 ? 'text-neon-pink' : 'text-gray-400'
                    }`}
                  >
                    利润: ¥{profit}
                  </span>
                  <button
                    onClick={() => handleRestock(product.id)}
                    className="ml-auto px-3 py-1 rounded-lg bg-neon-orange/20 hover:bg-neon-orange/30 text-neon-orange text-sm transition-colors"
                    disabled={revenue < product.baseCost * 5}
                  >
                    补货 (¥{product.baseCost * 5})
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
