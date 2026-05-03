import { TileType, PersonConfig } from './levels.js';
import { isTileWalkable, isExitTile } from './state.js';

export function findPath(state, startX, startY, targetX, targetY) {
  const grid = state.grid;
  const startCol = Math.floor(startX);
  const startRow = Math.floor(startY);
  const targetCol = Math.floor(targetX);
  const targetRow = Math.floor(targetY);
  
  if (!isTileWalkable(state, startCol, startRow) && !isExitTile(state, startCol, startRow)) {
    return [];
  }
  
  if (!isTileWalkable(state, targetCol, targetRow) && !isExitTile(state, targetCol, targetRow)) {
    return [];
  }
  
  if (startCol === targetCol && startRow === targetRow) {
    return [{ x: startCol, y: startRow }];
  }
  
  const openSet = [];
  const closedSet = new Set();
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();
  
  const startKey = `${startCol},${startRow}`;
  gScore.set(startKey, 0);
  fScore.set(startKey, heuristic(startCol, startRow, targetCol, targetRow));
  openSet.push({ x: startCol, y: startRow, f: fScore.get(startKey) });
  
  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();
    const currentKey = `${current.x},${current.y}`;
    
    if (current.x === targetCol && current.y === targetRow) {
      return reconstructPath(cameFrom, current.x, current.y);
    }
    
    closedSet.add(currentKey);
    
    const neighbors = getNeighbors(state, current.x, current.y);
    
    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x},${neighbor.y}`;
      
      if (closedSet.has(neighborKey)) {
        continue;
      }
      
      const tentativeGScore = (gScore.get(currentKey) || 0) + 
        getMoveCost(state, current.x, current.y, neighbor.x, neighbor.y);
      
      const existingInOpen = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);
      
      if (!existingInOpen || tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
        cameFrom.set(neighborKey, { x: current.x, y: current.y });
        gScore.set(neighborKey, tentativeGScore);
        fScore.set(neighborKey, tentativeGScore + heuristic(neighbor.x, neighbor.y, targetCol, targetRow));
        
        if (!existingInOpen) {
          openSet.push({ x: neighbor.x, y: neighbor.y, f: fScore.get(neighborKey) });
        }
      }
    }
  }
  
  return [];
}

function heuristic(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

function getMoveCost(state, fromX, fromY, toX, toY) {
  const persons = state.persons.filter(p => 
    p.state === 'moving' || p.state === 'blocked'
  );
  
  let crowdCost = 0;
  for (const person of persons) {
    const dist = Math.abs(person.x - toX) + Math.abs(person.y - toY);
    if (dist < 1.0) {
      crowdCost += 0.5;
    }
  }
  
  return 1 + crowdCost;
}

function getNeighbors(state, x, y) {
  const neighbors = [];
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 }
  ];
  
  for (const dir of directions) {
    const nx = x + dir.dx;
    const ny = y + dir.dy;
    
    if (isTileWalkable(state, nx, ny) || isExitTile(state, nx, ny)) {
      neighbors.push({ x: nx, y: ny });
    }
  }
  
  return neighbors;
}

function reconstructPath(cameFrom, x, y) {
  const path = [{ x, y }];
  let currentKey = `${x},${y}`;
  
  while (cameFrom.has(currentKey)) {
    const prev = cameFrom.get(currentKey);
    path.unshift({ x: prev.x, y: prev.y });
    currentKey = `${prev.x},${prev.y}`;
  }
  
  return path;
}

export function checkCongestion(state, person, deltaTime) {
  const persons = state.persons.filter(p => 
    p.id !== person.id && (p.state === 'moving' || p.state === 'blocked')
  );
  
  let isBlocked = false;
  let nearbyCount = 0;
  
  for (const other of persons) {
    const dist = Math.sqrt(
      Math.pow(person.x - other.x, 2) + 
      Math.pow(person.y - other.y, 2)
    );
    
    if (dist < 0.8) {
      nearbyCount++;
    }
    
    if (dist < 0.5 && person.path.length > person.pathIndex) {
      const nextPoint = person.path[person.pathIndex];
      const distToNext = Math.sqrt(
        Math.pow(person.x - nextPoint.x, 2) + 
        Math.pow(person.y - nextPoint.y, 2)
      );
      const otherDistToNext = Math.sqrt(
        Math.pow(other.x - nextPoint.x, 2) + 
        Math.pow(other.y - nextPoint.y, 2)
      );
      
      if (otherDistToNext < distToNext && dist < 1.0) {
        isBlocked = true;
      }
    }
  }
  
  return {
    isBlocked,
    nearbyCount,
    crowdMultiplier: Math.max(0.3, 1.0 - nearbyCount * 0.1)
  };
}

export function updatePersonMovement(state, person, deltaTime) {
  if (person.state === 'evacuated' || person.state === 'panicked' || person.state === 'lost') {
    return person;
  }
  
  const config = PersonConfig[person.type];
  
  let targetX = person.targetX;
  let targetY = person.targetY;
  
  if (person.customTarget) {
    targetX = person.customTarget.x;
    targetY = person.customTarget.y;
  }
  
  if (person.path.length === 0 || person.pathIndex >= person.path.length) {
    const newPath = findPath(state, person.x, person.y, targetX, targetY);
    return {
      ...person,
      path: newPath,
      pathIndex: 0
    };
  }
  
  const congestion = checkCongestion(state, person, deltaTime);
  
  let actualSpeed = person.speed * congestion.crowdMultiplier;
  
  if (congestion.isBlocked) {
    const blockedTime = person.blockedTime + deltaTime;
    const patienceDecay = config.patienceDecayRate * deltaTime * (1 + blockedTime * 0.1);
    const newPatience = Math.max(0, person.patience - patienceDecay);
    
    let newState = person.state;
    if (newPatience <= 0) {
      newState = 'panicked';
    } else if (blockedTime > 3) {
      newState = 'blocked';
      
      const newPath = findPath(state, person.x, person.y, targetX, targetY);
      if (newPath.length > 0 && (
        newPath.length !== person.path.length ||
        JSON.stringify(newPath[0]) !== JSON.stringify(person.path[0])
      )) {
        return {
          ...person,
          path: newPath,
          pathIndex: 0,
          blockedTime: 0,
          state: 'moving',
          patience: newPatience
        };
      }
    }
    
    return {
      ...person,
      blockedTime,
      state: newState,
      patience: newPatience
    };
  }
  
  const currentTarget = person.path[person.pathIndex];
  const dx = currentTarget.x - person.x;
  const dy = currentTarget.y - person.y;
  const distToTarget = Math.sqrt(dx * dx + dy * dy);
  
  if (distToTarget < 0.1) {
    const newPathIndex = person.pathIndex + 1;
    
    if (isExitTile(state, currentTarget.x, currentTarget.y)) {
      return {
        ...person,
        state: 'evacuated',
        x: currentTarget.x,
        y: currentTarget.y
      };
    }
    
    return {
      ...person,
      pathIndex: newPathIndex,
      x: currentTarget.x,
      y: currentTarget.y,
      blockedTime: 0,
      state: 'moving'
    };
  }
  
  const moveDistance = actualSpeed * deltaTime;
  const moveRatio = Math.min(1, moveDistance / distToTarget);
  
  const newX = person.x + dx * moveRatio;
  const newY = person.y + dy * moveRatio;
  
  return {
    ...person,
    x: newX,
    y: newY,
    blockedTime: 0,
    state: 'moving',
    actualSpeed
  };
}

export function applyVolunteerEffect(state) {
  const newState = { ...state };
  const affectedPersons = new Set();
  
  for (const volunteer of state.volunteers) {
    for (const person of state.persons) {
      if (affectedPersons.has(person.id)) continue;
      if (person.state === 'evacuated' || person.state === 'panicked') continue;
      
      const dist = Math.sqrt(
        Math.pow(person.x - volunteer.x, 2) + 
        Math.pow(person.y - volunteer.y, 2)
      );
      
      if (dist <= volunteer.effectRadius) {
        affectedPersons.add(person.id);
        
        person.patience = Math.min(
          person.maxPatience,
          person.patience + 5 * 0.016
        );
        
        if (volunteer.direction && person.customTarget === null) {
          let targetX = volunteer.x;
          let targetY = volunteer.y;
          
          switch (volunteer.direction) {
            case 'up': targetY -= 2; break;
            case 'down': targetY += 2; break;
            case 'left': targetX -= 2; break;
            case 'right': targetX += 2; break;
          }
          
          if (isTileWalkable(state, targetX, targetY) || isExitTile(state, targetX, targetY)) {
            person.customTarget = { x: targetX, y: targetY };
            person.directedBy = volunteer.id;
            person.path = [];
            person.pathIndex = 0;
          }
        }
      }
    }
  }
  
  for (const person of state.persons) {
    if (person.directedBy && !affectedPersons.has(person.id)) {
      const volunteer = state.volunteers.find(v => v.id === person.directedBy);
      if (volunteer) {
        const dist = Math.sqrt(
          Math.pow(person.x - volunteer.x, 2) + 
          Math.pow(person.y - volunteer.y, 2)
        );
        if (dist > volunteer.effectRadius * 1.5) {
          person.customTarget = null;
          person.directedBy = null;
          person.path = [];
          person.pathIndex = 0;
        }
      }
    }
  }
  
  return newState;
}

export function updateAllPersons(state, deltaTime) {
  let peopleEvacuated = state.peopleEvacuated;
  let peoplePanicked = state.peoplePanicked;
  
  const stateWithVolunteerEffect = applyVolunteerEffect(state);
  
  const updatedPersons = stateWithVolunteerEffect.persons.map(person => {
    const updated = updatePersonMovement(stateWithVolunteerEffect, person, deltaTime);
    
    if (updated.state === 'evacuated' && person.state !== 'evacuated') {
      peopleEvacuated++;
    }
    if (updated.state === 'panicked' && person.state !== 'panicked') {
      peoplePanicked++;
    }
    
    return updated;
  });
  
  return {
    ...stateWithVolunteerEffect,
    persons: updatedPersons,
    peopleEvacuated,
    peoplePanicked
  };
}
