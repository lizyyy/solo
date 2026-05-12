import { ChannelInfo, QuotaRule, QualityRule, SurveyAnswer, ProjectConfig } from '../types';
export declare const SAMPLE_CHANNELS: ChannelInfo[];
export declare const SAMPLE_QUOTA_RULES: QuotaRule[];
export declare const SAMPLE_QUALITY_RULES: QualityRule[];
export declare function generateSampleSurveys(): SurveyAnswer[];
export declare function createSampleProjectConfig(): ProjectConfig;
export declare const NEEDS_REVIEW_SURVEY: SurveyAnswer;
export declare const SHORT_DURATION_SURVEY: SurveyAnswer;
