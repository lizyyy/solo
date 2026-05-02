import fs from 'fs';

export function parseMetadata(jsonPath) {
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`JSON 文件不存在: ${jsonPath}`);
  }
  const content = fs.readFileSync(jsonPath, 'utf-8');
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`JSON 解析失败: ${jsonPath}`);
  }
}