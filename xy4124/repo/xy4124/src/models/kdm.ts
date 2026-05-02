import { BaseEntity, TimestampRange } from './common';

export interface KDM extends BaseEntity {
  kdmId: string;
  filmId: string;
  versionId: string;
  auditoriumId: string;
  validity: TimestampRange;
  cplId: string;
  issuer: string;
  issuerOrg: string;
  contentTitleText: string;
  notes?: string;
  isActive: boolean;
}

export interface KDMCreateInput {
  kdmId: string;
  filmId: string;
  versionId: string;
  auditoriumId: string;
  validity: TimestampRange;
  cplId: string;
  issuer: string;
  issuerOrg: string;
  contentTitleText: string;
  notes?: string;
}
