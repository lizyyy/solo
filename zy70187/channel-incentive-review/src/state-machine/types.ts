import { ChannelIncentiveStatus, OperatorInfo, StatusChangeLog } from '../models/types';

export interface StateTransitionRule {
  fromStatus: ChannelIncentiveStatus | null;
  toStatus: ChannelIncentiveStatus;
  allowed: boolean;
  requiredConditions: string[];
  reasonTemplate: string;
}

export interface StateTransitionResult {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  allowedTransitions?: ChannelIncentiveStatus[];
  statusChange?: StatusChangeLog;
}

export interface StateTransitionRequest {
  fromStatus: ChannelIncentiveStatus | null;
  toStatus: ChannelIncentiveStatus;
  operator: OperatorInfo;
  reason: string;
  context?: Record<string, unknown>;
}

export interface IStateMachineEngine {
  canTransition(request: StateTransitionRequest): StateTransitionResult;
  transition(request: StateTransitionRequest): StateTransitionResult;
  getAllowedTransitions(fromStatus: ChannelIncentiveStatus): ChannelIncentiveStatus[];
  getTransitionRules(): StateTransitionRule[];
}

export class StateTransitionError extends Error {
  public readonly errorCode: string;
  public readonly allowedTransitions: ChannelIncentiveStatus[];

  constructor(errorCode: string, message: string, allowedTransitions: ChannelIncentiveStatus[]) {
    super(message);
    this.name = 'StateTransitionError';
    this.errorCode = errorCode;
    this.allowedTransitions = allowedTransitions;
  }
}
