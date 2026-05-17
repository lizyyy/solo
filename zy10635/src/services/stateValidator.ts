import { SurveyStatus } from '../models/Survey';
import { QuotaStatus } from '../models/QuotaGroup';
import { SampleStatus } from '../models/Sample';
import { ResampleStatus } from '../models/ResampleReason';

export class StateValidator {
  canTransitionSurvey(from: SurveyStatus, to: SurveyStatus): boolean {
    const transitions: Record<SurveyStatus, SurveyStatus[]> = {
      [SurveyStatus.COLLECTING]: [SurveyStatus.QUOTA_FULL, SurveyStatus.CLOSED],
      [SurveyStatus.QUOTA_FULL]: [SurveyStatus.RESAMPLING, SurveyStatus.CLOSED, SurveyStatus.COLLECTING],
      [SurveyStatus.RESAMPLING]: [SurveyStatus.QUOTA_FULL, SurveyStatus.COLLECTING, SurveyStatus.CLOSED],
      [SurveyStatus.CLOSED]: [SurveyStatus.COLLECTING],
    };
    return transitions[from]?.includes(to) ?? false;
  }

  canTransitionQuota(from: QuotaStatus, to: QuotaStatus): boolean {
    const transitions: Record<QuotaStatus, QuotaStatus[]> = {
      [QuotaStatus.COLLECTING]: [QuotaStatus.QUOTA_FULL, QuotaStatus.CLOSED],
      [QuotaStatus.QUOTA_FULL]: [QuotaStatus.RESAMPLING, QuotaStatus.CLOSED, QuotaStatus.COLLECTING],
      [QuotaStatus.RESAMPLING]: [QuotaStatus.QUOTA_FULL, QuotaStatus.COLLECTING, QuotaStatus.CLOSED],
      [QuotaStatus.CLOSED]: [QuotaStatus.COLLECTING],
    };
    return transitions[from]?.includes(to) ?? false;
  }

  canTransitionSample(from: SampleStatus, to: SampleStatus): boolean {
    const transitions: Record<SampleStatus, SampleStatus[]> = {
      [SampleStatus.PENDING]: [SampleStatus.VALID, SampleStatus.INVALID],
      [SampleStatus.VALID]: [SampleStatus.INVALID],
      [SampleStatus.INVALID]: [SampleStatus.VALID],
    };
    return transitions[from]?.includes(to) ?? false;
  }

  canTransitionResample(from: ResampleStatus, to: ResampleStatus): boolean {
    const transitions: Record<ResampleStatus, ResampleStatus[]> = {
      [ResampleStatus.PENDING]: [ResampleStatus.APPROVED, ResampleStatus.REJECTED],
      [ResampleStatus.APPROVED]: [ResampleStatus.COMPLETED, ResampleStatus.REJECTED],
      [ResampleStatus.REJECTED]: [ResampleStatus.PENDING],
      [ResampleStatus.COMPLETED]: [],
    };
    return transitions[from]?.includes(to) ?? false;
  }

  canAddSample(status: SurveyStatus): boolean {
    return [SurveyStatus.COLLECTING, SurveyStatus.RESAMPLING].includes(status);
  }

  canInvalidateSample(status: SampleStatus): boolean {
    return status === SampleStatus.VALID || status === SampleStatus.PENDING;
  }

  canReopenQuota(status: QuotaStatus): boolean {
    return [QuotaStatus.QUOTA_FULL, QuotaStatus.CLOSED].includes(status);
  }
}

export const stateValidator = new StateValidator();