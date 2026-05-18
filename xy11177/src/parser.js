import fs from 'fs/promises';
import path from 'path';

export class RepairParser {
  constructor(logger) {
    this.logger = logger;
  }

  async parseFile(filePath) {
    this.logger.verbose(`开始解析文件: ${filePath}`);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      this.logger.verbose(`成功解析 ${data.length} 条报修记录`);
      
      return data.map((item, index) => this.normalizeRepair(item, index));
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`文件不存在: ${filePath}`);
      } else if (error instanceof SyntaxError) {
        throw new Error(`JSON 格式错误: ${error.message}`);
      }
      throw error;
    }
  }

  normalizeRepair(item, index) {
    const requiredFields = ['id', 'dormNumber', 'repairType', 'description', 'reporter', 'reportTime'];
    
    for (const field of requiredFields) {
      if (!item[field]) {
        throw new Error(`第 ${index + 1} 条记录缺少必填字段: ${field}`);
      }
    }

    return {
      id: String(item.id).trim(),
      dormNumber: String(item.dormNumber).trim(),
      repairType: String(item.repairType).trim(),
      description: String(item.description).trim(),
      reporter: String(item.reporter).trim(),
      reportTime: this.normalizeTime(item.reportTime),
      priority: item.priority || 'normal',
      contact: item.contact || '',
      area: item.area || '',
      status: item.status || 'pending',
      assignedTo: item.assignedTo || null,
      assignedTime: item.assignedTime || null
    };
  }

  normalizeTime(timeStr) {
    if (!timeStr) return new Date().toISOString();
    
    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) {
        return new Date().toISOString();
      }
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  async saveDispatches(dispatches, outputPath) {
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(outputPath, JSON.stringify(dispatches, null, 2), 'utf-8');
    this.logger.verbose(`派单结果已保存到: ${outputPath}`);
  }
}
