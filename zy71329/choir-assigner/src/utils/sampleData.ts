import type { Member, VoicePart, AttendanceRecord } from '../types';

export const sampleMembers: Member[] = [
  { id: 'm1', name: '张三', gender: 'female', voiceRange: { lowest: 'C4', highest: 'C6', preferred: 'Soprano' }, attendance: { totalRehearsals: 20, attendedRehearsals: 19, rate: 0.95 }, isVeteran: true, seniority: 5, notes: '首席女高音，音域宽广', preferredPart: 'Soprano' },
  { id: 'm2', name: '李四', gender: 'female', voiceRange: { lowest: 'A3', highest: 'A5' }, attendance: { totalRehearsals: 20, attendedRehearsals: 18, rate: 0.9 }, isVeteran: true, seniority: 4, preferredPart: 'Soprano' },
  { id: 'm3', name: '王五', gender: 'female', voiceRange: { lowest: 'B3', highest: 'B5' }, attendance: { totalRehearsals: 20, attendedRehearsals: 17, rate: 0.85 }, isVeteran: false, seniority: 1, bindPartnerId: 'm4', bindPartnerName: '赵六' },
  { id: 'm4', name: '赵六', gender: 'female', voiceRange: { lowest: 'A3', highest: 'G5' }, attendance: { totalRehearsals: 20, attendedRehearsals: 16, rate: 0.8 }, isVeteran: false, seniority: 1, bindPartnerId: 'm3', bindPartnerName: '王五' },
  { id: 'm5', name: '陈七', gender: 'female', voiceRange: { lowest: 'G3', highest: 'F5' }, attendance: { totalRehearsals: 20, attendedRehearsals: 18, rate: 0.9 }, isVeteran: true, seniority: 3, preferredPart: 'Alto' },
  { id: 'm6', name: '刘八', gender: 'female', voiceRange: { lowest: 'F3', highest: 'E5' }, attendance: { totalRehearsals: 20, attendedRehearsals: 12, rate: 0.6 }, isVeteran: false, seniority: 2, notes: '出勤率较低，需关注' },
  { id: 'm7', name: '周九', gender: 'female', voiceRange: { lowest: 'E3', highest: 'D5' }, attendance: { totalRehearsals: 20, attendedRehearsals: 19, rate: 0.95 }, isVeteran: true, seniority: 4, preferredPart: 'Alto' },
  { id: 'm8', name: '吴十', gender: 'female', voiceRange: { lowest: 'F3', highest: 'F5' }, attendance: { totalRehearsals: 20, attendedRehearsals: 17, rate: 0.85 }, isVeteran: false, seniority: 1 },
  { id: 'm9', name: '郑十一', gender: 'male', voiceRange: { lowest: 'C3', highest: 'C5' }, attendance: { totalRehearsals: 20, attendedRehearsals: 18, rate: 0.9 }, isVeteran: true, seniority: 5, preferredPart: 'Tenor' },
  { id: 'm10', name: '冯十二', gender: 'male', voiceRange: { lowest: 'B2', highest: 'B4' }, attendance: { totalRehearsals: 20, attendedRehearsals: 17, rate: 0.85 }, isVeteran: false, seniority: 2 },
  { id: 'm11', name: '陈十三', gender: 'male', voiceRange: { lowest: 'A2', highest: 'A4' }, attendance: { totalRehearsals: 20, attendedRehearsals: 19, rate: 0.95 }, isVeteran: true, seniority: 3, preferredPart: 'Tenor' },
  { id: 'm12', name: '褚十四', gender: 'male', voiceRange: { lowest: 'G2', highest: 'G4' }, attendance: { totalRehearsals: 20, attendedRehearsals: 16, rate: 0.8 }, isVeteran: false, seniority: 1, bindPartnerId: 'm13', bindPartnerName: '卫十五' },
  { id: 'm13', name: '卫十五', gender: 'male', voiceRange: { lowest: 'F2', highest: 'F4' }, attendance: { totalRehearsals: 20, attendedRehearsals: 18, rate: 0.9 }, isVeteran: false, seniority: 1, bindPartnerId: 'm12', bindPartnerName: '褚十四' },
  { id: 'm14', name: '蒋十六', gender: 'male', voiceRange: { lowest: 'C2', highest: 'C4' }, attendance: { totalRehearsals: 20, attendedRehearsals: 19, rate: 0.95 }, isVeteran: true, seniority: 4, preferredPart: 'Bass' },
  { id: 'm15', name: '沈十七', gender: 'male', voiceRange: { lowest: 'D2', highest: 'D4' }, attendance: { totalRehearsals: 20, attendedRehearsals: 17, rate: 0.85 }, isVeteran: false, seniority: 2 },
  { id: 'm16', name: '韩十八', gender: 'male', voiceRange: { lowest: 'E2', highest: 'E4' }, attendance: { totalRehearsals: 20, attendedRehearsals: 18, rate: 0.9 }, isVeteran: true, seniority: 3, preferredPart: 'Bass' },
];

export const sampleVoiceParts: VoicePart[] = [
  { id: 'p1', name: 'Soprano', displayName: '女高音', gender: 'female', range: { lowest: 'C4', highest: 'C6' }, minMembers: 3, maxMembers: 4, idealMembers: 4, requiredVeterans: 1, difficulty: 'hard' },
  { id: 'p2', name: 'Alto', displayName: '女低音', gender: 'female', range: { lowest: 'F3', highest: 'F5' }, minMembers: 3, maxMembers: 4, idealMembers: 4, requiredVeterans: 1, difficulty: 'medium' },
  { id: 'p3', name: 'Tenor', displayName: '男高音', gender: 'male', range: { lowest: 'C3', highest: 'C5' }, minMembers: 3, maxMembers: 4, idealMembers: 4, requiredVeterans: 1, difficulty: 'hard' },
  { id: 'p4', name: 'Bass', displayName: '男低音', gender: 'male', range: { lowest: 'C2', highest: 'C4' }, minMembers: 3, maxMembers: 4, idealMembers: 4, requiredVeterans: 1, difficulty: 'medium' },
];

export const sampleAttendanceRecords: AttendanceRecord[] = sampleMembers.flatMap(member => {
  return Array.from({ length: 5 }, (_, i) => ({
    memberId: member.id,
    memberName: member.name,
    date: `2024-0${i + 1}-15`,
    status: (Math.random() > 0.15 ? 'present' : Math.random() > 0.5 ? 'absent' : 'late') as 'present' | 'absent' | 'late',
  }));
});
