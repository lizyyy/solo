import api from './index';
import type { BusinessDataType, ImportResult, ApiResponse } from '../../shared/types';

export const importService = {
  uploadFile: (file: File, dataType: BusinessDataType) => {
    return new Promise<ApiResponse<ImportResult>>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target?.result as string;
          const result = await api.post<unknown, ApiResponse<ImportResult>>('/import/upload', {
            file: base64,
            dataType,
          });
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  },

  previewFile: (file: File, dataType: BusinessDataType) => {
    return new Promise<ApiResponse<{ previewData: any[]; totalRows: number }>>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target?.result as string;
          const result = await api.post<unknown, ApiResponse<{ previewData: any[]; totalRows: number }>>('/import/preview', {
            file: base64,
            dataType,
          });
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  },
};
