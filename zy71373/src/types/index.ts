export type EntityStatus = 'confirmed' | 'temp_note';
export type RiskLevel = 'high' | 'medium' | 'low' | 'pending';
export type AuditStepStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ChannelType = 'web' | 'print' | 'social' | 'broadcast' | 'merchandise';
export type AuditStepType = 'upload' | 'recognize' | 'match' | 'validate' | 'analyze' | 'report';

export interface FontFile {
  id: string;
  name: string;
  familyName: string;
  weight: string;
  version: string;
  uploadDate: string;
  status: EntityStatus;
  uploader: string;
  aliases: string[];
}

export interface License {
  id: string;
  fontId: string;
  fontName: string;
  licensor: string;
  licenseType: string;
  startDate: string;
  endDate: string;
  allowedChannels: ChannelType[];
  allowedClients: string[];
  certificateUrl?: string;
  status: EntityStatus;
  notes?: string;
}

export interface Client {
  id: string;
  name: string;
  industry: string;
  contactPerson: string;
  contactEmail: string;
  status: EntityStatus;
}

export interface Channel {
  id: string;
  type: ChannelType;
  name: string;
  description: string;
  riskLevel: RiskLevel;
  status: EntityStatus;
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  channelIds: string[];
  channelNames: string[];
  fontIds: string[];
  fontNames: string[];
  createDate: string;
  auditStatus: 'pending' | 'audited' | 'risk_found';
  status: EntityStatus;
  notes?: string;
}

export interface AuditStep {
  id: string;
  type: AuditStepType;
  name: string;
  status: AuditStepStatus;
  startTime?: string;
  endTime?: string;
  input: any;
  output: any;
  error?: string;
}

export interface AuditRisk {
  id: string;
  type: 'expired' | 'channel_out_of_scope' | 'font_renamed' | 'missing_license' | 'pending_info';
  level: RiskLevel;
  fontName: string;
  description: string;
  suggestion: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
}

export interface AuditReport {
  id: string;
  projectId?: string;
  projectName?: string;
  clientName?: string;
  createDate: string;
  auditor: string;
  steps: AuditStep[];
  risks: AuditRisk[];
  overallRisk: RiskLevel;
  conclusion: string;
  status: EntityStatus;
  sampleFileName: string;
}

export interface RegressionCase {
  id: string;
  name: string;
  type: 'expired_license' | 'channel_out_of_scope' | 'font_renamed' | 'missing_info';
  description: string;
  testData: any;
  expectedResult: string;
  lastRunDate?: string;
  lastRunResult?: 'passed' | 'failed';
  status: EntityStatus;
}

export interface TodoItem {
  id: string;
  type: 'missing_license' | 'pending_confirmation' | 'expiring_license';
  title: string;
  description: string;
  relatedEntityId: string;
  relatedEntityType: string;
  relatedAuditReportId?: string;
  assignee: string;
  dueDate: string;
  status: 'pending' | 'completed';
  createDate: string;
}

export interface AuditState {
  step: AuditStepType;
  uploadedFile: File | null;
  recognizedFonts: FontFile[];
  matchedLicenses: Record<string, License | null>;
  validatedChannels: Record<string, boolean>;
  risks: AuditRisk[];
  steps: AuditStep[];
  selectedProjectId?: string;
}
