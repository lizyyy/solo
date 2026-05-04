import {
  PhysicsProblemType,
  PhysicsParameter,
  PhysicsSolution,
  ValidationResult,
} from '../../../shared/types';
import { normalizeParameters } from './units';
import { solveIncline, inclineValidParams } from './solvers/inclineSolver';
import { solveProjectile, projectileValidParams } from './solvers/projectileSolver';
import { solveSpring, springValidParams } from './solvers/springSolver';

export interface SolverConfig {
  type: PhysicsProblemType;
  label: string;
  description: string;
  defaultParams: PhysicsParameter[];
  validParams: { name: string; min?: number; max?: number; positive?: boolean; required?: boolean }[];
  solve: (problemId: string, params: PhysicsParameter[], normalizedParams: PhysicsParameter[]) => PhysicsSolution;
}

export const solverConfigs: SolverConfig[] = [
  {
    type: 'incline',
    label: '斜面滑块',
    description: '滑块沿斜面运动的物理问题，支持有摩擦和无摩擦两种情况',
    defaultParams: [
      { name: 'mass', label: '质量', unit: 'kg', value: 2, description: '滑块的质量' },
      { name: 'angle', label: '斜面角度', unit: 'deg', value: 30, description: '斜面与水平面的夹角' },
      { name: 'frictionCoeff', label: '摩擦系数', unit: '', value: 0.1, description: '滑块与斜面的摩擦系数' },
      { name: 'hasFriction', label: '有摩擦', unit: '', value: 1, description: '是否考虑摩擦力（1=考虑，0=不考虑）' },
      { name: 'initialVelocity', label: '初速度', unit: 'm/s', value: 0, description: '滑块的初始速度' },
      { name: 'slideLength', label: '斜面长度', unit: 'm', value: 10, description: '滑块滑动的距离' },
    ],
    validParams: inclineValidParams,
    solve: solveIncline,
  },
  {
    type: 'projectile',
    label: '抛体运动',
    description: '物体在重力场中的抛射运动，支持从地面或高台发射',
    defaultParams: [
      { name: 'initialVelocity', label: '初速度', unit: 'm/s', value: 20, description: '抛射初速度' },
      { name: 'angle', label: '抛射角度', unit: 'deg', value: 45, description: '初速度与水平方向的夹角' },
      { name: 'initialHeight', label: '初始高度', unit: 'm', value: 0, description: '发射点的高度（相对于地面）' },
    ],
    validParams: projectileValidParams,
    solve: solveProjectile,
  },
  {
    type: 'spring',
    label: '弹簧振子',
    description: '弹簧-质量系统的简谐运动，支持有阻尼和无阻尼振动',
    defaultParams: [
      { name: 'mass', label: '振子质量', unit: 'kg', value: 1, description: '振子的质量' },
      { name: 'springConstant', label: '劲度系数', unit: 'N/m', value: 100, description: '弹簧的劲度系数' },
      { name: 'amplitude', label: '振幅', unit: 'm', value: 0.1, description: '最大位移' },
      { name: 'initialDisplacement', label: '初始位移', unit: 'm', value: 0.1, description: 't=0时的位移' },
      { name: 'initialVelocity', label: '初始速度', unit: 'm/s', value: 0, description: 't=0时的速度' },
      { name: 'dampingCoeff', label: '阻尼系数', unit: '', value: 0, description: '阻尼系数（0表示无阻尼）' },
      { name: 'hasDamping', label: '有阻尼', unit: '', value: 0, description: '是否考虑阻尼（1=考虑，0=不考虑）' },
    ],
    validParams: springValidParams,
    solve: solveSpring,
  },
];

export function getSolverConfig(type: PhysicsProblemType): SolverConfig | undefined {
  return solverConfigs.find(config => config.type === type);
}

export function validateAndSolve(
  problemId: string,
  type: PhysicsProblemType,
  params: PhysicsParameter[]
): { validation: ValidationResult; solution?: PhysicsSolution } {
  const config = getSolverConfig(type);
  
  if (!config) {
    return {
      validation: {
        valid: false,
        errors: [{
          field: 'type',
          message: `未知的物理问题类型: ${type}`,
          rule: 'invalid_type',
        }],
      },
    };
  }

  const validation = normalizeParameters(params, config.validParams);
  
  if (!validation.valid || !validation.normalizedParams) {
    return { validation };
  }

  const solution = config.solve(problemId, params, validation.normalizedParams);
  
  return {
    validation,
    solution,
  };
}

export function getDefaultParams(type: PhysicsProblemType): PhysicsParameter[] {
  const config = getSolverConfig(type);
  return config ? [...config.defaultParams] : [];
}
