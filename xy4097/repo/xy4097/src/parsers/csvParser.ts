import { TimeSlot } from '../types';

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
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

export function parseTimeSlotCsv(csvString: string): TimeSlot[] {
  const lines = csvString
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter(line => line.trim() !== '');

  if (lines.length < 2) {
    throw new Error('CSV 文件必须至少包含标题行和一行数据');
  }

  const headerLine = lines[0];
  const dataLines = lines.slice(1);

  const headers = parseCsvLine(headerLine);
  
  const idIndex = headers.findIndex(h => 
    h.toLowerCase() === 'id' || h.toLowerCase() === '时段id' || h.toLowerCase() === '时段编号'
  );
  const startTimeIndex = headers.findIndex(h => 
    h.toLowerCase() === 'starttime' || h.toLowerCase() === 'start_time' || h.toLowerCase() === '开始时间'
  );
  const endTimeIndex = headers.findIndex(h => 
    h.toLowerCase() === 'endtime' || h.toLowerCase() === 'end_time' || h.toLowerCase() === '结束时间'
  );
  const visitorCountIndex = headers.findIndex(h => 
    h.toLowerCase() === 'visitorcount' || h.toLowerCase() === 'visitor_count' || 
    h.toLowerCase() === '人数' || h.toLowerCase() === '访客数'
  );
  const descriptionIndex = headers.findIndex(h => 
    h.toLowerCase() === 'description' || h.toLowerCase() === '描述' || h.toLowerCase() === '说明'
  );

  if (idIndex === -1) {
    throw new Error('CSV 缺少必填列: id 或 时段ID');
  }
  if (startTimeIndex === -1) {
    throw new Error('CSV 缺少必填列: startTime 或 开始时间');
  }
  if (endTimeIndex === -1) {
    throw new Error('CSV 缺少必填列: endTime 或 结束时间');
  }
  if (visitorCountIndex === -1) {
    throw new Error('CSV 缺少必填列: visitorCount 或 人数');
  }

  const timeSlots: TimeSlot[] = [];
  const idSet = new Set<string>();

  for (let i = 0; i < dataLines.length; i++) {
    const values = parseCsvLine(dataLines[i]);
    
    const id = values[idIndex]?.trim();
    if (!id) {
      throw new Error(`第 ${i + 2} 行: id 不能为空`);
    }
    if (idSet.has(id)) {
      throw new Error(`第 ${i + 2} 行: 重复的 id: ${id}`);
    }
    idSet.add(id);

    const startTime = values[startTimeIndex]?.trim();
    if (!startTime) {
      throw new Error(`第 ${i + 2} 行: 开始时间不能为空`);
    }

    const endTime = values[endTimeIndex]?.trim();
    if (!endTime) {
      throw new Error(`第 ${i + 2} 行: 结束时间不能为空`);
    }

    const visitorCountStr = values[visitorCountIndex]?.trim();
    if (!visitorCountStr) {
      throw new Error(`第 ${i + 2} 行: 访客数不能为空`);
    }
    
    const visitorCount = parseInt(visitorCountStr, 10);
    if (isNaN(visitorCount) || visitorCount < 0) {
      throw new Error(`第 ${i + 2} 行: 访客数必须是有效的非负整数`);
    }

    const description = descriptionIndex !== -1 ? values[descriptionIndex]?.trim() : undefined;

    timeSlots.push({
      id,
      startTime,
      endTime,
      visitorCount,
      description,
    });
  }

  timeSlots.sort((a, b) => {
    const timeA = a.startTime.split(':').map(Number);
    const timeB = b.startTime.split(':').map(Number);
    
    if (timeA[0] !== timeB[0]) {
      return timeA[0] - timeB[0];
    }
    if (timeA[1] !== timeB[1]) {
      return timeA[1] - timeB[1];
    }
    return 0;
  });

  return timeSlots;
}

export function exportTimeSlotsToCsv(timeSlots: TimeSlot[]): string {
  const headers = ['id', 'startTime', 'endTime', 'visitorCount', 'description'];
  const lines = [headers.join(',')];

  for (const slot of timeSlots) {
    const row = [
      slot.id,
      slot.startTime,
      slot.endTime,
      slot.visitorCount.toString(),
      slot.description || '',
    ];
    lines.push(row.map(v => v.includes(',') ? `"${v}"` : v).join(','));
  }

  return lines.join('\n');
}
