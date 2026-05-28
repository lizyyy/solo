import type { MarginCall } from '../types';

export interface DeduplicationResult {
  shouldSend: boolean;
  isDuplicate: boolean;
  reason?: string;
  lastCallTime?: string;
}

export function checkMarginCallDuplicate(
  pledgeId: string,
  existingCalls: MarginCall[],
  now: Date = new Date()
): DeduplicationResult {
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const recentCalls = existingCalls
    .filter((c) => c.pledgeId === pledgeId)
    .filter((c) => new Date(c.sendTime) > twentyFourHoursAgo)
    .sort((a, b) => new Date(b.sendTime).getTime() - new Date(a.sendTime).getTime());

  if (recentCalls.length > 0) {
    const lastCall = recentCalls[0];
    return {
      shouldSend: false,
      isDuplicate: true,
      reason: `24小时内已发送${recentCalls.length}次通知`,
      lastCallTime: lastCall.sendTime,
    };
  }

  return {
    shouldSend: true,
    isDuplicate: false,
  };
}

export function canResendAfterStatusChange(
  pledgeId: string,
  existingCalls: MarginCall[],
  lastStatusChangeTime: string
): DeduplicationResult {
  const statusChangeDate = new Date(lastStatusChangeTime);
  const callsAfterStatusChange = existingCalls
    .filter((c) => c.pledgeId === pledgeId)
    .filter((c) => new Date(c.sendTime) > statusChangeDate);

  if (callsAfterStatusChange.length > 0) {
    const lastCall = callsAfterStatusChange[0];
    return {
      shouldSend: false,
      isDuplicate: true,
      reason: `状态变更后已发送${callsAfterStatusChange.length}次通知`,
      lastCallTime: lastCall.sendTime,
    };
  }

  return {
    shouldSend: true,
    isDuplicate: false,
  };
}

export function generateMarginCallContent(
  customerName: string,
  stockName: string,
  stockCode: string,
  pledgeRatio: number,
  warningLine: number
): string {
  const buffer = (warningLine - pledgeRatio).toFixed(2);
  const isAbove = pledgeRatio >= warningLine;

  if (isAbove) {
    return `【风险预警】尊敬的${customerName}客户，您质押的${stockName}(${stockCode})当前质押率为${pledgeRatio.toFixed(2)}%，已超过警戒线${warningLine.toFixed(2)}%，超出${Math.abs(parseFloat(buffer))}%。请您及时关注并准备补仓。`;
  }

  return `【风险提示】尊敬的${customerName}客户，您质押的${stockName}(${stockCode})当前质押率为${pledgeRatio.toFixed(2)}%，距离警戒线${warningLine.toFixed(2)}%尚有${buffer}%缓冲空间。请您持续关注。`;
}
