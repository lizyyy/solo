import { BaseEntity, CheckStatus, RuleCheckResult } from './common';

export interface ProjectionCheck extends BaseEntity {
  checkId: string;
  scheduleId: string;
  overallStatus: CheckStatus;
  checks: RuleCheckResult[];
  checkTrigger: CheckTrigger;
  checkedBy?: string;
  notes?: string;
}

export enum CheckTrigger {
  MANUAL = 'manual',
  PRE_SHOW = 'pre_show',
  ON_DEMAND = 'on_demand',
  SCHEDULED = 'scheduled',
}

export interface ProjectionCheckCreateInput {
  scheduleId: string;
  overallStatus: CheckStatus;
  checks: RuleCheckResult[];
  checkTrigger: CheckTrigger;
  checkedBy?: string;
  notes?: string;
}
