export function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const result: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    if (values.length !== headers.length) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.trim() ?? '';
    });
    result.push(row);
  }

  return result;
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function parseJSON(jsonText: string): Record<string, unknown>[] {
  try {
    const parsed = JSON.parse(jsonText);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

const noiseFieldMap: Record<string, string> = {
  '房间编号': 'roomId', '房间': 'roomId', 'roomId': 'roomId',
  '日期': 'date', 'date': 'date',
  '开始时间': 'startTime', 'startTime': 'startTime',
  '结束时间': 'endTime', 'endTime': 'endTime',
  '分贝': 'decibel', 'decibel': 'decibel', 'dB': 'decibel',
  '投诉来源': 'complaintSource', 'complaintSource': 'complaintSource',
  '描述': 'description', 'description': 'description',
};

const roomFieldMap: Record<string, string> = {
  '房间编号': 'roomId', '房间': 'roomId', 'roomId': 'roomId',
  '名称': 'name', 'name': 'name',
  '位置': 'location', 'location': 'location',
  '隔音等级': 'soundproofLevel', 'soundproofLevel': 'soundproofLevel',
};

const courseFieldMap: Record<string, string> = {
  '房间编号': 'roomId', '房间': 'roomId', 'roomId': 'roomId',
  '课程名称': 'courseName', 'courseName': 'courseName', '课程': 'courseName',
  '教师': 'teacher', 'teacher': 'teacher',
  '星期': 'weekday', 'weekday': 'weekday',
  '开始时间': 'startTime', 'startTime': 'startTime',
  '结束时间': 'endTime', 'endTime': 'endTime',
};

function mapFields(
  rows: Record<string, string>[],
  fieldMap: Record<string, string>
): Record<string, string>[] {
  return rows.map((row) => {
    const mapped: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = fieldMap[key] || fieldMap[key.toLowerCase()] || key;
      mapped[normalizedKey] = value;
    }
    return mapped;
  });
}

export function mapNoiseRows(rows: Record<string, string>[]) {
  return mapFields(rows, noiseFieldMap)
    .filter((r) => r.roomId && r.date && r.decibel)
    .map((r) => ({
      roomId: r.roomId,
      date: r.date,
      startTime: r.startTime || '00:00',
      endTime: r.endTime || '23:59',
      decibel: parseFloat(r.decibel) || 0,
      complaintSource: r.complaintSource || '',
      description: r.description || '',
    }));
}

export function mapRoomRows(rows: Record<string, string>[]) {
  return mapFields(rows, roomFieldMap)
    .filter((r) => r.roomId)
    .map((r) => ({
      roomId: r.roomId,
      name: r.name || r.roomId,
      location: r.location || '',
      soundproofLevel: r.soundproofLevel || 'C',
    }));
}

export function mapCourseRows(rows: Record<string, string>[]) {
  return mapFields(rows, courseFieldMap)
    .filter((r) => r.roomId && r.courseName)
    .map((r) => ({
      roomId: r.roomId,
      courseName: r.courseName,
      teacher: r.teacher || '',
      weekday: r.weekday || '1',
      startTime: r.startTime || '00:00',
      endTime: r.endTime || '23:59',
    }));
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
