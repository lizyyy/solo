import type { Material, CuePoint, ParseError, MaterialType, Result } from '@/types';
import { generateId, calculateFingerprint } from '@/utils/helpers';
import { parseTimecode } from '@/utils/timecode';

export async function parseMaterial(material: Material): Promise<Material> {
  const updatedMaterial: Material = {
    ...material,
    parseStatus: 'parsing',
  };

  try {
    let result: Result<{ cuePoints?: CuePoint[]; rawData?: Record<string, unknown>; metadata?: Record<string, unknown> }, ParseError>;

    switch (material.type) {
      case 'timeline':
        result = parseTimeline(material);
        break;
      case 'dialog':
        result = parseDialog(material);
        break;
      case 'music':
        result = parseMusic(material);
        break;
      case 'cue':
        result = parseCueList(material);
        break;
      case 'note':
        result = parseNotes(material);
        break;
      default:
        return {
          ...updatedMaterial,
          parseStatus: 'failed',
          parseErrors: [
            {
              id: generateId(),
              materialId: material.id,
              friendlyMessage: `未知的材料类型「${material.type}」`,
              suggestion: '请检查材料类型是否正确，支持的类型：时间轴、对白轨、音乐文件、Cue清单、导演备注',
              detectionStep: '第0步：识别材料类型',
            },
          ],
        };
    }

    if (!result.success) {
      return {
        ...updatedMaterial,
        parseStatus: 'failed',
        parseErrors: result.error ? [result.error] : [],
      };
    }

    const fingerprint = calculateFingerprint(material.content, result.data?.metadata);

    return {
      ...updatedMaterial,
      parseStatus: 'success',
      parseErrors: [],
      parsedData: result.data,
      fingerprint,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : '未知错误';
    return {
      ...updatedMaterial,
      parseStatus: 'failed',
      parseErrors: [
        {
          id: generateId(),
          materialId: material.id,
          friendlyMessage: `解析过程中出现意外错误：${errorMessage}`,
          suggestion: '请检查文件是否损坏，或尝试重新上传',
          detectionStep: '第0步：读取文件内容',
        },
      ],
    };
  }
}

function parseTimeline(material: Material): Result<{ cuePoints: CuePoint[]; metadata: Record<string, unknown> }, ParseError> {
  const lines = material.content.split('\n').filter(line => line.trim());
  const cuePoints: CuePoint[] = [];
  const errors: ParseError[] = [];

  let headerDetected = false;
  let startTimeCol = -1;
  let endTimeCol = -1;
  let nameCol = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    if (!headerDetected) {
      if (line.includes('时间码') || line.includes('Timecode') || line.includes('入点') || line.includes('开始')) {
        headerDetected = true;
        const columns = splitLine(line);
        startTimeCol = columns.findIndex(c => c.includes('入点') || c.includes('开始') || c.includes('Start') || c.includes('In'));
        endTimeCol = columns.findIndex(c => c.includes('出点') || c.includes('结束') || c.includes('End') || c.includes('Out'));
        nameCol = columns.findIndex(c => c.includes('名称') || c.includes('Name') || c.includes('描述') || c.includes('Description'));

        if (startTimeCol === -1) {
          return {
            success: false,
            error: {
              id: generateId(),
              materialId: material.id,
              lineNumber,
              friendlyMessage: `第${lineNumber}行表头未找到「开始时间」或「入点」列`,
              suggestion: '请检查表头格式，支持的关键词：开始时间、入点、Start、In',
              detectionStep: '第1步：识别表头列',
            },
          };
        }
        continue;
      }

      if (line.match(/\d{1,2}:\d{2}:\d{2}/)) {
        headerDetected = true;
        startTimeCol = 0;
        endTimeCol = 1;
        nameCol = 2;
      } else {
        continue;
      }
    }

    const columns = splitLine(line);
    if (columns.length < 2) continue;

    const startTimeStr = columns[startTimeCol]?.trim();
    const endTimeStr = columns[endTimeCol]?.trim();
    const name = columns[nameCol]?.trim() || `Cue ${cuePoints.length + 1}`;

    if (!startTimeStr) {
      errors.push({
        id: generateId(),
        materialId: material.id,
        lineNumber,
        fieldName: 'startTime',
        originalValue: startTimeStr,
        friendlyMessage: `第${lineNumber}行开始时间为空`,
        suggestion: '请检查该行是否缺少开始时间码',
        detectionStep: '第2步：提取时间码字段',
      });
      continue;
    }

    const startTimeResult = parseTimecode(startTimeStr, material.id, lineNumber, 'startTime');
    if (!startTimeResult.success) {
      if (startTimeResult.error) errors.push(startTimeResult.error);
      continue;
    }

    const startTime = startTimeResult.data!;

    let endTime = startTime;
    if (endTimeStr) {
      const endTimeResult = parseTimecode(endTimeStr, material.id, lineNumber, 'endTime');
      if (!endTimeResult.success) {
        if (endTimeResult.error) errors.push(endTimeResult.error);
      } else {
        endTime = endTimeResult.data!;
      }
    }

    const durationTotal = Math.max(0, endTime.totalSeconds - startTime.totalSeconds);
    const duration = {
      hours: Math.floor(durationTotal / 3600),
      minutes: Math.floor((durationTotal % 3600) / 60),
      seconds: Math.floor(durationTotal % 60),
      totalSeconds: durationTotal,
      originalFormat: startTime.originalFormat,
    } as const;

    cuePoints.push({
      id: generateId(),
      number: `${cuePoints.length + 1}`,
      name,
      startTime,
      endTime,
      duration,
      sourceMaterial: 'timeline',
    });
  }

  if (cuePoints.length === 0) {
    return {
      success: false,
      error: {
        id: generateId(),
        materialId: material.id,
        friendlyMessage: '未从时间轴中解析出任何Cue点',
        suggestion: '请检查文件格式是否正确，时间码格式应为 HH:MM:SS:FF 或 HH:MM:SS.ms',
        detectionStep: '第3步：验证解析结果',
      },
    };
  }

  return {
    success: true,
    data: {
      cuePoints,
      metadata: {
        lineCount: lines.length,
        cueCount: cuePoints.length,
        errorCount: errors.length,
      },
    },
  };
}

function parseDialog(material: Material): Result<{ cuePoints: CuePoint[]; metadata: Record<string, unknown> }, ParseError> {
  return parseGenericCueList(material, 'dialog');
}

function parseMusic(material: Material): Result<{ cuePoints: CuePoint[]; metadata: Record<string, unknown> }, ParseError> {
  const result = parseGenericCueList(material, 'music');

  if (result.success && result.data) {
    const cuePoints = result.data.cuePoints;
    for (const cue of cuePoints) {
      const durationFromFile = detectDurationFromFileName(material.fileName);
      if (durationFromFile && Math.abs(durationFromFile - cue.duration.totalSeconds) > 1) {
        result.data.metadata.durationMismatch = {
          expected: durationFromFile,
          actual: cue.duration.totalSeconds,
          cueName: cue.name,
        };
      }
    }
  }

  return result;
}

function parseCueList(material: Material): Result<{ cuePoints: CuePoint[]; metadata: Record<string, unknown> }, ParseError> {
  return parseGenericCueList(material, 'cue');
}

function parseNotes(material: Material): Result<{ rawData: Record<string, unknown>; metadata: Record<string, unknown> }, ParseError> {
  const lines = material.content.split('\n');
  const notes: Array<{ timecode?: string; content: string; lineNumber: number }> = [];
  const timecodePattern = /(\d{1,2}:\d{2}:\d{2}(?::\d{2}|\.\d{1,3})?)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const match = line.match(timecodePattern);
    if (match) {
      notes.push({
        timecode: match[1],
        content: line.replace(timecodePattern, '').trim(),
        lineNumber: i + 1,
      });
    } else {
      notes.push({
        content: line,
        lineNumber: i + 1,
      });
    }
  }

  return {
    success: true,
    data: {
      rawData: { notes },
      metadata: {
        noteCount: notes.length,
        withTimecode: notes.filter(n => n.timecode).length,
      },
    },
  };
}

function parseGenericCueList(
  material: Material,
  sourceType: MaterialType
): Result<{ cuePoints: CuePoint[]; metadata: Record<string, unknown> }, ParseError> {
  const lines = material.content.split('\n').filter(line => line.trim());
  const cuePoints: CuePoint[] = [];
  const errors: ParseError[] = [];

  let headerDetected = false;
  let numberCol = -1;
  let nameCol = -1;
  let startTimeCol = -1;
  let endTimeCol = -1;
  let durationCol = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    if (!headerDetected) {
      if (line.match(/(Cue|编号|序号|No\.|#)/i) && line.match(/(时间码|开始|Start|Time)/i)) {
        headerDetected = true;
        const columns = splitLine(line);
        numberCol = columns.findIndex(c => c.match(/Cue|编号|序号|No\.|#/i));
        nameCol = columns.findIndex(c => c.match(/名称|Name|标题|Title/i));
        startTimeCol = columns.findIndex(c => c.match(/开始|Start|入点|In|Timecode/i));
        endTimeCol = columns.findIndex(c => c.match(/结束|End|出点|Out/i));
        durationCol = columns.findIndex(c => c.match(/时长|Duration|长度/i));

        if (startTimeCol === -1) {
          startTimeCol = columns.findIndex(c => c.match(/\d{1,2}:\d{2}:\d{2}/));
        }
        continue;
      }

      if (line.match(/\d{1,2}:\d{2}:\d{2}/)) {
        headerDetected = true;
        const columns = splitLine(line);
        numberCol = columns.findIndex(c => /^\d+$/.test(c.trim())) !== -1 ? columns.findIndex(c => /^\d+$/.test(c.trim())) : 0;
        startTimeCol = columns.findIndex(c => c.match(/\d{1,2}:\d{2}:\d{2}/));
        endTimeCol = startTimeCol + 1;
        nameCol = columns.length > startTimeCol + 2 ? startTimeCol + 2 : 1;
      } else {
        continue;
      }
    }

    const columns = splitLine(line);
    if (columns.length < 2) continue;

    const number = numberCol >= 0 ? columns[numberCol]?.trim() : `${cuePoints.length + 1}`;
    const name = nameCol >= 0 ? columns[nameCol]?.trim() : `Cue ${number}`;
    const startTimeStr = startTimeCol >= 0 ? columns[startTimeCol]?.trim() : '';
    const endTimeStr = endTimeCol >= 0 ? columns[endTimeCol]?.trim() : '';
    const durationStr = durationCol >= 0 ? columns[durationCol]?.trim() : '';

    if (!startTimeStr) continue;

    const startTimeResult = parseTimecode(startTimeStr, material.id, lineNumber, 'startTime');
    if (!startTimeResult.success) {
      if (startTimeResult.error) errors.push(startTimeResult.error);
      continue;
    }

    const startTime = startTimeResult.data!;
    let endTime = startTime;

    if (endTimeStr) {
      const endTimeResult = parseTimecode(endTimeStr, material.id, lineNumber, 'endTime');
      if (!endTimeResult.success) {
        if (endTimeResult.error) errors.push(endTimeResult.error);
      } else {
        endTime = endTimeResult.data!;
      }
    } else if (durationStr) {
      const durationResult = parseTimecode(durationStr, material.id, lineNumber, 'duration');
      if (durationResult.success && durationResult.data) {
        const duration = durationResult.data;
        const endTotal = startTime.totalSeconds + duration.totalSeconds;
        endTime = {
          hours: Math.floor(endTotal / 3600),
          minutes: Math.floor((endTotal % 3600) / 60),
          seconds: Math.floor(endTotal % 60),
          totalSeconds: endTotal,
          originalFormat: startTime.originalFormat,
        };
      }
    }

    const durationTotal = Math.max(0, endTime.totalSeconds - startTime.totalSeconds);
    const duration = {
      hours: Math.floor(durationTotal / 3600),
      minutes: Math.floor((durationTotal % 3600) / 60),
      seconds: Math.floor(durationTotal % 60),
      totalSeconds: durationTotal,
      originalFormat: startTime.originalFormat,
    } as const;

    cuePoints.push({
      id: generateId(),
      number: number || `${cuePoints.length + 1}`,
      name: name || `Cue ${number || cuePoints.length + 1}`,
      startTime,
      endTime,
      duration,
      sourceMaterial: sourceType,
    });
  }

  if (cuePoints.length === 0) {
    return {
      success: false,
      error: {
        id: generateId(),
        materialId: material.id,
        friendlyMessage: `未从${sourceType === 'dialog' ? '对白轨' : sourceType === 'music' ? '音乐文件' : 'Cue清单'}中解析出任何Cue点`,
        suggestion: '请检查文件格式，支持制表符分隔、逗号分隔或空格分隔的表格格式',
        detectionStep: '第3步：验证解析结果',
      },
    };
  }

  return {
    success: true,
    data: {
      cuePoints,
      metadata: {
        lineCount: lines.length,
        cueCount: cuePoints.length,
        errorCount: errors.length,
      },
    },
  };
}

function splitLine(line: string): string[] {
  if (line.includes('\t')) {
    return line.split('\t');
  }
  if (line.includes(',')) {
    return line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
  }
  return line.split(/\s{2,}/);
}

function detectDurationFromFileName(fileName: string): number | null {
  const match = fileName.match(/(\d+)m(\d+)s/);
  if (match) {
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }
  const match2 = fileName.match(/(\d+):(\d{2})/);
  if (match2) {
    return parseInt(match2[1], 10) * 60 + parseInt(match2[2], 10);
  }
  return null;
}
