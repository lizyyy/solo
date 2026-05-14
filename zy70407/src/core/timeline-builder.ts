import { v4 as uuidv4 } from 'uuid';
import {
  ApprovalLog,
  ApprovalTimeline,
  TimelineEvent,
  LogEventType,
  LogSource
} from '../types';

export class TimelineBuilder {
  private logs: ApprovalLog[] = [];

  addLogs(logs: ApprovalLog[]): void {
    this.logs.push(...logs);
  }

  clear(): void {
    this.logs = [];
  }

  buildTimeline(batchId: string, ticketId: string): ApprovalTimeline {
    const batchLogs = this.logs.filter(log => log.batchId === batchId);
    
    if (batchLogs.length === 0) {
      return {
        batchId,
        ticketId,
        events: [],
        startTime: new Date()
      };
    }

    const sortedLogs = batchLogs.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const events: TimelineEvent[] = sortedLogs.map(log => this.logToEvent(log));
    const startTime = new Date(sortedLogs[0].timestamp);
    const endTime = new Date(sortedLogs[sortedLogs.length - 1].timestamp);
    const totalDurationMs = endTime.getTime() - startTime.getTime();

    return {
      batchId,
      ticketId,
      events,
      startTime,
      endTime,
      totalDurationMs
    };
  }

  private logToEvent(log: ApprovalLog): TimelineEvent {
    return {
      id: uuidv4(),
      timestamp: new Date(log.timestamp),
      eventType: log.eventType,
      source: log.source,
      actor: {
        id: log.operatorId,
        name: log.operatorName,
        role: log.operatorRole
      },
      action: this.getActionDescription(log),
      details: this.getEventDetails(log),
      comment: log.comment,
      approvalComment: log.approvalComment,
      rawLog: log
    };
  }

  private getActionDescription(log: ApprovalLog): string {
    const actions: Record<LogEventType, string> = {
      [LogEventType.SUBMIT]: '提交申请',
      [LogEventType.ASSIGN]: '分配审批人',
      [LogEventType.APPROVE]: '审批通过',
      [LogEventType.REJECT]: '审批拒绝',
      [LogEventType.REASSIGN]: '转派审批',
      [LogEventType.ESCALATE]: '升级处理',
      [LogEventType.COMMENT]: '添加备注',
      [LogEventType.REMIND]: '发送提醒',
      [LogEventType.TIMEOUT]: '超时未处理',
      [LogEventType.WITHDRAW]: '撤回申请',
      [LogEventType.UPDATE]: '更新申请',
      [LogEventType.COMPLETE]: '流程完成'
    };
    return actions[log.eventType] || log.eventType;
  }

  private getEventDetails(log: ApprovalLog): string {
    switch (log.eventType) {
      case LogEventType.ASSIGN:
      case LogEventType.REASSIGN:
        return `分配给: ${log.targetApproverName || log.targetApproverId}`;
      case LogEventType.APPROVE:
        return log.approvalComment ? `审批意见: ${log.approvalComment}` : '无审批意见';
      case LogEventType.REJECT:
        return `拒绝原因: ${log.comment || '未说明'}`;
      case LogEventType.ESCALATE:
        return `升级原因: ${log.comment || '未说明'}`;
      default:
        return log.comment || '';
    }
  }

  findMissingApprovalComments(timeline: ApprovalTimeline): string[] {
    const missingCommentEvents = timeline.events.filter(
      event => event.eventType === LogEventType.APPROVE && !event.approvalComment
    );
    return missingCommentEvents.map(event => event.id);
  }

  getApprovalSequence(timeline: ApprovalTimeline): TimelineEvent[] {
    return timeline.events.filter(event => 
      [LogEventType.APPROVE, LogEventType.REJECT, LogEventType.ASSIGN, LogEventType.REASSIGN].includes(event.eventType)
    );
  }

  mergeTimelines(timelines: ApprovalTimeline[]): ApprovalTimeline | null {
    if (timelines.length === 0) return null;
    
    const allEvents = timelines.flatMap(t => t.events);
    const sortedEvents = allEvents.sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    return {
      batchId: timelines[0].batchId,
      ticketId: timelines[0].ticketId,
      events: sortedEvents,
      startTime: sortedEvents[0].timestamp,
      endTime: sortedEvents[sortedEvents.length - 1].timestamp,
      totalDurationMs: sortedEvents[sortedEvents.length - 1].timestamp.getTime() - sortedEvents[0].timestamp.getTime()
    };
  }
}
