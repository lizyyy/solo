import type { Robot } from '../types';

const FLOOR_HEIGHT = 4;

const robotModels = ['AGV-Lite X1', 'AGV-Pro X2', 'AMR-Flex V3', 'AMR-Heavy H1', 'AGV-Slim S1'];
const robotStatuses: Robot['status'][] = ['idle', 'working', 'charging', 'error'];

const generateRandomPosition = (floor: number) => {
  const zBase = (floor - 1) * FLOOR_HEIGHT;
  return {
    x: 2 + Math.random() * 36,
    y: 2 + Math.random() * 26,
    z: zBase,
  };
};

export const robots: Robot[] = [];

for (let i = 0; i < 20; i++) {
  const floor = (i % 3) + 1;
  const statusIndex = i === 18 ? 3 : (i % 4);
  const battery = statusIndex === 2 ? 95 - Math.floor(Math.random() * 10) : 20 + Math.floor(Math.random() * 75);

  robots.push({
    id: `robot-${String(i + 1).padStart(3, '0')}`,
    name: `搬运机器人${String(i + 1).padStart(3, '0')}`,
    model: robotModels[i % robotModels.length],
    status: robotStatuses[statusIndex],
    batteryLevel: battery,
    currentPosition: generateRandomPosition(floor),
    currentFloor: floor,
  });
}

robots[5].currentFloor = 2;
if (robots[5].currentPosition) {
  robots[5].currentPosition!.z = FLOOR_HEIGHT;
}

robots[12].batteryLevel = 8;
robots[12].status = 'idle';

export const workingRobots = robots.filter(r => r.status === 'working');
export const chargingRobots = robots.filter(r => r.status === 'charging');
export const errorRobots = robots.filter(r => r.status === 'error');

export default robots;
