import { ResponsiblePerson } from '@/types';

export const mockPersons: ResponsiblePerson[] = [
  {
    id: 'p001',
    name: '张伟',
    role: '运维工程师',
    phone: '13800138001',
    email: 'zhangwei@company.com',
  },
  {
    id: 'p002',
    name: '李明',
    role: '巡检人员',
    phone: '13800138002',
    email: 'liming@company.com',
  },
  {
    id: 'p003',
    name: '王芳',
    role: '项目经理',
    phone: '13800138003',
    email: 'wangfang@company.com',
  },
  {
    id: 'p004',
    name: '刘洋',
    role: '运维工程师',
    phone: '13800138004',
    email: 'liuyang@company.com',
  },
  {
    id: 'p005',
    name: '陈静',
    role: '巡检人员',
    phone: '13800138005',
    email: 'chenjing@company.com',
  },
];

export const findPersonById = (id: string): ResponsiblePerson | undefined =>
  mockPersons.find(p => p.id === id);

export const findPersonByRole = (role: string): ResponsiblePerson | undefined =>
  mockPersons.find(p => p.role.includes(role));
