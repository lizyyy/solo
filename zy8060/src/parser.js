import Papa from 'papaparse';
import yaml from 'js-yaml';

export class DataParser {
  static parseTrayJSON(jsonString) {
    try {
      const tray = JSON.parse(jsonString);
      const errors = [];
      
      if (!tray.width || tray.width <= 0) errors.push('托盘宽度无效');
      if (!tray.depth || tray.depth <= 0) errors.push('托盘深度无效');
      if (!tray.maxHeight || tray.maxHeight <= 0) errors.push('托盘最大高度无效');
      
      if (errors.length > 0) {
        return { success: false, errors, data: null };
      }
      
      return { success: true, errors: [], data: tray };
    } catch (e) {
      return { success: false, errors: ['托盘 JSON 解析失败: ' + e.message], data: null };
    }
  }

  static parseInstrumentsCSV(csvString) {
    try {
      const result = Papa.parse(csvString, { header: true, skipEmptyLines: true });
      const instruments = [];
      const errors = [];
      const ids = new Set();
      
      result.data.forEach((row, index) => {
        const id = row.id?.trim();
        if (!id) {
          errors.push(`第 ${index + 2} 行: 缺少器械编号`);
          return;
        }
        
        if (ids.has(id)) {
          errors.push(`第 ${index + 2} 行: 重复器械编号 ${id}`);
          return;
        }
        ids.add(id);
        
        const width = parseFloat(row.width);
        const depth = parseFloat(row.depth);
        const height = parseFloat(row.height);
        
        if (isNaN(width) || width <= 0) errors.push(`器械 ${id}: 宽度无效`);
        if (isNaN(depth) || depth <= 0) errors.push(`器械 ${id}: 深度无效`);
        if (isNaN(height) || height <= 0) errors.push(`器械 ${id}: 高度无效`);
        
        instruments.push({
          id,
          name: row.name || '未命名',
          type: row.type || '未知',
          width,
          depth,
          height,
          weight: parseFloat(row.weight) || 0,
          mustLayer: row.mustLayer === 'true' || row.mustLayer === true,
          color: row.color || '#cccccc',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 }
        });
      });
      
      return { success: errors.length === 0, errors, data: instruments };
    } catch (e) {
      return { success: false, errors: ['器械 CSV 解析失败: ' + e.message], data: null };
    }
  }

  static parseRulesYAML(yamlString) {
    try {
      const rules = yaml.load(yamlString);
      const errors = [];
      
      if (!rules.rules) errors.push('规则列表为空');
      if (!rules.minGap || rules.minGap < 0) errors.push('最小间距无效');
      
      return { success: errors.length === 0, errors, data: rules };
    } catch (e) {
      return { success: false, errors: ['规则 YAML 解析失败: ' + e.message], data: null };
    }
  }
}
