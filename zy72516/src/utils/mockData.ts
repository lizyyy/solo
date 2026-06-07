import { AnnotationRecord, RecordStatus, AbnormalType, ModelOutput } from '../types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

const annotatorMessages = [
  '客户反馈退款未到账，机器人回复说3个工作日内到账，但客户已经等了5天。建议转人工跟进。',
  '引用链接已失效（404），但机器人仍判断通过。需要产品经理确认。',
  '口径错误：标准回复应该是7天无理由退换，但机器人回复的是15天。',
  '需要补录：客户咨询的是XX产品，但机器人回复的是YY产品的信息。',
  '正常案例：客户询问物流，机器人正确回复了物流查询方式。',
  '客户投诉收到破损商品，机器人自动回复了赔偿流程，判断正确。',
  '引用帮助文档链接404，机器人仍标记为问题已解决。请复核。',
  '返工：上次标注有误，需要重新判断。',
  '客户问的是A问题，机器人答的是B问题，完全不相关。',
  '引用链接有效，回复内容准确，通过。'
];

const robotJudgments = ['通过', '驳回', '转人工', '通过', '通过', '通过', '通过', '驳回', '驳回', '通过'];

const referenceUrls = [
  'https://help.example.com/refund',
  'https://help.example.com/expired-doc-404',
  'https://help.example.com/return-policy',
  'https://help.example.com/product-YY',
  'https://help.example.com/logistics',
  'https://help.example.com/damaged',
  'https://help.example.com/old-doc-404',
  'https://help.example.com/rework',
  'https://help.example.com/wrong-topic',
  'https://help.example.com/valid-doc'
];

const urlStatuses = [true, false, true, true, true, true, false, true, true, true];

const modelSnippets = [
  '用户询问退款进度，根据历史对话和知识库，标准处理时间为3个工作日。用户已等待5天，建议转人工核实具体情况。置信度：0.85',
  '检测到用户问题涉及退款政策，匹配知识库条目#1234。引用链接：https://help.example.com/expired-doc-404。判断：通过。置信度：0.72',
  '用户询问退换货政策，知识库显示7天无理由退换。机器人输出中提到15天，与标准口径不符。置信度：0.91',
  '用户询问XX产品参数，系统匹配到YY产品信息。可能存在产品ID映射错误，建议人工确认。置信度：0.65',
  '用户询问物流查询方式，标准回复正确。提供了官网查询入口和客服电话。置信度：0.95',
  '用户投诉商品破损，系统自动触发赔偿流程。回复内容包含退款/补发选项，符合SOP。置信度：0.88',
  '用户问题已通过知识库解决，引用帮助文档说明处理流程。链接有效性未校验，直接标记通过。置信度：0.70',
  '上次标注结果被标记为有误，需要重新进行质量检测。请仔细核对机器人回复与标准口径。',
  '用户问题与机器人回复语义相似度较低（0.32），可能存在答非所问。建议人工审核。置信度：0.55',
  '用户问题与回复完全匹配，引用链接有效，内容准确。置信度：0.97'
];

export function generateMockRecords(count: number = 10): AnnotationRecord[] {
  const records: AnnotationRecord[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const idx = i % annotatorMessages.length;
    const recordId = generateId();

    const modelOutput: ModelOutput = {
      id: generateId(),
      recordId,
      modelName: 'after-sales-v2.1',
      outputSnippet: modelSnippets[idx],
      confidence: 0.55 + Math.random() * 0.45,
      reasoningDetails: {
        matchedRules: ['rule_' + Math.floor(Math.random() * 100)],
        intentCategory: 'refund',
        sentimentScore: 0.3 + Math.random() * 0.7
      }
    };

    let currentStatus = RecordStatus.PENDING;
    let abnormalType = AbnormalType.NONE;

    if (!urlStatuses[idx] && robotJudgments[idx] === '通过') {
      currentStatus = RecordStatus.PM_REVIEW;
      abnormalType = AbnormalType.URL_404_PASSED;
    } else if (annotatorMessages[idx].includes('错口径') || annotatorMessages[idx].includes('口径错误')) {
      currentStatus = RecordStatus.WRONG_CRITERIA;
      abnormalType = AbnormalType.WRONG_CRITERIA;
    } else if (annotatorMessages[idx].includes('补录') || annotatorMessages[idx].includes('返工')) {
      currentStatus = RecordStatus.REWORK;
      abnormalType = AbnormalType.REWORK_NEEDED;
    } else if (i % 3 === 0 && i > 0) {
      currentStatus = RecordStatus.PASSED;
    }

    records.push({
      id: recordId,
      originalLineNumber: i + 1,
      annotatorMessage: annotatorMessages[idx],
      referenceUrl: referenceUrls[idx],
      urlStatus: urlStatuses[idx],
      robotJudgment: robotJudgments[idx],
      currentStatus,
      abnormalType,
      modelOutput,
      judgmentLogs: currentStatus !== RecordStatus.PENDING ? [
        {
          id: generateId(),
          recordId,
          operator: 'system',
          action: '自动检测',
          remark: abnormalType !== AbnormalType.NONE ? '边界规则自动标记' : '初始导入',
          fromStatus: RecordStatus.PENDING,
          toStatus: currentStatus,
          operatedAt: new Date(now.getTime() - Math.random() * 3600000).toISOString()
        }
      ] : [],
      rawData: {
        source: 'mock',
        batchId: 'batch_' + now.getTime(),
        columnMapping: {
          message: '标注员留言',
          url: '引用链接',
          judgment: '机器人判断'
        }
      },
      createdAt: new Date(now.getTime() - Math.random() * 86400000).toISOString(),
      updatedAt: new Date(now.getTime() - Math.random() * 3600000).toISOString(),
      lastOperator: currentStatus !== RecordStatus.PENDING ? 'system' : undefined
    });
  }

  return records;
}

export function generateSampleCsvContent(): string {
  const headers = ['标注员留言', '引用链接', '链接状态', '机器人判断'];
  const rows = [
    ['客户反馈退款未到账，机器人回复说3个工作日内到账，但客户已经等了5天。建议转人工跟进。', 'https://help.example.com/refund', '有效', '通过'],
    ['引用链接已失效（404），但机器人仍判断通过。需要产品经理确认。', 'https://help.example.com/expired-doc-404', '无效', '通过'],
    ['口径错误：标准回复应该是7天无理由退换，但机器人回复的是15天。', 'https://help.example.com/return-policy', '有效', '驳回'],
    ['需要补录：客户咨询的是XX产品，但机器人回复的是YY产品的信息。', 'https://help.example.com/product-YY', '有效', '驳回'],
    ['正常案例：客户询问物流，机器人正确回复了物流查询方式。', 'https://help.example.com/logistics', '有效', '通过']
  ];

  return [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
}
