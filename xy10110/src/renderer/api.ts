import { ArchiveItem, HistoryRecord, AppState, FileType } from '../shared/types';

const API_BASE = '/api';

interface ApiResponse<T = any> {
  success: boolean;
  item?: T;
  items?: T[];
  errors?: string[];
  warnings?: string[];
  error?: string;
  filePath?: string;
  downloadUrl?: string;
}

interface UploadResponse {
  path: string;
  originalName: string;
  size: number;
}

export const api = {
  async getState(): Promise<AppState> {
    const response = await fetch(`${API_BASE}/state`);
    return response.json();
  },

  async uploadFile(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('文件上传失败');
    }
    
    return response.json();
  },

  async addItem(itemData: Omit<ArchiveItem, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'deliveredAt'>): Promise<ApiResponse<ArchiveItem>> {
    const response = await fetch(`${API_BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itemData)
    });
    return response.json();
  },

  async updateItem(id: string, updates: Partial<ArchiveItem>): Promise<ApiResponse<ArchiveItem>> {
    const response = await fetch(`${API_BASE}/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return response.json();
  },

  async deleteItem(id: string): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE}/items/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  },

  async markReviewed(id: string): Promise<ApiResponse<ArchiveItem>> {
    const response = await fetch(`${API_BASE}/items/${id}/review`, {
      method: 'POST'
    });
    return response.json();
  },

  async markDelivered(id: string): Promise<ApiResponse<ArchiveItem>> {
    const response = await fetch(`${API_BASE}/items/${id}/deliver`, {
      method: 'POST'
    });
    return response.json();
  },

  async exportManifest(itemIds: string[], format: 'txt' | 'csv' = 'txt', filename: string = '交付清单'): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds, format, filename })
    });
    return response.json();
  }
};

export const getFileDownloadUrl = (filename: string): string => {
  return `/api/uploads/${encodeURIComponent(filename)}`;
};

export const getFileAccept = (fileType: FileType): string => {
  const accept: Record<FileType, string> = {
    video: '.mp4,.mov,.avi,.mkv,.webm',
    subtitle: '.srt,.vtt,.ass,.ssa',
    archive: '.zip,.rar,.7z,.tar,.gz'
  };
  return accept[fileType];
};
