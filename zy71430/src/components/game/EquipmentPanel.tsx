
import React from 'react';
import { motion } from 'framer-motion';
import { Search, Pickaxe, Zap, Info } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { EQUIPMENT, getEquipmentByType } from '../../data/equipment';
import { MineCell } from '../../types';

interface EquipmentPanelProps {
  selectedCell: MineCell | null;
}

export const EquipmentPanel: React.FC<EquipmentPanelProps> = ({ selectedCell }) => {
  const { selectedEquipment, selectEquipment, scanCell, mineCell, power } = useGameStore();

  const scanners = getEquipmentByType('scanner');
  const drills = getEquipmentByType('drill');

  const handleEquipmentClick = (equipmentId: string) => {
    if (selectedEquipment === equipmentId) {
      selectEquipment(null);
    } else {
      selectEquipment(equipmentId);
    }
  };

  const handleExecute = () => {
    if (!selectedEquipment || !selectedCell) return;

    const equipment = EQUIPMENT.find((e) => e.id === selectedEquipment);
    if (!equipment) return;

    if (power < equipment.powerCost) {
      return;
    }

    if (equipment.type === 'scanner' && selectedCell.status === 'unknown') {
      scanCell(selectedCell.id, selectedEquipment);
      selectEquipment(null);
    } else if (equipment.type === 'drill' && selectedCell.status === 'scanned') {
      mineCell(selectedCell.id, selectedEquipment);
      selectEquipment(null);
    }
  };

  const canExecute = () => {
    if (!selectedEquipment || !selectedCell) return false;

    const equipment = EQUIPMENT.find((e) => e.id === selectedEquipment);
    if (!equipment) return false;

    if (power < equipment.powerCost) return false;

    if (equipment.type === 'scanner' && selectedCell.status === 'unknown') return true;
    if (equipment.type === 'drill' && selectedCell.status === 'scanned' && selectedCell.playerGuess !== null) return true;

    return false;
  };

  const getEquipmentIcon = (type: string) => {
    switch (type) {
      case 'scanner':
        return <Search className="w-5 h-5" />;
      case 'drill':
        return <Pickaxe className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getActionText = () => {
    if (!selectedEquipment || !selectedCell) return '选择设备和目标';

    const equipment = EQUIPMENT.find((e) => e.id === selectedEquipment);
    if (!equipment) return '选择设备和目标';

    if (equipment.type === 'scanner') {
      if (selectedCell.status !== 'unknown') return '该格子已被探测';
    } else if (equipment.type === 'drill') {
      if (selectedCell.status !== 'scanned') return '请先扫描该格子';
      if (selectedCell.playerGuess === null) return '请先判断矿石类型';
    }

    if (power < equipment.powerCost) return '电量不足';

    return `执行 ${equipment.name}`;
  };

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg p-4 shadow-xl">
      <h3 className="text-slate-200 font-semibold mb-3 flex items-center gap-2">
        <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
        设备面板
      </h3>

      <div className="space-y-4">
        <div>
          <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-2">扫描设备</h4>
          <div className="space-y-2">
            {scanners.map((equipment) => (
              <motion.button
                key={equipment.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleEquipmentClick(equipment.id)}
                className={`w-full p-3 rounded-lg border text-left transition-all ${
                  selectedEquipment === equipment.id
                    ? 'border-cyan-500 bg-cyan-900/30 shadow-lg shadow-cyan-500/20'
                    : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                } ${power < equipment.powerCost ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      selectedEquipment === equipment.id
                        ? 'bg-cyan-500/30 text-cyan-400'
                        : 'bg-slate-600 text-slate-300'
                    }`}
                  >
                    {getEquipmentIcon(equipment.type)}
                  </div>
                  <div className="flex-1">
                    <div className="text-slate-200 text-sm font-medium">
                      {equipment.name}
                    </div>
                    <div className="text-slate-400 text-xs">
                      {equipment.description}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-amber-400">
                    <Zap className="w-3 h-3" />
                    <span className="text-sm font-mono">{equipment.powerCost}</span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-2">开采设备</h4>
          <div className="space-y-2">
            {drills.map((equipment) => (
              <motion.button
                key={equipment.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleEquipmentClick(equipment.id)}
                className={`w-full p-3 rounded-lg border text-left transition-all ${
                  selectedEquipment === equipment.id
                    ? 'border-orange-500 bg-orange-900/30 shadow-lg shadow-orange-500/20'
                    : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                } ${power < equipment.powerCost ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      selectedEquipment === equipment.id
                        ? 'bg-orange-500/30 text-orange-400'
                        : 'bg-slate-600 text-slate-300'
                    }`}
                  >
                    {getEquipmentIcon(equipment.type)}
                  </div>
                  <div className="flex-1">
                    <div className="text-slate-200 text-sm font-medium">
                      {equipment.name}
                    </div>
                    <div className="text-slate-400 text-xs">
                      {equipment.description}
                    </div>
                    <div className="text-cyan-400 text-xs">
                      效率: {(equipment.efficiency * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-amber-400">
                    <Zap className="w-3 h-3" />
                    <span className="text-sm font-mono">{equipment.powerCost}</span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        <motion.button
          whileHover={canExecute() ? { scale: 1.02 } : {}}
          whileTap={canExecute() ? { scale: 0.98 } : {}}
          onClick={handleExecute}
          disabled={!canExecute()}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
            canExecute()
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          {getActionText()}
        </motion.button>

        {selectedCell && (
          <div className="text-xs text-slate-400 text-center">
            当前目标: 位置 ({selectedCell.x + 1}, {selectedCell.y + 1}) -
            {selectedCell.status === 'unknown' && ' 未探测'}
            {selectedCell.status === 'scanned' &&
              (selectedCell.playerGuess ? ` 已识别: ${selectedCell.isCorrect ? '正确 ✓' : '错误 ✗'}` : ' 待识别')}
            {selectedCell.status === 'mined' && ' 已开采'}
          </div>
        )}
      </div>
    </div>
  );
};
