import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { IndexComponent, Holding } from '../../types';
import { formatCurrency, formatPercent } from '../../utils/calculations';

interface HoldingTableProps {
  holdings: Holding[];
  indexComponents: IndexComponent[];
  totalAssets: number;
  onSelectStock: (code: string, name: string, price: number, isSuspended: boolean, currentHolding: number) => void;
}

export const HoldingTable: React.FC<HoldingTableProps> = ({
  holdings,
  indexComponents,
  totalAssets,
  onSelectStock,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredComponents = indexComponents.filter(c =>
    c.name.includes(searchTerm) || c.code.includes(searchTerm)
  );

  const getHoldingInfo = (code: string) => {
    return holdings.find(h => h.code === code);
  };

  const getWeightDeviation = (component: IndexComponent, holding?: Holding) => {
    if (!holding || totalAssets === 0) return -component.weight / 100;
    const holdingValue = holding.quantity * holding.currentPrice;
    const actualWeight = holdingValue / totalAssets;
    return actualWeight - component.weight / 100;
  };

  const renderDeviationIcon = (deviation: number) => {
    if (deviation > 0.001) {
      return <TrendingUp size={12} className="text-green-500" />;
    } else if (deviation < -0.001) {
      return <TrendingDown size={12} className="text-red-500" />;
    }
    return <Minus size={12} className="text-gray-400" />;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-800">指数成分与持仓</h3>
        <input
          type="text"
          placeholder="搜索股票..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-1 border border-gray-300 rounded text-sm"
        />
      </div>
      
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className="text-left py-2 px-2">代码</th>
              <th className="text-left py-2 px-2">名称</th>
              <th className="text-right py-2 px-2">指数权重</th>
              <th className="text-right py-2 px-2">价格</th>
              <th className="text-right py-2 px-2">持仓</th>
              <th className="text-right py-2 px-2">偏差</th>
              <th className="text-center py-2 px-2">状态</th>
            </tr>
          </thead>
          <tbody>
            {filteredComponents.map((component) => {
              const holding = getHoldingInfo(component.code);
              const deviation = getWeightDeviation(component, holding);
              
              return (
                <tr
                  key={component.code}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onSelectStock(
                    component.code,
                    component.name,
                    component.price,
                    component.isSuspended,
                    holding?.quantity || 0
                  )}
                >
                  <td className="py-2 px-2 font-mono text-xs">{component.code}</td>
                  <td className="py-2 px-2 font-medium">{component.name}</td>
                  <td className="py-2 px-2 text-right font-mono text-xs">{component.weight.toFixed(2)}%</td>
                  <td className="py-2 px-2 text-right font-mono text-xs">{formatCurrency(component.price)}</td>
                  <td className="py-2 px-2 text-right font-mono text-xs">{holding?.quantity || 0}</td>
                  <td className="py-2 px-2 text-right">
                    <span className="inline-flex items-center gap-1 font-mono text-xs">
                      {renderDeviationIcon(deviation)}
                      {formatPercent(Math.abs(deviation))}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    {component.isSuspended ? (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">
                        停牌
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                        正常
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
