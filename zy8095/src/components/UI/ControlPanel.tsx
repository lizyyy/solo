import type { CargoItem, Bay, StowageState } from '@/types';
import { getUnplacedCargo } from '@/calculator/stowageCalculator';

interface ControlPanelProps {
  state: StowageState;
  selectedCargo: CargoItem | null;
  selectedBay: Bay | null;
  onSelectCargo: (cargo: CargoItem | null) => void;
  onSelectBay: (bay: Bay | null) => void;
  onPlaceCargo: (cargoId: string, bayId: string) => void;
  onRemoveCargo: (cargoId: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function ControlPanel({
  state,
  selectedCargo,
  selectedBay,
  onSelectCargo,
  onSelectBay,
  onPlaceCargo,
  onRemoveCargo,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
}: ControlPanelProps) {
  const unplacedCargo = getUnplacedCargo(state);

  const handlePlace = () => {
    if (selectedCargo && selectedBay) {
      onPlaceCargo(selectedCargo.id, selectedBay.id);
    }
  };

  const handleRemove = () => {
    if (selectedCargo) {
      onRemoveCargo(selectedCargo.id);
      onSelectCargo(null);
    }
  };

  return (
    <div className="control-panel">
      <div className="section">
        <h3>未配载货物</h3>
        <div className="cargo-list">
          {unplacedCargo.map(cargo => (
            <div
              key={cargo.id}
              className={`cargo-item ${selectedCargo?.id === cargo.id ? 'selected' : ''}`}
              onClick={() => onSelectCargo(cargo)}
            >
              <div className="cargo-header">
                <span className="container-no">{cargo.containerNo}</span>
                {cargo.isDangerous && <span className="dg-badge">危险品</span>}
              </div>
              <div className="cargo-info">
                <span>重量: {cargo.weight ?? '未知'}吨</span>
                <span>类别: {cargo.category}</span>
              </div>
            </div>
          ))}
          {unplacedCargo.length === 0 && (
            <p className="empty">所有货物已配载</p>
          )}
        </div>
      </div>

      <div className="section">
        <h3>舱位列表</h3>
        <div className="bay-list">
          {state.bays.map(bay => (
            <div
              key={bay.id}
              className={`bay-item ${selectedBay?.id === bay.id ? 'selected' : ''}`}
              onClick={() => onSelectBay(bay)}
            >
              <div className="bay-header">
                <span className="bay-name">{bay.name}</span>
                <span className={`bay-type ${bay.isDeck ? 'deck' : 'hold'}`}>
                  {bay.isDeck ? '甲板' : '货舱'}
                </span>
              </div>
              <div className="bay-info">
                <span>容量: {bay.maxWeight}吨</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="actions">
        <button 
          className="btn btn-secondary" 
          onClick={handlePlace}
          disabled={!selectedCargo || !selectedBay}
        >
          分配到舱位
        </button>
        <button 
          className="btn btn-danger" 
          onClick={handleRemove}
          disabled={!selectedCargo}
        >
          移除配载
        </button>
      </div>

      <div className="history-actions">
        <button 
          className="btn btn-outline" 
          onClick={onUndo}
          disabled={!canUndo}
        >
          撤销
        </button>
        <button 
          className="btn btn-outline" 
          onClick={onRedo}
          disabled={!canRedo}
        >
          重做
        </button>
        <button 
          className="btn btn-outline" 
          onClick={onClear}
        >
          清空配载
        </button>
      </div>
    </div>
  );
}