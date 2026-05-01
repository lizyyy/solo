import fs from 'fs';
import yaml from 'js-yaml';

export function parseRules(yamlPath) {
  if (!fs.existsSync(yamlPath)) {
    throw new Error(`YAML 文件不存在: ${yamlPath}`);
  }
  const content = fs.readFileSync(yamlPath, 'utf-8');
  try {
    return yaml.load(content);
  } catch (error) {
    throw new Error(`YAML 解析失败: ${yamlPath}`);
  }
}