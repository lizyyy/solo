import { SampleStatus } from '../types';

const stateTransitions: Record<SampleStatus, SampleStatus[]> = {
  [SampleStatus.CREATED]: [SampleStatus.COLLECTED, SampleStatus.EXCEPTION],
  [SampleStatus.COLLECTED]: [SampleStatus.IN_TRANSIT, SampleStatus.EXCEPTION],
  [SampleStatus.IN_TRANSIT]: [SampleStatus.ARRIVED, SampleStatus.EXCEPTION, SampleStatus.LOST],
  [SampleStatus.ARRIVED]: [SampleStatus.TESTING, SampleStatus.EXCEPTION],
  [SampleStatus.TESTING]: [SampleStatus.COMPLETED, SampleStatus.EXCEPTION],
  [SampleStatus.COMPLETED]: [],
  [SampleStatus.EXCEPTION]: [SampleStatus.COLLECTED, SampleStatus.IN_TRANSIT, SampleStatus.ARRIVED, SampleStatus.TESTING, SampleStatus.COMPLETED],
  [SampleStatus.LOST]: [SampleStatus.COLLECTED]
};

export class StateMachineService {
  static canTransition(from: SampleStatus, to: SampleStatus): boolean {
    const allowedTransitions = stateTransitions[from];
    return allowedTransitions ? allowedTransitions.includes(to) : false;
  }

  static getNextStates(current: SampleStatus): SampleStatus[] {
    return stateTransitions[current] || [];
  }

  static validateTransition(from: SampleStatus, to: SampleStatus): { valid: boolean; message?: string } {
    if (!this.canTransition(from, to)) {
      return {
        valid: false,
        message: `无效的状态转换: ${from} -> ${to}。允许的转换: ${this.getNextStates(from).join(', ')}`
      };
    }
    return { valid: true };
  }
}
