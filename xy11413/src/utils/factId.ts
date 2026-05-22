import crypto from 'crypto';

export const generateFactId = (sourceType: string, businessKey: string): string => {
  const hash = crypto.createHash('sha256');
  hash.update(`${sourceType}:${businessKey}`);
  return hash.digest('hex').slice(0, 32);
};

export const generateOrderFactId = (orderNo: string, materialCode: string): string => {
  return generateFactId('order', `${orderNo}:${materialCode}`);
};

export const generateWasteFactId = (wasteNo: string, materialCode: string): string => {
  return generateFactId('waste', `${wasteNo}:${materialCode}`);
};

export const generatePriceFactId = (materialCode: string, effectiveDate: string): string => {
  return generateFactId('price', `${materialCode}:${effectiveDate}`);
};

export const generateSupplementFactId = (supplementNo: string, materialCode: string): string => {
  return generateFactId('supplement', `${supplementNo}:${materialCode}`);
};

export const generateSourceId = (fileName: string, fileHash: string): string => {
  const hash = crypto.createHash('sha256');
  hash.update(`${fileName}:${fileHash}`);
  return `src_${hash.digest('hex').slice(0, 24)}`;
};

export const generateTaskId = (): string => {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const generateFileHash = (content: string): string => {
  return crypto.createHash('md5').update(content).digest('hex');
};
