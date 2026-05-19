import { TranscriptionRecord } from '../src/models/types';

export const sampleTranscriptions: Omit<TranscriptionRecord, 'id'>[] = [
  {
    externalId: 'CALL_001',
    customerName: '张三',
    customerPhone: '13800138001',
    customerIdCard: '110101199001011234',
    agentName: '李静',
    agentId: 'AG001',
    callTime: '2024-01-15T09:30:00.000Z',
    duration: 185,
    transcription: '客户来电反映订单延迟配送，非常不满意。坐席听完客户抱怨后，表示会尽快处理，但没有道歉，也没有提及退款或补偿方案。客户最后说要投诉。',
    sensitiveFields: ['customerName', 'customerPhone', 'customerIdCard']
  },
  {
    externalId: 'CALL_002',
    customerName: '李四',
    customerPhone: '13900139002',
    customerIdCard: '310101198505055678',
    agentName: '王强',
    agentId: 'AG002',
    callTime: '2024-01-15T10:15:00.000Z',
    duration: 240,
    transcription: '您好，非常抱歉给您带来了不便。关于您的退货申请，我们已经受理，会在3个工作日内将款项退还到您的支付账户。请您留意查收。客户表示理解。',
    sensitiveFields: ['customerName', 'customerPhone', 'customerIdCard']
  },
  {
    externalId: 'CALL_003',
    customerName: '王五',
    customerPhone: '13700137003',
    customerIdCard: '440101199208089012',
    agentName: '赵敏',
    agentId: 'AG003',
    callTime: '2024-01-15T11:00:00.000Z',
    duration: 310,
    transcription: '客户对于产品质量问题非常生气，说你们这是什么垃圾产品，我要举报你们。坐席表示很抱歉，会安排换货处理，但没有明确说明退款相关事宜。',
    sensitiveFields: ['customerName', 'customerPhone', 'customerIdCard']
  },
  {
    externalId: 'CALL_004',
    customerName: '赵六',
    customerPhone: '13600136004',
    customerIdCard: '510101198812123456',
    agentName: '孙磊',
    agentId: 'AG004',
    callTime: '2024-01-15T14:20:00.000Z',
    duration: 150,
    transcription: '对不起，让您有不好的体验了。我们可以为您办理全额退款，退款将在1-2个工作日到账。您看这样可以吗？客户同意了这个方案。',
    sensitiveFields: ['customerName', 'customerPhone', 'customerIdCard']
  },
  {
    externalId: 'CALL_005',
    customerName: '钱七',
    customerPhone: '13500135005',
    customerIdCard: '330101199503037890',
    agentName: '周婷',
    agentId: 'AG005',
    callTime: '2024-01-15T15:45:00.000Z',
    duration: 275,
    transcription: '客户咨询活动规则，坐席耐心解答。客户对回答很满意，表示感谢。整个对话过程顺利，没有问题。',
    sensitiveFields: ['customerName', 'customerPhone', 'customerIdCard']
  }
];
