import { ImportResponse } from '../../shared/types';

const API_BASE = '/api';

export async function importData(
  batchId: string,
  storeId: string,
  inventoryFile?: File | null,
  salesFile?: File | null,
  replenishmentFile?: File | null
): Promise<ImportResponse> {
  const formData = new FormData();
  formData.append('batchId', batchId);
  formData.append('storeId', storeId);

  if (inventoryFile) {
    formData.append('inventoryCsv', inventoryFile);
  }
  if (salesFile) {
    formData.append('salesJson', salesFile);
  }
  if (replenishmentFile) {
    formData.append('replenishmentForm', replenishmentFile);
  }

  const response = await fetch(`${API_BASE}/import`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '导入失败');
  }

  return response.json();
}

export async function getBatch(batchId: string): Promise<ImportResponse> {
  const response = await fetch(`${API_BASE}/import/batch/${batchId}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '获取批次失败');
  }
  return response.json();
}

export async function getAllBatches(): Promise<{
  total: number;
  batches: Array<{
    batchId: string;
    storeId: string;
    processedAt: string;
    summary: ImportResponse['summary'];
  }>;
}> {
  const response = await fetch(`${API_BASE}/import/batches`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '获取批次列表失败');
  }
  return response.json();
}
