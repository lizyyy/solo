import { useState, useCallback } from 'react';
import type { FileSourceType } from '../../shared/types';

interface FileInfo {
  file: File;
  sourceType: FileSourceType;
  content?: string;
  error?: string;
}

interface UseFileUploadOptions {
  maxFileSize?: number;
  allowedTypes?: string[];
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const { maxFileSize = 10 * 1024 * 1024, allowedTypes = ['.xlsx', '.xls', '.json'] } = options;

  const [files, setFiles] = useState<FileInfo[]>([]);
  const [uploading, setUploading] = useState(false);

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content.split(',')[1] || content);
      };
      reader.onerror = () => reject(new Error('文件读取失败'));

      if (file.name.endsWith('.json')) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
  };

  const validateFile = (file: File): string | null => {
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!allowedTypes.includes(fileExt)) {
      return `不支持的文件格式，仅支持 ${allowedTypes.join(', ')}`;
    }

    if (file.size > maxFileSize) {
      return `文件过大，最大支持 ${maxFileSize / 1024 / 1024}MB`;
    }

    return null;
  };

  const detectSourceType = (fileName: string): FileSourceType => {
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes('客户') || lowerName.includes('customer')) return 'customer';
    if (lowerName.includes('担保') || lowerName.includes('guarantee')) return 'guarantee';
    if (lowerName.includes('授信') || lowerName.includes('credit')) return 'credit';
    if (lowerName.includes('反担保') || lowerName.includes('counter')) return 'counterGuarantee';
    if (lowerName.includes('审批') || lowerName.includes('approval')) return 'approval';
    if (lowerName.includes('暴露') || lowerName.includes('exposure')) return 'exposureReport';
    return 'customer';
  };

  const addFiles = useCallback(async (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const processedFiles: FileInfo[] = [];

    for (const file of fileArray) {
      const error = validateFile(file);
      const sourceType = detectSourceType(file.name);
      let content: string | undefined;

      if (!error) {
        try {
          content = await readFileContent(file);
        } catch (e) {
          processedFiles.push({
            file,
            sourceType,
            error: e instanceof Error ? e.message : '文件读取失败',
          });
          continue;
        }
      }

      processedFiles.push({
        file,
        sourceType,
        content,
        error: error || undefined,
      });
    }

    setFiles((prev) => [...prev, ...processedFiles]);
    return processedFiles;
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateSourceType = useCallback((index: number, sourceType: FileSourceType) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, sourceType } : f))
    );
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  const validFiles = files.filter((f) => !f.error);
  const hasErrors = files.some((f) => f.error);

  const getImportFiles = useCallback(() => {
    return validFiles.map((f) => ({
      name: f.file.name,
      sourceType: f.sourceType,
      content: f.content || '',
    }));
  }, [validFiles]);

  return {
    files,
    validFiles,
    hasErrors,
    uploading,
    setUploading,
    addFiles,
    removeFile,
    updateSourceType,
    clearFiles,
    getImportFiles,
  };
}

export const sourceTypeLabels: Record<FileSourceType, string> = {
  customer: '客户信息',
  guarantee: '担保合同',
  credit: '授信余额',
  counterGuarantee: '反担保材料',
  approval: '审批意见',
  exposureReport: '暴露报告',
};

export const sourceTypeColors: Record<FileSourceType, string> = {
  customer: 'bg-primary-100 text-primary-700',
  guarantee: 'bg-green-100 text-green-700',
  credit: 'bg-amber-100 text-amber-700',
  counterGuarantee: 'bg-purple-100 text-purple-700',
  approval: 'bg-blue-100 text-blue-700',
  exposureReport: 'bg-rose-100 text-rose-700',
};
