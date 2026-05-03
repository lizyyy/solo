/**
 * 数据解析模块
 * 负责加载和解析各类数据文件：turbine.json, flight_path.jsonl, defects.csv, rules.yaml
 */

class DataParser {
  constructor() {
    this.turbineData = null;
    this.flightPathData = [];
    this.defectsData = [];
    this.rulesData = null;
  }

  /**
   * 加载所有数据文件
   */
  async loadAllData(basePath = '../sample') {
    try {
      await Promise.all([
        this.loadTurbineData(`${basePath}/turbine.json`),
        this.loadFlightPathData(`${basePath}/flight_path.jsonl`),
        this.loadDefectsData(`${basePath}/defects.csv`),
        this.loadRulesData(`${basePath}/rules.yaml`)
      ]);
      return true;
    } catch (error) {
      console.error('加载数据失败:', error);
      throw error;
    }
  }

  /**
   * 加载风机数据 (turbine.json)
   */
  async loadTurbineData(url) {
    try {
      const response = await fetch(url);
      this.turbineData = await response.json();
      console.log('风机数据加载完成:', this.turbineData.turbineId);
      return this.turbineData;
    } catch (error) {
      console.error('加载风机数据失败:', error);
      throw error;
    }
  }

  /**
   * 加载航线数据 (flight_path.jsonl)
   * JSON Lines格式，每行一个JSON对象
   */
  async loadFlightPathData(url) {
    try {
      const response = await fetch(url);
      const text = await response.text();
      const lines = text.trim().split('\n');
      
      this.flightPathData = lines
        .filter(line => line.trim())
        .map((line, index) => {
          try {
            const data = JSON.parse(line);
            data.index = index;
            return data;
          } catch (e) {
            console.warn(`解析航线数据第${index + 1}行失败:`, line);
            return null;
          }
        })
        .filter(data => data !== null);
      
      console.log('航线数据加载完成:', this.flightPathData.length, '条记录');
      return this.flightPathData;
    } catch (error) {
      console.error('加载航线数据失败:', error);
      throw error;
    }
  }

  /**
   * 加载缺陷数据 (defects.csv)
   */
  async loadDefectsData(url) {
    try {
      const response = await fetch(url);
      const text = await response.text();
      const lines = text.trim().split('\n');
      
      if (lines.length < 2) {
        console.warn('缺陷数据文件为空或只有表头');
        this.defectsData = [];
        return [];
      }

      const headers = this.parseCSVLine(lines[0]);
      this.defectsData = [];

      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        if (values.length === headers.length) {
          const defect = {};
          headers.forEach((header, index) => {
            defect[header] = this.parseDefectValue(header, values[index]);
          });
          this.defectsData.push(defect);
        }
      }

      console.log('缺陷数据加载完成:', this.defectsData.length, '条记录');
      return this.defectsData;
    } catch (error) {
      console.error('加载缺陷数据失败:', error);
      throw error;
    }
  }

  /**
   * 加载规则数据 (rules.yaml)
   * 简单的YAML解析器，支持基本的YAML格式
   */
  async loadRulesData(url) {
    try {
      const response = await fetch(url);
      const text = await response.text();
      this.rulesData = this.parseYAML(text);
      console.log('规则数据加载完成');
      return this.rulesData;
    } catch (error) {
      console.error('加载规则数据失败:', error);
      throw error;
    }
  }

  /**
   * 解析CSV行，处理带引号的字段
   */
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    
    return result;
  }

  /**
   * 解析缺陷数据值
   */
  parseDefectValue(key, value) {
    if (value === '' || value === undefined) {
      return null;
    }
    
    switch (key) {
      case 'distanceFromRoot':
      case 'size':
        return parseFloat(value);
      default:
        return value;
    }
  }

  /**
   * 简单的YAML解析器
   */
  parseYAML(text) {
    const result = {};
    const lines = text.split('\n');
    const stack = [{ indent: -1, obj: result, key: null }];
    
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      
      const indent = line.search(/\S/);
      const colonIndex = trimmed.indexOf(':');
      
      if (colonIndex === -1) return;
      
      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();
      
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      
      const current = stack[stack.length - 1];
      
      if (value) {
        let parsedValue;
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(parseFloat(value)) && !isNaN(value - 0)) parsedValue = parseFloat(value);
        else parsedValue = value;
        
        if (current.key && Array.isArray(current.obj[current.key])) {
          const lastItem = current.obj[current.key][current.obj[current.key].length - 1];
          if (typeof lastItem === 'object') {
            lastItem[key] = parsedValue;
          }
        } else {
          current.obj[key] = parsedValue;
        }
      } else if (trimmed.startsWith('-')) {
        const arrayKey = trimmed.substring(1).trim();
        if (current.key) {
          if (!current.obj[current.key]) current.obj[current.key] = [];
          if (arrayKey) {
            const newObj = {};
            const subColon = arrayKey.indexOf(':');
            if (subColon !== -1) {
              const subKey = arrayKey.substring(0, subColon).trim();
              const subValue = arrayKey.substring(subColon + 1).trim();
              newObj[subKey] = this.parseYAMLValue(subValue);
            } else {
              newObj[arrayKey] = null;
            }
            current.obj[current.key].push(newObj);
            stack.push({ indent, obj: newObj, key: null });
          } else {
            current.obj[current.key].push({});
          }
        }
      } else {
        current.obj[key] = {};
        stack.push({ indent, obj: current.obj[key], key });
      }
    });
    
    return result;
  }

  parseYAMLValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(parseFloat(value)) && !isNaN(value - 0)) return parseFloat(value);
    return value;
  }

  /**
   * 根据叶片ID获取叶片数据
   */
  getBladeById(bladeId) {
    if (!this.turbineData) return null;
    return this.turbineData.blades.find(b => b.bladeId === bladeId);
  }

  /**
   * 根据段ID获取段数据
   */
  getSegmentById(segmentId) {
    if (!this.turbineData) return null;
    for (const blade of this.turbineData.blades) {
      const segment = blade.segments.find(s => s.segmentId === segmentId);
      if (segment) {
        return { blade, segment };
      }
    }
    return null;
  }

  /**
   * 根据距离根端位置确定所属段（处理边界段问题）
   */
  getSegmentByDistance(bladeId, distanceFromRoot) {
    const blade = this.getBladeById(bladeId);
    if (!blade) return null;
    
    const epsilon = 0.001;
    
    for (const segment of blade.segments) {
      if (distanceFromRoot >= segment.start - epsilon && 
          distanceFromRoot <= segment.end + epsilon) {
        return segment;
      }
    }
    
    if (distanceFromRoot < blade.segments[0].start) {
      return blade.segments[0];
    }
    
    if (distanceFromRoot > blade.segments[blade.segments.length - 1].end) {
      return blade.segments[blade.segments.length - 1];
    }
    
    return null;
  }

  /**
   * 获取所有数据
   */
  getAllData() {
    return {
      turbine: this.turbineData,
      flightPath: this.flightPathData,
      defects: this.defectsData,
      rules: this.rulesData
    };
  }
}

export default DataParser;
