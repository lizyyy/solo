import { VisitorService } from '../services/VisitorService';
import { AccessType, VisitorStatus } from '../types';

const visitorService = new VisitorService();

export const initSampleData = () => {
  const visitor1 = visitorService.createVisitor({
    visitorName: '张三',
    visitorPhone: '13800138000',
    visitorIdCard: '110101199001011234',
    visitorCompany: 'ABC科技有限公司',
    hostName: '李四',
    hostDepartment: '技术部',
    hostPhone: '13900139000',
    visitDate: '2026-05-20',
    startTime: '09:00',
    endTime: '18:00',
    accessType: AccessType.SHARED_WORKSTATION,
    workstationId: 'WS-A-001',
    floor: 5,
    building: 'A座',
    visitPurpose: '业务洽谈与技术交流',
    numberOfVisitors: 1,
    hasCar: true,
    plateNumber: '京A12345',
    healthCodeStatus: 'green',
    temperature: 36.5,
    accessCardNumber: 'ACC-001234',
    accessCardIssuedAt: '2026-05-20T09:00:00.000Z'
  }, '前台-小王');

  visitorService.submitVisitor(visitor1.id, '前台-小王', 'receptionist');
  visitorService.approveVisitor(visitor1.id, '张经理', 'manager', '访客材料齐全，同意放行');

  const visitor2 = visitorService.createVisitor({
    visitorName: '王五',
    visitorPhone: '13900238000',
    visitorIdCard: '310101198505055678',
    visitorCompany: 'XYZ集团',
    hostName: '赵六',
    hostDepartment: '市场部',
    hostPhone: '13800239000',
    visitDate: '2026-05-21',
    startTime: '10:00',
    endTime: '16:00',
    accessType: AccessType.RECEPTION_DESK,
    workstationId: 'REC-B-001',
    floor: 3,
    building: 'B座',
    visitPurpose: '合同签署会议',
    numberOfVisitors: 3,
    hasCar: false,
    healthCodeStatus: 'green',
    temperature: 36.2
  }, '前台-小李');

  visitorService.submitVisitor(visitor2.id, '前台-小李', 'receptionist');

  const visitor3 = visitorService.createVisitor({
    visitorName: '陈七',
    visitorPhone: '13700338000',
    visitorIdCard: '440101198808089012',
    visitorCompany: '创新科技有限公司',
    hostName: '周八',
    hostDepartment: '研发部',
    hostPhone: '13700339000',
    visitDate: '2026-05-22',
    startTime: '14:00',
    endTime: '20:00',
    accessType: AccessType.CONFERENCE_ROOM,
    floor: 10,
    building: 'C座',
    visitPurpose: '项目启动会议',
    numberOfVisitors: 5,
    hasCar: true,
    plateNumber: '沪B88888',
    healthCodeStatus: 'green',
    temperature: 36.8
  }, '前台-小王');

  visitorService.submitVisitor(visitor3.id, '前台-小王', 'receptionist');
  visitorService.addComment(visitor3.id, '刘主管', 'supervisor', '需要准备大型会议室');
  visitorService.approveVisitor(visitor3.id, '王总监', 'director', '重要客户，优先安排');

  return [visitor1, visitor2, visitor3];
};

export default initSampleData;
