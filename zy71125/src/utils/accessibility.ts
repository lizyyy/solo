import { Container, Yard, AccessibilityResult, Move, Position } from '../types';

export function analyzeAccessibility(
  targetContainer: Container,
  containers: Container[],
  yard: Yard
): AccessibilityResult {
  const { bay, row, tier } = targetContainer;

  const blockingAbove = containers.filter(
    (c) => c.bay === bay && c.row === row && c.tier > tier
  );

  const blockingAboveSorted = [...blockingAbove].sort((a, b) => b.tier - a.tier);

  const leftBlocking = containers.filter(
    (c) => c.bay === bay && c.row < row && c.tier >= tier
  );

  const rightBlocking = containers.filter(
    (c) => c.bay === bay && c.row > row && c.tier >= tier
  );

  const leftSideAccessible = leftBlocking.length === 0 || isSideAccessible(bay, row, tier, containers, 'left');
  const rightSideAccessible = rightBlocking.length === 0 || isSideAccessible(bay, row, tier, containers, 'right');

  const leftCost = calculateSideCost(bay, row, tier, containers, 'left');
  const rightCost = calculateSideCost(bay, row, tier, containers, 'right');

  let optimalSide: 'left' | 'right' = 'right';
  if (leftSideAccessible && rightSideAccessible) {
    optimalSide = leftCost <= rightCost ? 'left' : 'right';
  } else if (leftSideAccessible) {
    optimalSide = 'left';
  } else if (rightSideAccessible) {
    optimalSide = 'right';
  }

  const moves = generateMoves(
    targetContainer,
    blockingAboveSorted,
    containers,
    yard,
    optimalSide
  );

  const totalRelocations = moves.filter((m) => m.type === 'relocation').length;

  return {
    targetContainer,
    blockingContainers: blockingAboveSorted,
    layersAbove: blockingAbove.length,
    leftSideAccessible,
    rightSideAccessible,
    optimalSide,
    minRelocations: totalRelocations,
    moves,
  };
}

function isSideAccessible(
  bay: number,
  row: number,
  tier: number,
  containers: Container[],
  side: 'left' | 'right'
): boolean {
  const rowStep = side === 'left' ? -1 : 1;
  let checkRow = row + rowStep;

  while (checkRow >= 0 && checkRow < 10) {
    const hasBlocking = containers.some(
      (c) => c.bay === bay && c.row === checkRow && c.tier >= tier
    );
    if (!hasBlocking) {
      return true;
    }
    checkRow += rowStep;
  }

  return false;
}

function calculateSideCost(
  bay: number,
  row: number,
  tier: number,
  containers: Container[],
  side: 'left' | 'right'
): number {
  const rowStep = side === 'left' ? -1 : 1;
  let checkRow = row + rowStep;
  let cost = 0;

  while (checkRow >= 0 && checkRow < 10) {
    const blocking = containers.filter(
      (c) => c.bay === bay && c.row === checkRow && c.tier >= tier
    );
    if (blocking.length === 0) {
      break;
    }
    cost += blocking.length;
    checkRow += rowStep;
  }

  return cost;
}

function generateMoves(
  targetContainer: Container,
  blockingAbove: Container[],
  containers: Container[],
  yard: Yard,
  side: 'left' | 'right'
): Move[] {
  const moves: Move[] = [];
  let step = 1;

  for (const blocking of blockingAbove) {
    const targetPosition = findEmptyPosition(blocking, containers, yard, side);
    if (targetPosition) {
      moves.push({
        step: step++,
        type: 'relocation',
        containerId: blocking.id,
        from: { bay: blocking.bay, row: blocking.row, tier: blocking.tier },
        to: targetPosition,
      });

      containers = containers.map((c) =>
        c.id === blocking.id
          ? { ...c, bay: targetPosition.bay, row: targetPosition.row, tier: targetPosition.tier }
          : c
      );
    }
  }

  moves.push({
    step: step++,
    type: 'retrieval',
    containerId: targetContainer.id,
    from: { bay: targetContainer.bay, row: targetContainer.row, tier: targetContainer.tier },
    to: null,
  });

  return moves;
}

function findEmptyPosition(
  container: Container,
  containers: Container[],
  yard: Yard,
  side: 'left' | 'right'
): Position | null {
  const startBay = side === 'left' ? 0 : yard.bays - 1;
  const endBay = side === 'left' ? yard.bays : -1;
  const bayStep = side === 'left' ? 1 : -1;

  for (let bay = startBay; bay !== endBay; bay += bayStep) {
    for (let row = 0; row < yard.rows; row++) {
      const stackContainers = containers.filter(
        (c) => c.bay === bay && c.row === row
      );
      const maxTier = stackContainers.length > 0
        ? Math.max(...stackContainers.map((c) => c.tier))
        : -1;

      if (maxTier < yard.maxTiers - 1) {
        if (bay !== container.bay || row !== container.row || maxTier + 1 !== container.tier) {
          return { bay, row, tier: maxTier + 1 };
        }
      }
    }
  }

  return null;
}

export function getContainerById(
  containers: Container[],
  id: string
): Container | undefined {
  return containers.find((c) => c.id === id);
}

export function filterContainers(
  containers: Container[],
  filter: { bay: number | null; search: string }
): Container[] {
  return containers.filter((c) => {
    if (filter.bay !== null && c.bay !== filter.bay) {
      return false;
    }
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      return c.id.toLowerCase().includes(searchLower);
    }
    return true;
  });
}
