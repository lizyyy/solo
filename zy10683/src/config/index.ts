export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  storageType: process.env.STORAGE_TYPE || 'local',
  exportPath: process.env.EXPORT_PATH || './exports',
};

export function validateConfig(): string[] {
  const errors: string[] = [];
  if (!process.env.PORT) {
    errors.push('警告: PORT 未配置，使用默认值 3000');
  }
  if (!process.env.STORAGE_TYPE) {
    errors.push('警告: STORAGE_TYPE 未配置，使用默认值 local');
  }
  if (!process.env.EXPORT_PATH) {
    errors.push('警告: EXPORT_PATH 未配置，使用默认值 ./exports');
  }
  return errors;
}
