export interface CSVParseResult {
  headers: string[];
  rows: Record<string, string>[];
  rawContent: string;
  rowCount: number;
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  isCustom?: boolean;
}

export const CSV_TARGET_FIELDS = [
  { field: 'code', label: '记录编号', required: true, examples: ['编号', '记录编号', '缺陷编号', 'code', 'id', 'ID'] },
  { field: 'location', label: '叶片部位', required: true, examples: ['部位', '位置', '叶片部位', 'location', 'position', '叶片位置', '叶位置'] },
  { field: 'position3D.x', label: 'X坐标', required: false, examples: ['X坐标', 'x', 'X', '坐标X', 'X轴'] },
  { field: 'position3D.y', label: 'Y坐标', required: false, examples: ['Y坐标', 'y', 'Y', '坐标Y', 'Y轴'] },
  { field: 'position3D.z', label: 'Z坐标', required: false, examples: ['Z坐标', 'z', 'Z', '坐标Z', 'Z轴'] },
  { field: 'crackType', label: '裂纹类型', required: true, examples: ['类型', '裂纹类型', '缺陷类型', 'type', 'crackType', '种类'] },
  { field: 'riskLevel', label: '风险等级', required: true, examples: ['风险', '等级', '风险等级', 'risk', 'priority', '危险等级', '风险级别'] },
  { field: 'description', label: '缺陷描述', required: true, examples: ['描述', '缺陷描述', '问题描述', 'description', 'remark', '详情', '详细描述', '缺陷详情'] },
  { field: 'suggestion', label: '处理建议', required: false, examples: ['建议', '处理建议', '处理方案', 'suggestion', 'advice', '处理意见', '处置建议'] },
  { field: 'source', label: '数据来源', required: false, examples: ['来源', '数据来源', 'source', '数据渠道'] }
] as const;

export const LOCATION_MAP: Record<string, string> = {
  '叶根': 'root', '根部': 'root', 'root': 'root', 'Root': 'root', '叶根区域': 'root', '叶根部位': 'root',
  '叶中': 'middle', '中部': 'middle', 'middle': 'middle', 'Middle': 'middle', '叶中部位': 'middle', '叶片中部': 'middle', '中部区域': 'middle',
  '叶尖': 'tip', '尖部': 'tip', 'tip': 'tip', 'Tip': 'tip', '叶尖部位': 'tip', '叶尖区域': 'tip'
};

export const CRACK_TYPE_MAP: Record<string, string> = {
  '横向裂纹': 'transverse', '横向': 'transverse', 'transverse': 'transverse',
  '纵向裂纹': 'longitudinal', '纵向': 'longitudinal', 'longitudinal': 'longitudinal',
  '网状裂纹': 'mesh', '网状': 'mesh', 'mesh': 'mesh',
  '疑似异常': 'suspected', '疑似': 'suspected', '可疑': 'suspected', 'suspected': 'suspected', '异常信号': 'suspected'
};

export const RISK_LEVEL_MAP: Record<string, string> = {
  '高风险': 'high', '高': 'high', '高危': 'high', 'high': 'high', '高危险': 'high', '1级': 'high', '一级': 'high',
  '中风险': 'medium', '中': 'medium', 'medium': 'medium', '中危': 'medium', '2级': 'medium', '二级': 'medium',
  '低风险': 'low', '低': 'low', 'low': 'low', '低危': 'low', '3级': 'low', '三级': 'low'
};

export const SOURCE_MAP: Record<string, string> = {
  'GIS扫描': 'gis', 'GIS': 'gis', 'gis': 'gis', '外委GIS': 'gis',
  '巡检平板': 'tablet', '平板': 'tablet', '巡检': 'tablet', 'tablet': 'tablet', '自巡': 'tablet', '风场自巡': 'tablet', '外委巡检': 'tablet',
  'Excel台账': 'excel', '台账': 'excel', 'Excel': 'excel', 'excel': 'excel', '季度大检': 'excel', '定期检修': 'excel',
  '周会截图': 'screenshot', '截图': 'screenshot', 'screenshot': 'screenshot', '旧口径': 'screenshot', '历史数据': 'screenshot'
};

function stripBOM(content: string): string {
  if (content.charCodeAt(0) === 0xFEFF) {
    return content.slice(1);
  }
  return content;
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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

export function parseCSV(content: string): CSVParseResult {
  const cleaned = stripBOM(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleaned.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length < 2) {
    throw new Error('CSV文件格式不正确：至少需要表头行和一行数据');
  }

  const headers = splitCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    row.__rowNumber = String(i + 1);
    rows.push(row);
  }

  return {
    headers,
    rows,
    rawContent: content,
    rowCount: rows.length
  };
}

export function detectFileType(content: string): 'json' | 'csv' {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }
  return 'csv';
}

export function autoMapFields(headers: string[]): FieldMapping[] {
  const mappings: FieldMapping[] = [];
  
  headers.forEach(header => {
    const normalizedHeader = header.toLowerCase().trim();
    
    for (const target of CSV_TARGET_FIELDS) {
      for (const example of target.examples) {
        if (normalizedHeader === example.toLowerCase() || 
            normalizedHeader.includes(example.toLowerCase())) {
          mappings.push({
            sourceField: header,
            targetField: target.field
          });
          break;
        }
      }
    }
  });

  const positionFields = headers.filter(h => 
    h.toLowerCase().includes('坐标') || 
    h.toLowerCase().match(/^[xyz]$/i) ||
    h.toLowerCase().includes('position')
  );

  if (positionFields.length >= 3) {
    const sorted = [...positionFields].sort();
    mappings.push(
      { sourceField: sorted[0], targetField: 'position3D.x' },
      { sourceField: sorted[1], targetField: 'position3D.y' },
      { sourceField: sorted[2], targetField: 'position3D.z' }
    );
  }

  return mappings;
}

export function mapRowToRecord(
  row: Record<string, string>,
  mappings: FieldMapping[],
  sourceType: string,
  sourceFileName: string,
  rowNumber: number
): Omit<import('../types').CrackRecord, 'id' | 'createdAt' | 'updatedAt' | 'history'> {
  const record: any = {
    code: '',
    location: 'middle',
    position3D: { x: 0, y: 0, z: 0 },
    crackType: 'suspected',
    riskLevel: 'medium',
    status: 'pending',
    source: sourceType as any,
    description: '',
    suggestion: '',
    remark: '',
    isOldCaliber: sourceType === 'screenshot',
    sourceInfo: {
      sourceType: sourceType,
      sourceRef: `${sourceFileName}，第${rowNumber}行`,
      originalData: JSON.stringify(row),
      sourceFile: sourceFileName,
      sourceRow: rowNumber
    }
  };

  mappings.forEach(mapping => {
    const value = row[mapping.sourceField] || '';
    if (!value) return;

    if (mapping.targetField.startsWith('position3D.')) {
      const axis = mapping.targetField.split('.')[1] as 'x' | 'y' | 'z';
      const num = parseFloat(value);
      if (!isNaN(num)) {
        record.position3D[axis] = num;
      }
    } else if (mapping.targetField === 'location') {
      record.location = LOCATION_MAP[value] || value;
    } else if (mapping.targetField === 'crackType') {
      record.crackType = CRACK_TYPE_MAP[value] || value;
    } else if (mapping.targetField === 'riskLevel') {
      record.riskLevel = RISK_LEVEL_MAP[value] || value;
    } else if (mapping.targetField === 'source') {
      record.source = SOURCE_MAP[value] || value;
    } else {
      record[mapping.targetField] = value;
    }
  });

  if (!record.code) {
    record.code = `${sourceType.toUpperCase()}-${String(rowNumber).padStart(3, '0')}`;
  }

  if (!record.description) {
    record.description = `从${sourceFileName}导入，第${rowNumber}行`;
  }

  return record;
}
