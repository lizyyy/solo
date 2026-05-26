import {
  GridCell,
  Chemical,
  Violation,
  HazardCategory,
  CorrosiveSubType,
  GRID_ROWS,
  GRID_COLS
} from '../types';
import { getAdjacencyRule, PENALTIES } from '../data/rules';
import { getChemicalById } from '../data/chemicals';

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11);
};

export const calculateManhattanDistance = (
  cell1: { row: number; col: number },
  cell2: { row: number; col: number }
): number => {
  return Math.abs(cell1.row - cell2.row) + Math.abs(cell1.col - cell2.col);
};

export const getNeighbors = (
  row: number,
  col: number
): { row: number; col: number }[] => {
  const neighbors: { row: number; col: number }[] = [];
  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ];

  for (const [dr, dc] of directions) {
    const newRow = row + dr;
    const newCol = col + dc;
    if (newRow >= 0 && newRow < GRID_ROWS && newCol >= 0 && newCol < GRID_COLS) {
      neighbors.push({ row: newRow, col: newCol });
    }
  }
  return neighbors;
};

export const getEffectiveCategory = (
  chemical: Chemical
): HazardCategory | CorrosiveSubType => {
  if (
    chemical.category === HazardCategory.CORROSIVE &&
    chemical.corrosiveSubType
  ) {
    return chemical.corrosiveSubType;
  }
  return chemical.category;
};

export const checkAdjacency = (
  grid: GridCell[][],
  chemical: Chemical,
  targetCell: { row: number; col: number }
): Violation[] => {
  const violations: Violation[] = [];
  const neighbors = getNeighbors(targetCell.row, targetCell.col);
  const chemicalCategory = getEffectiveCategory(chemical);

  for (const neighbor of neighbors) {
    const neighborCell = grid[neighbor.row][neighbor.col];
    if (!neighborCell.chemicalId) continue;

    const neighborChemical = getChemicalById(neighborCell.chemicalId);
    if (!neighborChemical) continue;

    const neighborCategory = getEffectiveCategory(neighborChemical);
    const rule = getAdjacencyRule(chemicalCategory, neighborCategory);

    if (rule && rule.severity !== 'allowed') {
      violations.push({
        id: generateId(),
        type: rule.severity === 'severe' ? 'severe' : 'adjacency',
        description: rule.description,
        penalty: rule.severity === 'severe' ? 0 : PENALTIES.ADJACENCY_FIRST,
        involvedCells: [targetCell, neighbor],
        timestamp: Date.now(),
        isContinuous: rule.severity === 'warning'
      });
    }
  }

  return violations;
};

export const checkIsolationDistance = (
  grid: GridCell[][],
  chemical: Chemical,
  targetCell: { row: number; col: number },
  excludeSelf: boolean = true
): Violation | null => {
  const requiredDistance = chemical.storageRequirements.isolationDistance;
  if (requiredDistance <= 0) return null;

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const cell = grid[row][col];
      if (!cell.chemicalId) continue;
      if (excludeSelf && row === targetCell.row && col === targetCell.col) continue;

      const distance = calculateManhattanDistance(targetCell, { row, col });
      if (distance < requiredDistance) {
        const otherChemical = getChemicalById(cell.chemicalId);
        return {
          id: generateId(),
          type: 'isolation',
          description: `${chemical.name}需要与${otherChemical?.name || '其他化学品'}保持至少${requiredDistance}格的隔离距离`,
          penalty: PENALTIES.ISOLATION,
          involvedCells: [targetCell, { row, col }],
          timestamp: Date.now(),
          isContinuous: false
        };
      }
    }
  }
  return null;
};

export const checkZoneRequirement = (
  chemical: Chemical,
  targetCell: GridCell
): Violation | null => {
  if (!chemical.specialZones || chemical.specialZones.length === 0) return null;

  if (!chemical.specialZones.includes(targetCell.zoneType)) {
    return {
      id: generateId(),
      type: 'zone',
      description: `${chemical.name}需要存放在${chemical.specialZones.join('或')}`,
      penalty: PENALTIES.ZONE,
      involvedCells: [{ row: targetCell.row, col: targetCell.col }],
      timestamp: Date.now(),
      isContinuous: false
    };
  }
  return null;
};

export const checkTemperature = (
  placedChemicals: string[],
  currentTemp: number
): Violation[] => {
  const violations: Violation[] = [];

  for (const chemicalId of placedChemicals) {
    const chemical = getChemicalById(chemicalId);
    if (!chemical) continue;

    const { minTemp, maxTemp } = chemical.storageRequirements;
    if (currentTemp < minTemp || currentTemp > maxTemp) {
      violations.push({
        id: generateId(),
        type: 'temperature',
        description: `${chemical.name}存储温度要求${minTemp}°C~${maxTemp}°C，当前${currentTemp}°C`,
        penalty: PENALTIES.TEMPERATURE_FIRST,
        involvedCells: [],
        timestamp: Date.now(),
        isContinuous: true
      });
    }
  }

  return violations;
};

export const validatePlacement = (
  grid: GridCell[][],
  chemical: Chemical,
  targetCell: { row: number; col: number }
): { valid: boolean; violations: Violation[] } => {
  const allViolations: Violation[] = [];

  const cell = grid[targetCell.row][targetCell.col];
  if (cell.chemicalId) {
    return {
      valid: false,
      violations: [
        {
          id: generateId(),
          type: 'zone',
          description: '该位置已被占用',
          penalty: 0,
          involvedCells: [targetCell],
          timestamp: Date.now(),
          isContinuous: false
        }
      ]
    };
  }

  const zoneViolation = checkZoneRequirement(chemical, cell);
  if (zoneViolation) allViolations.push(zoneViolation);

  const isolationViolation = checkIsolationDistance(grid, chemical, targetCell);
  if (isolationViolation) allViolations.push(isolationViolation);

  const adjacencyViolations = checkAdjacency(grid, chemical, targetCell);
  allViolations.push(...adjacencyViolations);

  const hasSevereViolation = allViolations.some(v => v.type === 'severe');
  if (hasSevereViolation) {
    return { valid: false, violations: allViolations };
  }

  return {
    valid: true,
    violations: allViolations
  };
};

export const checkAllViolations = (
  grid: GridCell[][],
  placedChemicals: string[],
  currentTemp: number
): Violation[] => {
  const violations: Violation[] = [];

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const cell = grid[row][col];
      if (!cell.chemicalId) continue;

      const chemical = getChemicalById(cell.chemicalId);
      if (!chemical) continue;

      const zoneViolation = checkZoneRequirement(chemical, cell);
      if (zoneViolation) violations.push(zoneViolation);

      const isolationViolation = checkIsolationDistance(grid, chemical, { row, col });
      if (isolationViolation) violations.push(isolationViolation);

      const adjacencyViolations = checkAdjacency(grid, chemical, { row, col });
      violations.push(...adjacencyViolations);
    }
  }

  const tempViolations = checkTemperature(placedChemicals, currentTemp);
  violations.push(...tempViolations);

  return violations;
};
