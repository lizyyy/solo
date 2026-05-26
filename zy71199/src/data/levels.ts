import type { Level, FileCard, ArchiveBox, BorrowRequest } from '@/types';

const boxes: ArchiveBox[] = [
  { id: 'box-contract', name: '合同档案盒', category: 'contract', color: '#c0392b', position: { x: -2.5, y: 0 } },
  { id: 'box-invoice', name: '发票档案盒', category: 'invoice', color: '#27ae60', position: { x: -1.25, y: 0 } },
  { id: 'box-confidential', name: '保密档案盒', category: 'confidential', color: '#8e44ad', position: { x: 0, y: 0 } },
  { id: 'box-meeting', name: '会议档案盒', category: 'meeting', color: '#2980b9', position: { x: 1.25, y: 0 } },
  { id: 'box-project', name: '项目档案盒', category: 'project', color: '#d4a017', position: { x: 2.5, y: 0 } },
];

function f(id: string, name: string, type: FileCard['type'], confidentiality: FileCard['confidentiality'],
  retentionPeriod: FileCard['retentionPeriod'], content: string): FileCard {
  return { id, name, type, confidentiality, retentionPeriod, content, correctBoxId: `box-${type}` };
}

function br(id: string, fileId: string, borrower: string, department: string, purpose: string,
  needsApproval: boolean, deadline: string): BorrowRequest {
  return { id, fileId, borrower, department, purpose, needsApproval, approved: false, registered: false, deadline };
}

export const levels: Level[] = [
  {
    id: 1,
    name: '新手入门',
    description: '熟悉基本归档流程，处理合同与发票文件',
    fileCount: 5,
    timeLimit: 180,
    targetScore: 40,
    boxes,
    files: [
      f('lv1-1', '办公设备采购合同', 'contract', 'confidential', 'permanent',
        '甲方：XX公司 乙方：YY供应商。涉及核心办公设备采购金额及条款。'),
      f('lv1-2', '办公用品发票#001', 'invoice', 'open', '5yrs',
        '发票编号：INV-2024-001。开票日期：2024-01-15。金额：¥3,500。'),
      f('lv1-3', '软件服务合同', 'contract', 'confidential', '30yrs',
        '本合同涉及软件定制开发服务条款及知识产权归属。'),
      f('lv1-4', '差旅费发票#002', 'invoice', 'open', '10yrs',
        '发票编号：INV-2024-002。开票日期：2024-02-20。金额：¥8,200。'),
      f('lv1-5', '房屋租赁合同', 'contract', 'confidential', 'permanent',
        '本合同涉及公司办公场所租赁，含租金、期限等关键条款。'),
    ],
  },
  {
    id: 2,
    name: '渐入佳境',
    description: '处理多种文件类型，注意保密级别和保管期限',
    fileCount: 8,
    timeLimit: 240,
    targetScore: 60,
    boxes,
    files: [
      f('lv2-1', '技术保密协议', 'confidential', 'top_secret', 'permanent',
        '本协议涉及核心技术机密，严禁外泄。双方均需签署保密承诺。'),
      f('lv2-2', '客户咨询发票#003', 'invoice', 'open', '5yrs',
        '发票编号：INV-2024-003。开票日期：2024-03-10。金额：¥12,000。'),
      f('lv2-3', '季度工作总结', 'meeting', 'secret', '30yrs',
        '2024年Q1季度工作总结，含部门业绩数据及下季度计划。'),
      f('lv2-4', '项目立项申请书', 'project', 'confidential', '30yrs',
        '本项目涉及新产品研发立项，含技术方案、预算及进度安排。'),
      f('lv2-5', '劳动合同', 'contract', 'secret', 'permanent',
        '甲方：XX公司 乙方：员工。涉及薪酬、岗位、保密条款。'),
      f('lv2-6', '采购发票#004', 'invoice', 'open', '10yrs',
        '发票编号：INV-2024-004。开票日期：2024-04-05。金额：¥45,000。'),
      f('lv2-7', '董事会会议纪要', 'meeting', 'confidential', 'permanent',
        '本次会议审议了公司战略调整及重大人事任免事项。'),
      f('lv2-8', '客户信息保密材料', 'confidential', 'top_secret', '30yrs',
        '本文件包含核心客户名单、联系方式及交易数据，仅限授权人员查阅。'),
    ],
    borrowRequests: [
      br('br-1', 'lv2-1', '张经理', '技术部', '项目开发参考', true, '2024-06-30'),
    ],
  },
  {
    id: 3,
    name: '高手挑战',
    description: '处理高难度文件，注意时间压力和借阅请求处理',
    fileCount: 12,
    timeLimit: 360,
    targetScore: 90,
    boxes,
    files: [
      f('lv3-1', '公司战略规划', 'confidential', 'top_secret', 'permanent',
        '本文件为公司未来五年战略规划，涉及核心商业机密和重大决策。'),
      f('lv3-2', '技术服务合同', 'contract', 'confidential', '30yrs',
        '本合同涉及外部技术服务采购，含服务内容、费用及SLA条款。'),
      f('lv3-3', '增值税专用发票#005', 'invoice', 'open', '10yrs',
        '发票编号：INV-2024-005。开票日期：2024-05-12。金额：¥88,000。'),
      f('lv3-4', '产品发布会纪要', 'meeting', 'secret', '10yrs',
        '新产品发布会策划会议纪要，含发布流程、媒体安排及预算。'),
      f('lv3-5', '研发项目可行性报告', 'project', 'confidential', '30yrs',
        '新产品研发可行性分析，含技术评估、市场预测及投资回报分析。'),
      f('lv3-6', '员工保密承诺书', 'confidential', 'secret', 'permanent',
        '本承诺书要求员工对公司商业秘密、技术秘密承担保密义务。'),
      f('lv3-7', '设备维修合同', 'contract', 'secret', '30yrs',
        '本合同涉及核心生产设备维修保养，含维修范围、费用及质保期。'),
      f('lv3-8', '办公用品发票#006', 'invoice', 'open', '5yrs',
        '发票编号：INV-2024-006。开票日期：2024-06-01。金额：¥6,800。'),
      f('lv3-9', '战略研讨会纪要', 'meeting', 'confidential', 'permanent',
        '公司战略发展研讨会纪要，涉及未来发展方向及重大决策。'),
      f('lv3-10', '市场调研项目报告', 'project', 'secret', '10yrs',
        '本报告包含市场调研数据、竞争对手分析及市场机会评估。'),
      f('lv3-11', '财务数据保密文件', 'confidential', 'top_secret', 'permanent',
        '本文件包含公司核心财务数据，仅限财务总监及授权人员查阅。'),
      f('lv3-12', '合作框架协议', 'contract', 'confidential', 'permanent',
        '本协议为公司与战略合作伙伴签署的框架性合作协议，涉及多方面合作内容。'),
    ],
    borrowRequests: [
      br('br-2', 'lv3-1', '李总监', '战略部', '战略制定参考', true, '2024-07-15'),
      br('br-3', 'lv3-11', '王会计', '财务部', '月度报表编制', false, '2024-06-30'),
    ],
  },
];

export function getLevel(id: number): Level | undefined {
  return levels.find(l => l.id === id);
}