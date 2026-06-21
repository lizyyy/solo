import type { LabRecord, TideUnit, Station } from '@/types';

const generateId = () => Math.random().toString(36).substring(2, 11);

export interface ParseResult {
  records: LabRecord[];
  headers: string[];
  warnings: string[];
  stationsFound: { id: string; name: string }[];
}

const stationNameToId: Record<string, string> = {
  '东港牧场1号': 'S001', '东港1号': 'S001', 'S001': 'S001', 's001': 'S001',
  '东港牧场2号': 'S002', '东港2号': 'S002', 'S002': 'S002', 's002': 'S002',
  '南湾监测点': 'S003', '南湾': 'S003', 'S003': 'S003', 's003': 'S003',
  '西礁养殖区': 'S004', '西礁': 'S004', 'S004': 'S004', 's004': 'S004',
  '北滩采样点': 'S005', '北滩': 'S005', 'S005': 'S005', 's005': 'S005',
  '中央观测站': 'S006', '中央': 'S006', 'S006': 'S006', 's006': 'S006',
  '东南浅海': 'S007', 'S007': 'S007', 's007': 'S007',
  '西北深水区': 'S008', '西北': 'S008', 'S008': 'S008', 's008': 'S008',
};

const normalizeHeader = (header: string): string => {
  return header.trim().toLowerCase()
    .replace(/[\s_-]/g, '')
    .replace(/[（(].*?[)）]/g, '');
};

const findHeaderIndex = (headers: string[], keywords: string[]): number => {
  for (let i = 0; i < headers.length; i++) {
    const normalized = normalizeHeader(headers[i]);
    if (keywords.some(kw => normalized.includes(normalizeHeader(kw)))) {
      return i;
    }
  }
  return -1;
};

const parseTideUnit = (cell: string, row: string[]): TideUnit => {
  const text = (cell || '').trim().toLowerCase();
  if (text.includes('cm') || /厘米/.test(cell)) return 'cm';
  if (text.includes('mm') || /毫米/.test(cell)) return 'mm';
  if (text.includes('m') || /米/.test(cell)) return 'm';

  const fullRow = row.join(' ').toLowerCase();
  if (fullRow.includes('cm') || /厘米/.test(fullRow)) return 'cm';
  if (fullRow.includes('mm') || /毫米/.test(fullRow)) return 'mm';
  return 'm';
};

const extractNumber = (cell: string): number => {
  if (!cell) return 0;
  const match = cell.match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
};

const resolveStation = (nameCell: string): { id: string; name: string } => {
  const trimmed = nameCell.trim();
  if (stationNameToId[trimmed]) {
    const id = stationNameToId[trimmed];
    const fullNames: Record<string, string> = {
      S001: '东港牧场1号', S002: '东港牧场2号', S003: '南湾监测点',
      S004: '西礁养殖区', S005: '北滩采样点', S006: '中央观测站',
      S007: '东南浅海', S008: '西北深水区',
    };
    return { id, name: fullNames[id] || trimmed };
  }

  const key = Object.keys(stationNameToId).find(k =>
    trimmed.includes(k) || k.includes(trimmed)
  );
  if (key) {
    return { id: stationNameToId[key], name: key };
  }

  const newId = 'S' + String(Date.now()).slice(-3);
  return { id: newId, name: trimmed };
};

export const parseCSV = (csvText: string, materialId: string): ParseResult => {
  const warnings: string[] = [];
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());

  if (lines.length < 2) {
    return { records: [], headers: [], warnings: ['CSV文件内容过少，至少需要表头行和一行数据'], stationsFound: [] };
  }

  const parseLine = (line: string): string[] => {
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
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result.map(c => c.trim());
  };

  const headers = parseLine(lines[0]);

  const stationIdx = findHeaderIndex(headers, ['点位', '采样点', '监测点', '站点', 'station', 'name', '名称']);
  const sampleTimeIdx = findHeaderIndex(headers, ['采样时间', '采样日期', 'sample', '采水时间', '时间']);
  const resultTimeIdx = findHeaderIndex(headers, ['结果时间', '实验时间', '检测时间', '分析时间', 'result']);
  const temperatureIdx = findHeaderIndex(headers, ['水温', '温度', 'temperature', 'temp']);
  const salinityIdx = findHeaderIndex(headers, ['盐度', 'salinity', 'sal']);
  const tideIdx = findHeaderIndex(headers, ['潮位', '水位', 'tide', 'level']);
  const tideUnitIdx = findHeaderIndex(headers, ['潮位单位', '单位', '水位单位', 'unit']);
  const doIdx = findHeaderIndex(headers, ['溶解氧', 'do', '溶氧']);
  const phIdx = findHeaderIndex(headers, ['ph', '酸碱度']);

  if (stationIdx === -1) warnings.push('未找到采样点列，使用默认值');
  if (sampleTimeIdx === -1) warnings.push('未找到采样时间列，使用当前时间');
  if (temperatureIdx === -1) warnings.push('未找到水温列，使用默认值 22.0');
  if (salinityIdx === -1) warnings.push('未找到盐度列，使用默认值 32.0');
  if (tideIdx === -1) warnings.push('未找到潮位列，使用默认值 1.5');
  if (doIdx === -1) warnings.push('未找到溶解氧列，使用默认值 7.5');
  if (phIdx === -1) warnings.push('未找到pH列，使用默认值 8.0');

  const records: LabRecord[] = [];
  const stationsFound = new Set<{ id: string; name: string }>();

  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    if (cells.every(c => !c.trim())) continue;

    const sourceRow = i + 1;

    const stationNameRaw = stationIdx >= 0 ? cells[stationIdx] : `点位${i}`;
    const station = resolveStation(stationNameRaw);
    stationsFound.add(station);

    const sampleTime = sampleTimeIdx >= 0 && cells[sampleTimeIdx]
      ? cells[sampleTimeIdx]
      : new Date().toISOString().slice(0, 16).replace('T', ' ');

    const resultTime = resultTimeIdx >= 0 && cells[resultTimeIdx]
      ? cells[resultTimeIdx]
      : sampleTime;

    const temperature = temperatureIdx >= 0 ? extractNumber(cells[temperatureIdx]) : 22.0;
    const salinity = salinityIdx >= 0 ? extractNumber(cells[salinityIdx]) : 32.0;
    const tideCell = tideIdx >= 0 ? cells[tideIdx] : '1.5';
    const tideLevel = extractNumber(tideCell);
    const tideUnitRaw = tideUnitIdx >= 0 ? cells[tideUnitIdx] : tideCell;
    const tideUnit = parseTideUnit(tideUnitRaw || tideCell, cells);

    const dissolvedOxygen = doIdx >= 0 ? extractNumber(cells[doIdx]) : 7.5;
    const ph = phIdx >= 0 ? extractNumber(cells[phIdx]) : 8.0;

    records.push({
      id: `${materialId}-rec-${i}`,
      stationId: station.id,
      stationName: station.name,
      sampleTime,
      resultTime,
      temperature: Number(temperature.toFixed(2)),
      salinity: Number(salinity.toFixed(2)),
      tideLevel: Number(tideLevel.toFixed(3)),
      tideUnit,
      dissolvedOxygen: Number(dissolvedOxygen.toFixed(2)),
      ph: Number(ph.toFixed(2)),
      sourceRow,
      materialId,
    });
  }

  return {
    records,
    headers,
    warnings,
    stationsFound: Array.from(stationsFound),
  };
};

export const generateSampleCSV = (): string => {
  return `点位名称,采样时间,实验时间,水温(°C),盐度(‰),潮位,潮位单位,溶解氧(mg/L),pH
东港牧场1号,2026-06-20 08:30,2026-06-20 14:20,22.3,32.0,1.2,m,7.8,8.1
东港牧场2号,2026-06-20 09:15,2026-06-20 15:00,21.5,31.8,125,cm,7.6,8.0
南湾监测点,2026-06-20 10:00,2026-06-21 09:30,23.5,33.0,2.0,m,5.9,7.8
西礁养殖区,2026-06-20 11:20,2026-06-20 16:45,20.2,30.5,1.5,m,8.1,8.2
北滩采样点,2026-06-20 07:45,2026-06-20 13:10,19.5,29.3,0.75,m,8.6,8.3
中央观测站,2026-06-20 12:00,2026-06-20 17:30,21.8,31.9,1.8,m,7.3,8.0
东南浅海,2026-06-20 10:45,2026-06-20 16:00,24.0,33.5,0.85,m,6.7,7.9
西北深水区,2026-06-20 08:00,2026-06-20 14:00,18.3,34.0,3.0,m,9.0,8.4`;
};
