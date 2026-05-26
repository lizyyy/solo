import { Request } from 'express';

export interface UserPayload {
  id: number;
  username: string;
  real_name: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

export interface CreateBatchRequest {
  batch_no?: string;
  name: string;
  description?: string;
  materials: Array<{
    material_type: string;
    waybill_no?: string;
    content?: string;
  }>;
}

export interface UploadMaterialRequest {
  batch_id: number;
  material_type: string;
  waybill_no?: string;
  content?: string;
}

export interface ProcessDetailRequest {
  status: string;
  conclusion?: string;
  deduction_amount?: number;
  responsible_party?: string;
  matched_items?: Array<{
    source_type: string;
    source_waybill_no: string;
    source_data?: string;
    matched_amount?: number;
  }>;
  change_reason?: string;
}

export interface QueryParams {
  page?: number;
  page_size?: number;
  status?: string;
  exception_type?: string;
  waybill_no?: string;
  batch_id?: number;
  start_time?: number;
  end_time?: number;
}
