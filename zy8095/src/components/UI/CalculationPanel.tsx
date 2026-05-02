import type { CalculationResult, CargoItem, Bay } from '@/types';

interface CalculationPanelProps {
  result: CalculationResult;
  cargoItems: CargoItem[];
  bays: Bay[];
}

export function CalculationPanel({ result, cargoItems, bays }: CalculationPanelProps) {
  const getCargoById = (id: string) => cargoItems.find(c => c.id === id);
  const getBayById = (id: string) => bays.find(b => b.id === id);

  return (
    <div className="calculation-panel">
      <div className="summary">
        <div className="stat">
          <span className="label">总重量</span>
          <span className="value">{result.totalWeight.toFixed(1)}吨</span>
        </div>
        <div className="stat">
          <span className="label">重心X</span>
          <span className={`value ${Math.abs(result.centerOfGravity.x) > 5 ? 'warning' : ''}`}>
            {result.centerOfGravity.x.toFixed(2)}m
          </span>
        </div>
        <div className="stat">
          <span className="label">重心Y</span>
          <span className="value">{result.centerOfGravity.y.toFixed(2)}m</span>
        </div>
        <div className="stat">
          <span className="label">重心Z</span>
          <span className="value">{result.centerOfGravity.z.toFixed(2)}m</span>
        </div>
        <div className="stat">
          <span className="label">左右平衡</span>
          <span className={`value ${Math.abs(result.portStarboardBalance) > 100 ? 'warning' : ''}`}>
            {result.portStarboardBalance > 0 ? '左' : '右'} {Math.abs(result.portStarboardBalance).toFixed(1)}吨
          </span>
        </div>
        <div className="stat">
          <span className="label">前后平衡</span>
          <span className={`value ${Math.abs(result.foreAftBalance) > 100 ? 'warning' : ''}`}>
            {result.foreAftBalance > 0 ? '前' : '后'} {Math.abs(result.foreAftBalance).toFixed(1)}吨
          </span>
        </div>
      </div>

      {result.overloadWarnings.length > 0 && (
        <div className="warning-section">
          <h3>超载警告</h3>
          <div className="warning-list">
            {result.overloadWarnings.map((warning, index) => {
              const bay = getBayById(warning.bayId);
              return (
                <div key={index} className="warning-item overload">
                  <span className="warning-icon">⚠</span>
                  <div className="warning-content">
                    <span className="warning-title">{bay?.name || warning.bayId}</span>
                    <span className="warning-desc">
                      当前: {warning.currentWeight.toFixed(1)}吨 / 最大: {warning.maxWeight}吨
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {result.dangerousGoodsConflicts.length > 0 && (
        <div className="warning-section">
          <h3>危险品隔离冲突</h3>
          <div className="warning-list">
            {result.dangerousGoodsConflicts.map((conflict, index) => {
              const cargo1 = getCargoById(conflict.cargo1Id);
              const cargo2 = getCargoById(conflict.cargo2Id);
              return (
                <div key={index} className="warning-item danger">
                  <span className="warning-icon">✕</span>
                  <div className="warning-content">
                    <span className="warning-title">
                      {cargo1?.containerNo} 与 {cargo2?.containerNo}
                    </span>
                    <span className="warning-desc">
                      距离: {conflict.distance.toFixed(1)}m / 要求: {conflict.requiredDistance}m
                    </span>
                    <span className="warning-classes">
                      {conflict.classes.class1} ↔ {conflict.classes.class2}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {result.overloadWarnings.length === 0 && result.dangerousGoodsConflicts.length === 0 && (
        <div className="success-section">
          <span className="success-icon">✓</span>
          <span className="success-text">所有配载符合规则</span>
        </div>
      )}
    </div>
  );
}