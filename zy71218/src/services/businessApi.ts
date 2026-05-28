import { get, post, del } from './api';
import type {
  BusinessDataType,
  ImportResult,
  LinkGraph,
  BusinessLink,
  Invoice,
  Confirmation,
  FactoringContract,
  RepaymentPlan,
  CollectionNote,
  RiskReport,
  PaginatedResponse,
} from '../../shared/types';

export const importData = (type: BusinessDataType, formData: FormData): Promise<ImportResult> => {
  return post(`/import/${type}`, formData);
};

export const previewImport = (type: BusinessDataType, fileId: string): Promise<any[]> => {
  return get(`/import/${type}/preview`, { fileId });
};

export const getLinks = (businessNo?: string): Promise<LinkGraph> => {
  return get('/links', { businessNo });
};

export const getBusinessList = <T = any>(type: BusinessDataType, params?: any): Promise<PaginatedResponse<T>> => {
  return get(`/business/${type}`, params);
};

export const getBusinessDetail = (
  type: BusinessDataType,
  id: string
): Promise<Invoice | Confirmation | FactoringContract | RepaymentPlan | CollectionNote | RiskReport> => {
  return get(`/business/${type}/${id}`);
};

export const createLink = (sourceId: string, targetId: string, linkType: string): Promise<BusinessLink> => {
  return post('/links', { sourceId, targetId, linkType });
};

export const deleteLink = (id: string): Promise<void> => {
  return del(`/links/${id}`);
};
