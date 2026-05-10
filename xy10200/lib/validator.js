const { CONFLICT_TYPES, SOURCE_TYPES, Conflict } = require('./models');

class Validator {
  constructor() {}

  validateYardCoordinates(positions) {
    const conflicts = [];
    const validPattern = /^[A-Z]\d{2}-\d{2}-\d{2}$/;

    for (const pos of positions) {
      if (!validPattern.test(pos.originalPosition)) {
        conflicts.push(new Conflict({
          type: CONFLICT_TYPES.YARD_COORDINATE,
          containerNo: pos.containerNo,
          description: `原始位置格式错误: ${pos.originalPosition}，应为格式 A01-01-01`,
          sourceRecords: [{ source: pos.source, position: pos.originalPosition }],
          affectedPositions: [pos.originalPosition],
          severity: 'high',
        }));
      }
      if (pos.currentPosition && !validPattern.test(pos.currentPosition)) {
        conflicts.push(new Conflict({
          type: CONFLICT_TYPES.YARD_COORDINATE,
          containerNo: pos.containerNo,
          description: `当前位置格式错误: ${pos.currentPosition}，应为格式 A01-01-01`,
          sourceRecords: [{ source: pos.source, position: pos.currentPosition }],
          affectedPositions: [pos.currentPosition],
          severity: 'high',
        }));
      }
    }

    return conflicts;
  }

  validatePositionOccupancy(positions) {
    const conflicts = [];
    const occupancyMap = new Map();

    for (const pos of positions) {
      const key = pos.currentPosition || pos.originalPosition;
      if (!occupancyMap.has(key)) {
        occupancyMap.set(key, new Map());
      }
      const containersAtPosition = occupancyMap.get(key);
      if (!containersAtPosition.has(pos.containerNo)) {
        containersAtPosition.set(pos.containerNo, []);
      }
      containersAtPosition.get(pos.containerNo).push(pos);
    }

    for (const [position, containersAtPosition] of occupancyMap) {
      if (containersAtPosition.size > 1) {
        const containerNos = Array.from(containersAtPosition.keys()).join(', ');
        const allRecords = [];
        for (const [containerNo, records] of containersAtPosition) {
          for (const rec of records) {
            allRecords.push({
              containerNo: containerNo,
              source: rec.source,
              position: position,
            });
          }
        }
        
        conflicts.push(new Conflict({
          type: CONFLICT_TYPES.POSITION_OCCUPANCY,
          containerNo: Array.from(containersAtPosition.keys())[0],
          description: `箱位 ${position} 被多个不同集装箱占用: ${containerNos}`,
          sourceRecords: allRecords,
          affectedPositions: [position],
          severity: 'critical',
        }));
      }
    }

    return conflicts;
  }

  validateMultiSourceConsistency(positions) {
    const conflicts = [];
    const containerMap = new Map();

    for (const pos of positions) {
      if (!containerMap.has(pos.containerNo)) {
        containerMap.set(pos.containerNo, []);
      }
      containerMap.get(pos.containerNo).push(pos);
    }

    for (const [containerNo, records] of containerMap) {
      if (records.length > 1) {
        const positionsMap = new Map();
        for (const rec of records) {
          const pos = rec.currentPosition || rec.originalPosition;
          if (!positionsMap.has(pos)) {
            positionsMap.set(pos, []);
          }
          positionsMap.get(pos).push(rec);
        }

        if (positionsMap.size > 1) {
          const sourcePositions = [];
          const allPositions = [];
          
          for (const rec of records) {
            const pos = rec.currentPosition || rec.originalPosition;
            sourcePositions.push({
              source: rec.source,
              position: pos,
              timestamp: rec.timestamp,
            });
            if (!allPositions.includes(pos)) {
              allPositions.push(pos);
            }
          }

          conflicts.push(new Conflict({
            type: CONFLICT_TYPES.MULTI_SOURCE,
            containerNo: containerNo,
            description: `集装箱 ${containerNo} 在多源数据中位置不一致`,
            sourceRecords: sourcePositions,
            affectedPositions: allPositions,
            severity: 'high',
          }));
        }
      }
    }

    return conflicts;
  }

  validateShiftChain(positions, shifts) {
    const conflicts = [];
    const containerMap = new Map();

    for (const pos of positions) {
      if (!containerMap.has(pos.containerNo)) {
        containerMap.set(pos.containerNo, { gate: null, yard: null });
      }
      if (pos.source === SOURCE_TYPES.GATE_SYSTEM) {
        containerMap.get(pos.containerNo).gate = pos;
      }
      if (pos.source === SOURCE_TYPES.YARD_INVENTORY) {
        containerMap.get(pos.containerNo).yard = pos;
      }
    }

    const shiftsByContainer = new Map();
    for (const shift of shifts) {
      if (!shiftsByContainer.has(shift.containerNo)) {
        shiftsByContainer.set(shift.containerNo, []);
      }
      shiftsByContainer.get(shift.containerNo).push(shift);
    }

    for (const [containerNo, { gate, yard }] of containerMap) {
      if (gate && yard) {
        const gatePos = gate.currentPosition || gate.originalPosition;
        const yardPos = yard.currentPosition || yard.originalPosition;

        if (gatePos !== yardPos) {
          const containerShifts = (shiftsByContainer.get(containerNo) || [])
            .sort((a, b) => a.sequence - b.sequence);

          let currentPos = gatePos;
          const actualPath = [gatePos];

          for (const shift of containerShifts) {
            if (shift.fromPosition !== currentPos) {
              conflicts.push(new Conflict({
                type: CONFLICT_TYPES.SHIFT_CHAIN_BROKEN,
                containerNo: containerNo,
                description: `移位链断裂: 期望从 ${currentPos} 开始，但移位记录显示从 ${shift.fromPosition} 开始`,
                sourceRecords: [
                  { source: 'gate_system', position: gatePos },
                  { source: 'tally_record', from: shift.fromPosition, to: shift.toPosition, sequence: shift.sequence },
                ],
                affectedPositions: [currentPos, shift.fromPosition],
                severity: 'critical',
              }));
              break;
            }
            currentPos = shift.toPosition;
            actualPath.push(currentPos);
          }

          if (currentPos !== yardPos) {
            conflicts.push(new Conflict({
              type: CONFLICT_TYPES.SHIFT_CHAIN_BROKEN,
              containerNo: containerNo,
              description: `移位链终点不匹配: 移位链终点 ${currentPos} 与堆场清单位置 ${yardPos} 不一致`,
              sourceRecords: [
                { source: 'tally_record', endPosition: currentPos, path: actualPath },
                { source: 'yard_inventory', position: yardPos },
              ],
              affectedPositions: [currentPos, yardPos],
              severity: 'critical',
            }));
          }
        }
      }
    }

    return conflicts;
  }

  validateAll(positions, shifts) {
    const allConflicts = [];

    allConflicts.push(...this.validateYardCoordinates(positions));
    allConflicts.push(...this.validatePositionOccupancy(positions));
    allConflicts.push(...this.validateMultiSourceConsistency(positions));
    allConflicts.push(...this.validateShiftChain(positions, shifts));

    return allConflicts;
  }
}

module.exports = { Validator };
