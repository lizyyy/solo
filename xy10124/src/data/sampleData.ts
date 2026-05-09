import { ProjectConfig, Trajectory, Obstacle, JointState } from '../types';

function generateJointAngleSequence(start: JointState, end: JointState, steps: number): JointState[] {
  const result: JointState[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    result.push({
      joint1: start.joint1 + (end.joint1 - start.joint1) * t,
      joint2: start.joint2 + (end.joint2 - start.joint2) * t,
      joint3: start.joint3 + (end.joint3 - start.joint3) * t,
      joint4: start.joint4 + (end.joint4 - start.joint4) * t,
      joint5: start.joint5 + (end.joint5 - start.joint5) * t,
      joint6: start.joint6 + (end.joint6 - start.joint6) * t
    });
  }
  return result;
}

const keyframes = [
  { joint1: 0, joint2: 0, joint3: 0, joint4: 0, joint5: 0, joint6: 0 },
  { joint1: 30, joint2: -30, joint3: 30, joint4: 15, joint5: 10, joint6: 5 },
  { joint1: 60, joint2: -45, joint3: 60, joint4: 30, joint5: 20, joint6: 10 },
  { joint1: 90, joint2: -30, joint3: 45, joint4: 45, joint5: 15, joint6: 15 },
  { joint1: 120, joint2: -15, joint3: 30, joint4: 60, joint5: 10, joint6: 20 },
  { joint1: 90, joint2: -20, joint3: 50, joint4: 45, joint5: 5, joint6: 15 },
  { joint1: 45, joint2: -10, joint3: 35, joint4: 30, joint5: 0, joint6: 10 },
  { joint1: 0, joint2: 0, joint3: 0, joint4: 0, joint5: 0, joint6: 0 }
];

export const sampleTrajectory: Trajectory = (() => {
  const allJoints: JointState[] = [];
  for (let i = 0; i < keyframes.length - 1; i++) {
    const segment = generateJointAngleSequence(keyframes[i], keyframes[i + 1], 20);
    if (i < keyframes.length - 2) {
      segment.pop();
    }
    allJoints.push(...segment);
  }

  const totalTime = 10;
  const points = allJoints.map((joints, index) => {
    const timestamp = (index / (allJoints.length - 1)) * totalTime;
    return {
      timestamp,
      joints,
      pose: {
        position: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0 }
      }
    };
  });

  return {
    id: 'traj_sample_001',
    name: '示例轨迹 - 搬运任务',
    createdAt: Date.now(),
    points,
    totalTime
  };
})();

export const sampleObstacles: Obstacle[] = [
  {
    id: 'obs_001',
    name: '传送带',
    type: 'forbidden',
    geometry: {
      type: 'box',
      position: { x: 1.2, y: 0.3, z: 0 },
      size: { x: 0.6, y: 0.6, z: 1.2 }
    },
    color: '#ff4757',
    opacity: 0.5
  },
  {
    id: 'obs_002',
    name: '料仓',
    type: 'warning',
    geometry: {
      type: 'cylinder',
      position: { x: -1.0, y: 0.4, z: 0.5 },
      radius: 0.5,
      height: 0.8
    },
    color: '#ffa502',
    opacity: 0.4
  },
  {
    id: 'obs_003',
    name: '工作台',
    type: 'forbidden',
    geometry: {
      type: 'box',
      position: { x: 0, y: 0.05, z: 1.5 },
      size: { x: 1.5, y: 0.1, z: 1.0 }
    },
    color: '#ff6b81',
    opacity: 0.3
  }
];

export const defaultProjectConfig: ProjectConfig = {
  id: 'proj_default',
  name: '默认项目',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  obstacles: sampleObstacles,
  trajectories: [sampleTrajectory],
  workspaceBounds: {
    min: { x: -3, y: -0.5, z: -3 },
    max: { x: 3, y: 3, z: 3 }
  },
  safetyMargin: 0.15
};
