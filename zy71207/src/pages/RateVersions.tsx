import { useEffect } from 'react';
import { Percent, Calendar, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuditStore } from '../store/audit.store';

export function RateVersions() {
  const { rates, contracts, fetchRates, fetchContracts } = useAuditStore();

  useEffect(() => {
    fetchRates();
    fetchContracts();
  }, [fetchRates, fetchContracts]);

  const getProducts = () => {
    const productMap = new Map<string, typeof rates>();
    rates.forEach((rate) => {
      const existing = productMap.get(rate.productId) || [];
      productMap.set(rate.productId, [...existing, rate]);
    });
    return Array.from(productMap.entries()).map(([productId, rates]) => {
      const contract = contracts.find((c) => c.productId === productId);
      return {
        productId,
        productName: contract?.productName || productId,
        rates: rates.sort(
          (a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime()
        ),
      };
    });
  };

  const formatRate = (rate: number) => `${(rate * 100).toFixed(2)}%`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">费率版本</h1>
        <p className="text-dark-muted mt-1">
          管理产品费率版本配置，查看费率变更历史
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {getProducts().map((product, productIndex) => (
          <div key={product.productId} className="card animate-slide-up" style={{ animationDelay: `${productIndex * 100}ms` }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white">{product.productName}</h3>
                <p className="text-xs text-dark-muted font-mono">{product.productId}</p>
              </div>
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-primary-400" />
                <span className="text-sm text-dark-muted">共 {product.rates.length} 个版本</span>
              </div>
            </div>

            <div className="relative">
              {product.rates.map((rate, index) => {
                const isFirst = index === 0;
                const isLast = index === product.rates.length - 1;
                const prevRate = product.rates[index - 1];
                const totalRate = rate.managementFeeRate + rate.serviceFeeRate;
                const prevTotalRate = prevRate
                  ? prevRate.managementFeeRate + prevRate.serviceFeeRate
                  : 0;
                const rateChange = totalRate - prevTotalRate;

                return (
                  <div key={rate.id} className="relative">
                    {!isLast && (
                      <div className="absolute left-[19px] top-10 w-0.5 h-full bg-dark-border" />
                    )}
                    <div className="flex gap-4 pb-8 last:pb-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                          isFirst
                            ? 'bg-gradient-to-br from-primary-500 to-accent-600'
                            : 'bg-dark-surface border-2 border-dark-border'
                        }`}
                      >
                        <span className="text-xs font-bold text-white font-mono">
                          v{index + 1}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-white">{rate.version}</span>
                          {!isFirst && (
                            <span
                              className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded-full ${
                                rateChange > 0
                                  ? 'bg-red-900/30 text-red-400'
                                  : rateChange < 0
                                    ? 'bg-emerald-900/30 text-emerald-400'
                                    : 'bg-gray-800 text-gray-400'
                              }`}
                            >
                              {rateChange > 0 ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              {rateChange > 0 ? '+' : ''}
                              {formatRate(rateChange)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-dark-muted mb-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            生效日期: {rate.effectiveDate}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-3 bg-dark-bg/50 rounded-lg">
                            <p className="text-xs text-dark-muted mb-1">管理费</p>
                            <p className="font-mono font-bold text-white">
                              {formatRate(rate.managementFeeRate)}
                            </p>
                          </div>
                          <div className="p-3 bg-dark-bg/50 rounded-lg">
                            <p className="text-xs text-dark-muted mb-1">服务费</p>
                            <p className="font-mono font-bold text-white">
                              {formatRate(rate.serviceFeeRate)}
                            </p>
                          </div>
                          <div className="p-3 bg-primary-900/20 rounded-lg border border-primary-700/30">
                            <p className="text-xs text-dark-muted mb-1">合计</p>
                            <p className="font-mono font-bold text-primary-400">
                              {formatRate(totalRate)}
                            </p>
                          </div>
                        </div>
                        {rate.description && (
                          <div className="mt-3 p-3 bg-dark-bg/50 rounded-lg">
                            <p className="text-xs text-dark-muted mb-1 flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              说明
                            </p>
                            <p className="text-sm text-dark-text">{rate.description}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RateVersions;
