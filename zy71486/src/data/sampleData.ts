import type { NoiseRecord, Room, Course } from '@/types';

export const sampleNoiseRecords: Omit<NoiseRecord, 'id' | 'batchId' | 'isUpdate' | 'isDuplicate' | 'previousVersionId'>[] = [
  { roomId: 'A101', date: '2026-05-25', startTime: '19:00', endTime: '21:00', decibel: 82, complaintSource: '3号楼住户', description: '鼓声明显，持续2小时' },
  { roomId: 'A101', date: '2026-05-26', startTime: '19:30', endTime: '21:30', decibel: 78, complaintSource: '3号楼住户', description: '管乐排练声较大' },
  { roomId: 'A101', date: '2026-05-27', startTime: '20:00', endTime: '22:00', decibel: 85, complaintSource: '4号楼住户', description: '合奏排练，噪声严重' },
  { roomId: 'B201', date: '2026-05-25', startTime: '19:00', endTime: '20:30', decibel: 65, complaintSource: '2号楼住户', description: '钢琴声可听到但不太严重' },
  { roomId: 'B201', date: '2026-05-26', startTime: '18:30', endTime: '20:00', decibel: 72, complaintSource: '2号楼住户', description: '小提琴声穿透墙壁' },
  { roomId: 'B201', date: '2026-05-28', startTime: '19:00', endTime: '21:00', decibel: 76, complaintSource: '1号楼住户', description: '弦乐四重奏，声音偏大' },
  { roomId: 'C302', date: '2026-05-25', startTime: '20:00', endTime: '22:00', decibel: 88, complaintSource: '5号楼住户', description: '铜管乐排练，噪声极大' },
  { roomId: 'C302', date: '2026-05-27', startTime: '19:00', endTime: '21:00', decibel: 91, complaintSource: '5号楼住户', description: '交响乐排练，震动感明显' },
  { roomId: 'C302', date: '2026-05-28', startTime: '18:00', endTime: '20:00', decibel: 79, complaintSource: '6号楼住户', description: '打击乐排练' },
  { roomId: 'A102', date: '2026-05-26', startTime: '19:00', endTime: '21:00', decibel: 68, complaintSource: '3号楼住户', description: '声乐练习，偶尔较大声' },
  { roomId: 'A102', date: '2026-05-28', startTime: '20:00', endTime: '22:00', decibel: 74, complaintSource: '4号楼住户', description: '合唱排练声偏大' },
  { roomId: 'B202', date: '2026-05-25', startTime: '18:00', endTime: '20:00', decibel: 70, complaintSource: '1号楼住户', description: '吉他声略有打扰' },
  { roomId: 'B202', date: '2026-05-27', startTime: '19:30', endTime: '21:00', decibel: 73, complaintSource: '2号楼住户', description: '古筝练习声' },
  { roomId: 'D401', date: '2026-05-26', startTime: '20:00', endTime: '22:00', decibel: 95, complaintSource: '7号楼住户', description: '架子鼓排练，噪声极严重' },
  { roomId: 'D401', date: '2026-05-28', startTime: '19:00', endTime: '21:30', decibel: 87, complaintSource: '7号楼住户', description: '摇滚乐队排练' },
];

export const sampleRooms: Omit<Room, 'id' | 'batchId'>[] = [
  { roomId: 'A101', name: '交响乐排练室', location: 'A栋1层东', soundproofLevel: 'B' },
  { roomId: 'A102', name: '声乐排练室', location: 'A栋1层西', soundproofLevel: 'B' },
  { roomId: 'B201', name: '弦乐排练室', location: 'B栋2层东', soundproofLevel: 'A' },
  { roomId: 'B202', name: '民乐排练室', location: 'B栋2层西', soundproofLevel: 'A' },
  { roomId: 'C302', name: '铜管乐排练室', location: 'C栋3层', soundproofLevel: 'C' },
  { roomId: 'D401', name: '打击乐排练室', location: 'D栋4层', soundproofLevel: 'D' },
];

export const sampleCourses: Omit<Course, 'id' | 'batchId'>[] = [
  { roomId: 'A101', courseName: '交响乐合奏', teacher: '王老师', weekday: '1', startTime: '19:00', endTime: '21:00' },
  { roomId: 'A101', courseName: '管乐重奏', teacher: '李老师', weekday: '3', startTime: '19:30', endTime: '21:30' },
  { roomId: 'A101', courseName: '管弦乐合奏', teacher: '王老师', weekday: '4', startTime: '20:00', endTime: '22:00' },
  { roomId: 'B201', courseName: '小提琴选修', teacher: '张老师', weekday: '1', startTime: '19:00', endTime: '20:30' },
  { roomId: 'B201', courseName: '弦乐四重奏', teacher: '张老师', weekday: '2', startTime: '18:30', endTime: '20:00' },
  { roomId: 'B201', courseName: '大提琴进阶', teacher: '赵老师', weekday: '4', startTime: '19:00', endTime: '21:00' },
  { roomId: 'C302', courseName: '铜管乐基础', teacher: '刘老师', weekday: '1', startTime: '20:00', endTime: '22:00' },
  { roomId: 'C302', courseName: '交响乐排练', teacher: '王老师', weekday: '3', startTime: '19:00', endTime: '21:00' },
  { roomId: 'C302', courseName: '打击乐入门', teacher: '陈老师', weekday: '4', startTime: '18:00', endTime: '20:00' },
  { roomId: 'A102', courseName: '声乐基础', teacher: '周老师', weekday: '2', startTime: '19:00', endTime: '21:00' },
  { roomId: 'A102', courseName: '合唱排练', teacher: '周老师', weekday: '4', startTime: '20:00', endTime: '22:00' },
  { roomId: 'B202', courseName: '吉他选修', teacher: '吴老师', weekday: '1', startTime: '18:00', endTime: '20:00' },
  { roomId: 'B202', courseName: '古筝进阶', teacher: '孙老师', weekday: '3', startTime: '19:30', endTime: '21:00' },
  { roomId: 'D401', courseName: '架子鼓基础', teacher: '陈老师', weekday: '2', startTime: '20:00', endTime: '22:00' },
  { roomId: 'D401', courseName: '摇滚乐队', teacher: '陈老师', weekday: '4', startTime: '19:00', endTime: '21:30' },
];

export const sampleNoiseCSV = `房间编号,日期,开始时间,结束时间,分贝,投诉来源,描述
A101,2026-05-25,19:00,21:00,82,3号楼住户,鼓声明显持续2小时
A101,2026-05-26,19:30,21:30,78,3号楼住户,管乐排练声较大
B201,2026-05-25,19:00,20:30,65,2号楼住户,钢琴声可听到但不太严重
C302,2026-05-25,20:00,22:00,88,5号楼住户,铜管乐排练噪声极大`;

export const sampleRoomCSV = `房间编号,名称,位置,隔音等级
A101,交响乐排练室,A栋1层东,B
A102,声乐排练室,A栋1层西,B
B201,弦乐排练室,B栋2层东,A
C302,铜管乐排练室,C栋3层,C`;

export const sampleCourseCSV = `房间编号,课程名称,教师,星期,开始时间,结束时间
A101,交响乐合奏,王老师,1,19:00,21:00
A101,管乐重奏,李老师,3,19:30,21:30
B201,小提琴选修,张老师,1,19:00,20:30
C302,铜管乐基础,刘老师,1,20:00,22:00`;
