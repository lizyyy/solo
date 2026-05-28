import type { EventLog, ErrorDetail } from '../types/mission';
import { generateId } from '../utils/time';

export function handleError(
  errorDetail: ErrorDetail,
  currentScore: number,
  timestamp: number
): { event: EventLog; scoreDeduction: number; impact: string } {
  switch (errorDetail.errorType) {
    case 'window_missed':
      return handleWindowMissed(errorDetail, currentScore, timestamp);
    case 'command_timeout':
      return handleCommandTimeout(errorDetail, currentScore, timestamp);
    case 'data_packet_lost':
      return handleDataPacketLost(errorDetail, currentScore, timestamp);
  }
}

function handleWindowMissed(
  detail: ErrorDetail,
  _currentScore: number,
  timestamp: number
): { event: EventLog; scoreDeduction: number; impact: string } {
  const basePenalty = 100;
  const reasonMultipliers: Record<string, number> = {
    wrong_station: 2,
    previous_overrun: 1.5,
    insufficient_slew_time: 1.2,
    prediction_error: 0.8,
  };

  const reason = detail.windowMissed!.reason;
  const deduction = Math.floor(basePenalty * reasonMultipliers[reason]);

  const reasonDescriptions: Record<string, string> = {
    wrong_station: '调度了错误的地面站，该站在此窗口不可见',
    previous_overrun: '前一个任务超时，占用了本窗口开始时间',
    insufficient_slew_time: '未预留足够的天线转向时间',
    prediction_error: '窗口预报存在误差，实际可用时间缩短',
  };

  const reasonTips: Record<string, string> = {
    wrong_station: '调度前请核对每个窗口对应的地面站是否正确',
    previous_overrun: '任务间请预留足够的缓冲时间，避免前序任务超时影响后续窗口',
    insufficient_slew_time: '天线转向需要时间，请在相邻任务间预留至少30秒转向时间',
    prediction_error: '考虑预报误差，不要把任务排满整个窗口，预留10%余量',
  };

  return {
    event: {
      id: generateId(),
      timestamp,
      type: 'window_missed',
      severity: 'error',
      message: `窗口错过：${reasonDescriptions[reason]}`,
      relatedEntityId: detail.windowMissed!.windowId,
      errorDetail: detail,
    },
    scoreDeduction: deduction,
    impact: `该窗口内所有调度任务失败。原因：${reasonTips[reason]}。扣除 ${deduction} 分`,
  };
}

function handleCommandTimeout(
  detail: ErrorDetail,
  _currentScore: number,
  timestamp: number
): { event: EventLog; scoreDeduction: number; impact: string } {
  const cmd = detail.commandTimeout!;
  const basePenalty = cmd.queuePosition <= 1 ? 50 : 30;
  const priorityMultiplier = Math.max(1, 6 - cmd.queuePosition);

  const deduction = Math.floor(basePenalty * priorityMultiplier);

  const reasonDescriptions: Record<string, string> = {
    queue_position: '指令在队列中优先级过低，未能及时发送',
    size_too_large: '指令长度过长，传输时间超过窗口剩余时间',
    retransmission_needed: '信道误码率过高，需要重传导致超时',
    solar_conjunction: '探测器进入日凌区，通信中断',
  };

  const reasonTips: Record<string, string> = {
    queue_position: '高优先级指令请提前排到队列前面，避免窗口结束时才轮到发送',
    size_too_large: '长指令请拆分发送，或安排在更长的窗口中传输',
    retransmission_needed: '检查信道状态，必要时降低传输速率提高可靠性',
    solar_conjunction: '日凌期间通信不可用，请避开此时间段安排关键指令',
  };

  const severity = cmd.queuePosition <= 1 ? 'critical' : 'warning';

  return {
    event: {
      id: generateId(),
      timestamp,
      type: 'command_timeout',
      severity,
      message: `指令超时：${reasonDescriptions[cmd.reason]}（已传输 ${cmd.transmittedPercent}%）`,
      relatedEntityId: cmd.commandId,
      errorDetail: detail,
    },
    scoreDeduction: deduction,
    impact: `指令 ${cmd.commandId} 发送失败。原因：${reasonTips[cmd.reason]}。扣除 ${deduction} 分`,
  };
}

function handleDataPacketLost(
  detail: ErrorDetail,
  _currentScore: number,
  timestamp: number
): { event: EventLog; scoreDeduction: number; impact: string } {
  const pkt = detail.dataPacketLost!;
  const basePenalty = pkt.recoveredPercent < 50 ? 80 : 40;
  const priorityMultiplier = 3;

  const deduction = Math.floor(basePenalty * priorityMultiplier);

  const reasonDescriptions: Record<string, string> = {
    bandwidth_exceeded: '数据量超过窗口带宽能力，末尾数据被截断',
    rain_fade: '链路雨衰导致信噪比不足，数据未能正确解调',
    storage_overflow: '探测器存储溢出，新数据覆盖了未下载的旧数据',
    ground_storage_failure: '地面站存储故障，已下载数据未能写入磁盘',
  };

  const reasonTips: Record<string, string> = {
    bandwidth_exceeded: '计算窗口带宽能力，不要安排超过传输能力的数据量',
    rain_fade: '恶劣天气时请降低传输速率，或启用纠错编码',
    storage_overflow: '定期下载数据，避免探测器存储满载',
    ground_storage_failure: '启用地面站存储冗余，重要数据多站点备份',
  };

  return {
    event: {
      id: generateId(),
      timestamp,
      type: 'data_packet_lost',
      severity: 'error',
      message: `数据包丢失：${reasonDescriptions[pkt.reason]}（已恢复 ${pkt.recoveredPercent}%）`,
      relatedEntityId: pkt.packetId,
      errorDetail: detail,
    },
    scoreDeduction: deduction,
    impact: `数据包 ${pkt.packetId} 永久丢失。原因：${reasonTips[pkt.reason]}。扣除 ${deduction} 分`,
  };
}

export function getErrorColor(errorType: ErrorDetail['errorType']): string {
  const colors: Record<ErrorDetail['errorType'], string> = {
    window_missed: '#e74c3c',
    command_timeout: '#f39c12',
    data_packet_lost: '#e67e22',
  };
  return colors[errorType];
}

export function getErrorIcon(errorType: ErrorDetail['errorType']): string {
  const icons: Record<ErrorDetail['errorType'], string> = {
    window_missed: 'clock',
    command_timeout: 'alert-triangle',
    data_packet_lost: 'database',
  };
  return icons[errorType];
}

export function getErrorTitle(errorType: ErrorDetail['errorType']): string {
  const titles: Record<ErrorDetail['errorType'], string> = {
    window_missed: '窗口错过',
    command_timeout: '指令超时',
    data_packet_lost: '数据包丢失',
  };
  return titles[errorType];
}

export function groupErrorsByType(events: EventLog[]): Record<ErrorDetail['errorType'], EventLog[]> {
  const groups: Record<string, EventLog[]> = {
    window_missed: [],
    command_timeout: [],
    data_packet_lost: [],
  };

  events.forEach(event => {
    if (event.errorDetail) {
      groups[event.errorDetail.errorType].push(event);
    }
  });

  return groups;
}

export function getErrorSummary(events: EventLog[]): {
  totalErrors: number;
  byType: Record<ErrorDetail['errorType'], number>;
  criticalErrors: EventLog[];
} {
  const errors = events.filter(e => e.errorDetail);
  const byType = {
    window_missed: errors.filter(e => e.errorDetail?.errorType === 'window_missed').length,
    command_timeout: errors.filter(e => e.errorDetail?.errorType === 'command_timeout').length,
    data_packet_lost: errors.filter(e => e.errorDetail?.errorType === 'data_packet_lost').length,
  };

  const criticalErrors = errors.filter(e => e.severity === 'critical');

  return {
    totalErrors: errors.length,
    byType,
    criticalErrors,
  };
}
