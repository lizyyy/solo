import * as XLSX from 'xlsx';
import type { Member, VoicePart, ImportData, AttendanceRecord } from '../types';

export async function importFromExcel(file: File): Promise<Partial<ImportData>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const result: Partial<ImportData> = {};

        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (sheetName.includes('团员') || sheetName.includes('member') || sheetName === 'Sheet1') {
            result.members = parseMembers(jsonData);
          } else if (sheetName.includes('声部') || sheetName.includes('part')) {
            result.voiceParts = parseVoiceParts(jsonData);
          } else if (sheetName.includes('出勤') || sheetName.includes('attendance')) {
            result.attendanceRecords = parseAttendance(jsonData);
          } else if (sheetName.includes('备注') || sheetName.includes('note')) {
            const firstRow = jsonData[0] as Record<string, any>;
            if (jsonData.length > 0 && '内容' in firstRow) {
              result.teacherNotes = firstRow['内容'];
            }
          } else if (sheetName.includes('信息') || sheetName.includes('info')) {
            jsonData.forEach((row: any) => {
              if (row['项目'] === '曲目名称' && row['内容']) {
                result.songName = row['内容'];
              }
              if (row['项目'] === '老师备注' && row['内容']) {
                result.teacherNotes = row['内容'];
              }
            });
          }
        });

        resolve(result);
      } catch (error) {
        reject(new Error('文件解析失败，请检查文件格式'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsBinaryString(file);
  });
}

function parseMembers(data: any[]): Member[] {
  return data.map((row, index) => {
    const gender = String(row['性别'] || row['gender'] || '').toLowerCase();
    const voiceRangeStr = String(row['音域'] || row['voiceRange'] || 'C4-C5');
    const [lowest, highest] = voiceRangeStr.split(/[-~至]/).map(s => s.trim());
    
    const attendanceRate = parseFloat(row['出勤率'] || row['attendanceRate'] || '0.85');
    const totalRehearsals = parseInt(row['总排练次数'] || '20');
    const attendedRehearsals = Math.round(totalRehearsals * attendanceRate);

    const member: Member = {
      id: `m_${Date.now()}_${index}`,
      name: String(row['姓名'] || row['name'] || `团员${index + 1}`),
      gender: (gender === '男' || gender === 'male' ? 'male' : 'female') as 'male' | 'female',
      voiceRange: {
        lowest: normalizeNote(lowest) || 'C4',
        highest: normalizeNote(highest) || 'C5',
      },
      attendance: {
        totalRehearsals,
        attendedRehearsals,
        rate: attendanceRate,
      },
      isVeteran: String(row['是否资深'] || row['isVeteran'] || '').includes('是'),
      seniority: parseInt(row['工龄'] || row['seniority'] || '1'),
      notes: String(row['备注'] || row['notes'] || ''),
      preferredPart: row['偏好声部'] || row['preferredPart'] || undefined,
      bindPartnerName: row['搭档'] || row['partner'] || undefined,
    };
    return member;
  }).filter(m => m.name && m.name !== '');
}

function parseVoiceParts(data: any[]): VoicePart[] {
  return data.map((row, index) => {
    const rangeStr = String(row['音域要求'] || row['range'] || 'C4-C5');
    const [lowest, highest] = rangeStr.split(/[-~至]/).map(s => s.trim());
    const difficulty = String(row['难度'] || row['difficulty'] || 'medium').toLowerCase();

    return {
      id: `p_${Date.now()}_${index}`,
      name: String(row['声部'] || row['name'] || `Part${index + 1}`),
      displayName: String(row['显示名称'] || row['displayName'] || row['声部'] || `声部${index + 1}`),
      gender: (row['性别'] === '男' ? 'male' : row['性别'] === '女' ? 'female' : 'mixed') as 'male' | 'female' | 'mixed',
      range: {
        lowest: normalizeNote(lowest) || 'C4',
        highest: normalizeNote(highest) || 'C5',
      },
      minMembers: parseInt(row['最少人数'] || row['minMembers'] || '0'),
      maxMembers: parseInt(row['最多人数'] || row['maxMembers'] || '99'),
      idealMembers: parseInt(row['理想人数'] || row['idealMembers'] || '4'),
      requiredVeterans: parseInt(row['需资深'] || row['requiredVeterans'] || '0') || undefined,
      difficulty: (difficulty === 'easy' ? 'easy' : difficulty === 'hard' ? 'hard' : 'medium') as 'easy' | 'medium' | 'hard',
    };
  }).filter(p => p.name && p.name !== '');
}

function parseAttendance(data: any[]): AttendanceRecord[] {
  return data.map((row, index) => ({
    memberId: String(row['团员ID'] || row['memberId'] || `m_${index}`),
    memberName: String(row['姓名'] || row['memberName'] || ''),
    date: String(row['日期'] || row['date'] || new Date().toISOString().split('T')[0]),
    status: (String(row['状态'] || row['status'] || 'present').toLowerCase() as 'present' | 'absent' | 'late'),
    notes: String(row['备注'] || row['notes'] || ''),
  })).filter(r => r.memberName && r.memberName !== '');
}

function normalizeNote(note: string): string | null {
  if (!note) return null;
  note = note.trim().toUpperCase();
  const match = note.match(/^([CDEFGAB])([#B])?(\d)$/i);
  if (match) {
    return note;
  }
  return note;
}

export function validateImportData(data: Partial<ImportData>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.members || data.members.length === 0) {
    errors.push('未找到团员数据');
  } else {
    if (data.members.length < 4) {
      errors.push('团员人数过少，至少需要4人');
    }
  }

  if (!data.voiceParts || data.voiceParts.length === 0) {
    errors.push('未找到声部配置数据');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
