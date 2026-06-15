import { AnnotationRecord, RecordStatus, AbnormalType, ModelOutput, ContentSnapshot, LogAction, AbnormalTypeLabelMap } from '../types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function takeSnapshot(record: AnnotationRecord): ContentSnapshot {
  return {
    annotatorMessage: record.annotatorMessage,
    referenceUrl: record.referenceUrl,
    urlStatus: record.urlStatus,
    robotJudgment: record.robotJudgment,
    modelOutputSnippet: record.modelOutput?.outputSnippet,
    modelOutputName: record.modelOutput?.modelName,
    modelOutputConfidence: record.modelOutput?.confidence,
    status: record.currentStatus,
    abnormalType: record.abnormalType
  };
}

export function generateMockRecords(count: number): AnnotationRecord[] {
  const mockMessages = [
    '用户反馈退款未到账，需要重新核实',
    '错口径：用户询问会员权益，回复内容不符合最新标准',
    '需要补录：缺少订单编号信息',
    '用户投诉物流太慢，建议加强管理',
    '返工：标注不完整，需要重新处理',
    '用户咨询售后政策，已按标准回复',
    '不符合标准回复：7天无理由退换货政策解释错误',
    '正常处理，用户表示满意',
    '重新标注：分类错误，应归为质量问题',
    '用户反映商品有瑕疵，已建议换货'
  ];

  const mockUrls = [
    'https://example.com/order/123',
    'https://example.com/refund/456',
    'https://example.com/product/789',
    'https://example.com/help/policy',
    'https://example.com/user/feedback'
  ];

  const mockRobotJudgments = [
    '通过：用户诉求合理，同意退款',
    '通过：问题已解决',
    '通过：符合退换货条件',
    '通过：已安抚用户',
    '驳回：不在服务范围内',
    '驳回：需要用户提供更多信息'
  ];

  const mockModels = [
    'GPT-4',
    'Claude-3.5',
    'Qwen-2.5',
    'DeepSeek-V2'
  ];

  const records: AnnotationRecord[] = [];

  for (let i = 0; i < count; i++) {
    const message = mockMessages[i % mockMessages.length];
    const url = mockUrls[i % mockUrls.length];
    const robotJudgment = mockRobotJudgments[i % mockRobotJudgments.length];
    const urlStatus = i % 5 !== 3;
    const hasModelOutput = i % 4 != 0;
    const modelName = mockModels[i % mockModels.length];
    const confidence = 0.7 + Math.random() * 0.3;

    const modelOutputRaw = hasModelOutput ? {
      id: generateId(),
      recordId: "",
      modelName,
      outputSnippet: "根据用户留言分析，该问题属于售后问题范畴。建议按照7天无理由退换货政策处理，同时核实用户订单信息。",
      confidence,
      reasoningDetails: { category: "after_sales", urgency: "medium" },
      filledAt: new Date().toISOString()
    } : undefined;

    const record: AnnotationRecord = {
      id: generateId(),
      originalLineNumber: i + 1,
      annotatorMessage: message,
      referenceUrl: url,
      urlStatus,
      robotJudgment,
      currentStatus: RecordStatus.PENDING,
      abnormalType: AbnormalType.NONE,
      modelOutput: modelOutputRaw,
      modelOutputMissing: hasModelOutput == false,
      judgmentLogs: [],
      rawData: { lineNumber: i + 1, message, url, robotJudgment },
      originalSnapshot: {} as ContentSnapshot,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (record.modelOutput) {
      record.modelOutput.recordId = record.id;
    }
    record.originalSnapshot = takeSnapshot(record);
    records.push(record);
  }

  return records;
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function generateSampleCsvContent(): string {
  const headers = ['序号', '标注员留言', '引用链接', '机器人判断', '模型输出', '模型名称', '置信度'];

  const rows = [
    ['1', '用户反馈退款未到账，需要重新核实', 'https://example.com/order/123', '通过：用户诉求合理，同意退款', '根据用户留言分析，该问题属于售后问题范畴。建议按照7天无理由退换货政策处理，同时核实用户订单信息。', 'GPT-4', '0.92'],
    ['2', '错口径：用户询问会员权益，回复内容不符合最新标准', 'https://example.com/refund/456', '驳回：不在服务范围内', '', '', ''],
    ['3', '需要补录：缺少订单编号信息', 'https://example.com/product/789', '通过：问题已解决', '该问题属于订单信息补录范畴，建议联系用户获取完整订单编号后再进行处理。', 'Claude-3.5', '0.87'],
    ['4', '用户投诉物流太慢，建议加强管理', 'https://example.com/help/policy', '通过：已安抚用户', '', '', ''],
    ['5', '返工：标注不完整，需要重新处理', 'https://example.com/user/feedback', '驳回：需要用户提供更多信息', '经分析，该标注存在信息不完整问题，需重新标注并补充相关细节。', 'Qwen-2.5', '0.78']
  ];

  const lines = [
    headers.map(escapeCsv).join(','),
    ...rows.map(row => row.map(escapeCsv).join(','))
  ];

  return lines.join('\n');
}
