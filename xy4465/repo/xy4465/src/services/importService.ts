import type { 
  Route, 
  MemberFlow, 
  Ascent, 
  IncidentNote, 
  ImportResult
} from '../types';
import { DIFFICULTY_ORDER, ZONES } from '../types';

export const parseCSV = (content: string): string[][] => {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  const result: string[][] = [];
  const delimiter = detectDelimiter(lines[0]);

  for (const line of lines) {
    const row = parseCSVRow(line, delimiter);
    if (row.length > 0) {
      result.push(row);
    }
  }

  return result;
};

const detectDelimiter = (line: string): string => {
  const delimiters = [',', ';', '\t', '|'];
  let bestDelimiter = ',';
  let maxCount = 0;

  for (const delimiter of delimiters) {
    const count = (line.match(new RegExp(delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
};

const parseCSVRow = (line: string, delimiter: string): string[] => {
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
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
};

export const generateId = (): string => {
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const parseRouteCSV = (content: string): { data: Route[]; result: ImportResult } => {
  const rows = parseCSV(content);
  const errors: string[] = [];
  const warnings: string[] = [];
  const routes: Route[] = [];

  if (rows.length < 2) {
    return {
      data: [],
      result: {
        success: false,
        type: 'routes',
        recordsCount: 0,
        errors: ['CSV 文件格式不正确，至少需要包含表头和一行数据'],
        warnings: []
      }
    };
  }

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const dataRows = rows.slice(1);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const route = parseRouteRow(row, headers, i + 2, errors, warnings);
    if (route) {
      routes.push(route);
    }
  }

  return {
    data: routes,
    result: {
      success: errors.length === 0 || routes.length > 0,
      type: 'routes',
      recordsCount: routes.length,
      errors,
      warnings
    }
  };
};

const parseRouteRow = (
  row: string[], 
  headers: string[], 
  lineNum: number, 
  errors: string[], 
  warnings: string[]
): Route | null => {
  const getValue = (keys: string[]): string => {
    for (const key of keys) {
      const index = headers.indexOf(key);
      if (index !== -1 && row[index]) {
        return row[index];
      }
    }
    return '';
  };

  const name = getValue(['name', '线路名称', '线路名', '名称']);
  const difficulty = getValue(['difficulty', '难度', '级别', '等级']);
  const zone = getValue(['zone', '区域', '区域名', 'location']);

  if (!name) {
    errors.push(`第 ${lineNum} 行: 缺少线路名称`);
    return null;
  }

  if (!difficulty) {
    warnings.push(`第 ${lineNum} 行: 线路 "${name}" 缺少难度信息`);
  }

  if (!zone) {
    warnings.push(`第 ${lineNum} 行: 线路 "${name}" 缺少区域信息`);
  }

  const route: Route = {
    id: generateId(),
    name,
    difficulty: difficulty || '未知',
    zone: zone || '未知区域',
    color: getValue(['color', '颜色', '线路颜色']),
    setter: getValue(['setter', '定线员', '定线师', 'set by']),
    setDate: getValue(['setdate', 'set_date', '定线日期', '设置日期', '日期']),
    estimatedGrade: getValue(['estimatedgrade', 'estimated_grade', '预估难度', '建议等级']),
    active: true,
    holdCount: parseInt(getValue(['holdcount', 'hold_count', '点数量', '岩点数量'])) || undefined,
    tags: getValue(['tags', '标签', '特性']).split(/[,，]/).filter(t => t.trim())
  };

  if (difficulty && !DIFFICULTY_ORDER.includes(difficulty as any)) {
    warnings.push(`第 ${lineNum} 行: 线路 "${name}" 的难度 "${difficulty}" 不是标准难度等级`);
  }

  if (zone && !ZONES.includes(zone as any)) {
    warnings.push(`第 ${lineNum} 行: 线路 "${name}" 的区域 "${zone}" 不在预设区域列表中`);
  }

  return route;
};

export const parseMemberFlowCSV = (content: string): { data: MemberFlow[]; result: ImportResult } => {
  const rows = parseCSV(content);
  const errors: string[] = [];
  const warnings: string[] = [];
  const flows: MemberFlow[] = [];

  if (rows.length < 2) {
    return {
      data: [],
      result: {
        success: false,
        type: 'memberFlow',
        recordsCount: 0,
        errors: ['CSV 文件格式不正确'],
        warnings: []
      }
    };
  }

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const dataRows = rows.slice(1);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const getValue = (keys: string[]): string => {
      for (const key of keys) {
        const index = headers.indexOf(key);
        if (index !== -1 && row[index]) {
          return row[index];
        }
      }
      return '';
    };

    const memberId = getValue(['memberid', 'member_id', '会员id', '会员编号']);
    const memberName = getValue(['membername', 'member_name', '会员姓名', '姓名', 'name']);
    const checkInTime = getValue(['checkintime', 'check_in_time', '进场时间', '入场时间', 'checkin']);

    if (!memberId && !memberName) {
      errors.push(`第 ${i + 2} 行: 缺少会员标识（ID 或姓名）`);
      continue;
    }

    if (!checkInTime) {
      errors.push(`第 ${i + 2} 行: 缺少入场时间`);
      continue;
    }

    flows.push({
      id: generateId(),
      memberId: memberId || `anon_${memberName}`,
      memberName: memberName || '匿名会员',
      checkInTime,
      checkOutTime: getValue(['checkouttime', 'check_out_time', '离场时间', 'checkout']),
      zone: getValue(['zone', '区域', '活动区域']),
      activityType: getValue(['activitytype', 'activity_type', '活动类型', 'type'])
    });
  }

  return {
    data: flows,
    result: {
      success: errors.length === 0 || flows.length > 0,
      type: 'memberFlow',
      recordsCount: flows.length,
      errors,
      warnings
    }
  };
};

export const parseAscentCSV = (content: string): { data: Ascent[]; result: ImportResult } => {
  const rows = parseCSV(content);
  const errors: string[] = [];
  const warnings: string[] = [];
  const ascents: Ascent[] = [];

  if (rows.length < 2) {
    return {
      data: [],
      result: {
        success: false,
        type: 'ascent',
        recordsCount: 0,
        errors: ['CSV 文件格式不正确'],
        warnings: []
      }
    };
  }

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const dataRows = rows.slice(1);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const getValue = (keys: string[]): string => {
      for (const key of keys) {
        const index = headers.indexOf(key);
        if (index !== -1 && row[index]) {
          return row[index];
        }
      }
      return '';
    };

    const routeId = getValue(['routeid', 'route_id', '线路id', '线路编号', 'route']);
    const memberId = getValue(['memberid', 'member_id', '会员id', '会员编号']);
    const memberName = getValue(['membername', 'member_name', '会员姓名', '姓名', 'name']);
    const timestamp = getValue(['timestamp', 'time', '时间', '日期时间', 'datetime']);
    const successStr = getValue(['success', '成功', '完攀', '完成', 'flash', 'onsight']).toLowerCase();

    if (!routeId) {
      errors.push(`第 ${i + 2} 行: 缺少线路标识`);
      continue;
    }

    if (!memberId && !memberName) {
      errors.push(`第 ${i + 2} 行: 缺少会员信息`);
      continue;
    }

    if (!timestamp) {
      errors.push(`第 ${i + 2} 行: 缺少时间戳`);
      continue;
    }

    const success = ['是', 'true', '1', 'yes', '成功', '完成', 'flash', 'onsight'].includes(successStr);
    const attempts = parseInt(getValue(['attempts', '尝试次数', '次数'])) || 1;

    ascents.push({
      id: generateId(),
      routeId,
      memberId: memberId || `anon_${memberName}`,
      memberName: memberName || '匿名会员',
      timestamp,
      success,
      attempts,
      style: getValue(['style', '风格', '攀爬方式', 'type']),
      notes: getValue(['notes', '备注', '说明', 'description']),
      coachRating: getValue(['coachrating', 'coach_rating', '教练评分', '评分'])
    });
  }

  return {
    data: ascents,
    result: {
      success: errors.length === 0 || ascents.length > 0,
      type: 'ascent',
      recordsCount: ascents.length,
      errors,
      warnings
    }
  };
};

export const parseIncidentNoteCSV = (content: string): { data: IncidentNote[]; result: ImportResult } => {
  const rows = parseCSV(content);
  const errors: string[] = [];
  const warnings: string[] = [];
  const notes: IncidentNote[] = [];

  if (rows.length < 2) {
    return {
      data: [],
      result: {
        success: false,
        type: 'incidentNote',
        recordsCount: 0,
        errors: ['CSV 文件格式不正确'],
        warnings: []
      }
    };
  }

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const dataRows = rows.slice(1);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const getValue = (keys: string[]): string => {
      for (const key of keys) {
        const index = headers.indexOf(key);
        if (index !== -1 && row[index]) {
          return row[index];
        }
      }
      return '';
    };

    const typeStr = getValue(['type', '类型', '类别']).toLowerCase();
    const title = getValue(['title', '标题', '主题']);
    const timestamp = getValue(['timestamp', 'time', '时间', '日期', 'date']);

    if (!title) {
      errors.push(`第 ${i + 2} 行: 缺少标题`);
      continue;
    }

    if (!timestamp) {
      errors.push(`第 ${i + 2} 行: 缺少时间戳`);
      continue;
    }

    let type: IncidentNote['type'] = 'observation';
    if (['injury', '受伤', '伤情', '事故'].includes(typeStr)) {
      type = 'injury';
    } else if (['complaint', '投诉', '抱怨'].includes(typeStr)) {
      type = 'complaint';
    }

    const severityStr = getValue(['severity', '严重程度', '级别', 'priority']).toLowerCase();
    let severity: IncidentNote['severity'] = 'low';
    if (['high', '严重', '高', '紧急'].includes(severityStr)) {
      severity = 'high';
    } else if (['medium', '中等', '中'].includes(severityStr)) {
      severity = 'medium';
    }

    const statusStr = getValue(['status', '状态', '处理状态']).toLowerCase();
    let status: IncidentNote['status'] = 'open';
    if (['resolved', '已解决', '已处理', '完成'].includes(statusStr)) {
      status = 'resolved';
    } else if (['investigating', '处理中', '调查中'].includes(statusStr)) {
      status = 'investigating';
    }

    notes.push({
      id: generateId(),
      type,
      routeId: getValue(['routeid', 'route_id', '线路id', '线路编号', 'route']),
      memberId: getValue(['memberid', 'member_id', '会员id', '会员编号']),
      memberName: getValue(['membername', 'member_name', '会员姓名', '姓名', 'name']),
      timestamp,
      title,
      description: getValue(['description', '描述', '详情', '内容', 'details']),
      severity,
      status,
      assignee: getValue(['assignee', '处理人', '负责人', 'assigned to']),
      resolution: getValue(['resolution', '解决方案', '处理结果']),
      resolutionDate: getValue(['resolutiondate', 'resolution_date', '解决日期', '处理日期'])
    });
  }

  return {
    data: notes,
    result: {
      success: errors.length === 0 || notes.length > 0,
      type: 'incidentNote',
      recordsCount: notes.length,
      errors,
      warnings
    }
  };
};

export const parseJSON = <T>(content: string): T | null => {
  try {
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
};

export const detectFileType = (fileName: string, content: string): string => {
  const ext = fileName.toLowerCase().split('.').pop();
  
  if (ext === 'json') {
    try {
      const data = JSON.parse(content);
      if (data.routes) return 'appData';
      if (Array.isArray(data)) {
        if (data.length > 0) {
          const first = data[0];
          if (first.difficulty || first.zone) return 'routes';
          if (first.checkInTime || first.checkOutTime) return 'memberFlow';
          if (first.routeId && first.success !== undefined) return 'ascent';
          if (first.type || first.severity) return 'incidentNote';
        }
      }
    } catch (e) {
      // 继续尝试其他方式
    }
  }

  if (ext === 'csv') {
    const firstLine = content.split('\n')[0].toLowerCase();
    if (firstLine.includes('线路') || firstLine.includes('route') || firstLine.includes('difficulty') || firstLine.includes('难度')) {
      return 'routes';
    }
    if (firstLine.includes('会员') || firstLine.includes('member') || firstLine.includes('checkin') || firstLine.includes('入场')) {
      return 'memberFlow';
    }
    if (firstLine.includes('完攀') || firstLine.includes('ascent') || firstLine.includes('success') || firstLine.includes('成功')) {
      return 'ascent';
    }
    if (firstLine.includes('伤情') || firstLine.includes('投诉') || firstLine.includes('incident') || firstLine.includes('complaint')) {
      return 'incidentNote';
    }
  }

  return 'unknown';
};
