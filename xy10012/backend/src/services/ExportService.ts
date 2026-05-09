import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Task, TaskStatus, TaskPriority, Customer, AuditLog } from '@prisma/client';
import { prisma } from '../config/database';
import { auditService } from './AuditService';
import { EntityType, AuditAction } from '@prisma/client';
import { RequestContext } from '../utils/logger';
import { Readable } from 'stream';

type ExportFormat = 'excel' | 'markdown' | 'pdf';

export interface ExportFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  assigneeId?: string;
  startDate?: Date;
  endDate?: Date;
}

export class ExportService {
  async exportTasks(
    format: ExportFormat,
    filters: ExportFilters,
    context: RequestContext
  ): Promise<Buffer> {
    if (!context.userId) {
      throw new Error('User ID is required');
    }

    const tasks = await this.getTasksForExport(filters);

    await auditService.record(
      {
        entityType: EntityType.TASK,
        entityId: 'bulk-export',
        action: AuditAction.EXPORT,
        newState: {
          format,
          filters,
          count: tasks.length,
        },
      },
      context
    );

    switch (format) {
      case 'excel':
        return this.exportToExcel(tasks);
      case 'markdown':
        return Buffer.from(this.exportToMarkdown(tasks), 'utf-8');
      case 'pdf':
        return this.exportToPDF(tasks);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  async exportSingleTask(
    taskId: string,
    format: ExportFormat,
    context: RequestContext
  ): Promise<Buffer> {
    if (!context.userId) {
      throw new Error('User ID is required');
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId, deletedAt: null },
      include: {
        customer: true,
        creator: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        notes: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    const history = await auditService.getEntityHistory(
      EntityType.TASK,
      taskId,
      100,
      0
    );

    await auditService.record(
      {
        entityType: EntityType.TASK,
        entityId: taskId,
        action: AuditAction.EXPORT,
        newState: { format },
      },
      context
    );

    switch (format) {
      case 'excel':
        return this.exportSingleTaskToExcel(task, history.logs);
      case 'markdown':
        return Buffer.from(this.exportSingleTaskToMarkdown(task, history.logs), 'utf-8');
      case 'pdf':
        return this.exportSingleTaskToPDF(task, history.logs);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private async getTasksForExport(filters: ExportFilters) {
    const where: any = { deletedAt: null };

    if (filters.status?.length) {
      where.status = { in: filters.status };
    }

    if (filters.priority?.length) {
      where.priority = { in: filters.priority };
    }

    if (filters.assigneeId) {
      where.assigneeId = filters.assigneeId;
    }

    if (filters.startDate && filters.endDate) {
      where.createdAt = {
        gte: filters.startDate,
        lte: filters.endDate,
      };
    }

    return prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        creator: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });
  }

  private async exportToExcel(
    tasks: (Task & {
      customer: Customer | null;
      creator: { id: string; name: string; email: string } | null;
      assignee: { id: string; name: string; email: string } | null;
    })[]
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('客服跟进任务', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = [
      { header: '任务ID', key: 'id', width: 36 },
      { header: '标题', key: 'title', width: 40 },
      { header: '状态', key: 'status', width: 12 },
      { header: '优先级', key: 'priority', width: 10 },
      { header: '客户名称', key: 'customerName', width: 20 },
      { header: '订单号', key: 'orderNumber', width: 25 },
      { header: '快递单号', key: 'trackingNumber', width: 25 },
      { header: '退款金额', key: 'refundAmount', width: 12 },
      { header: '负责人', key: 'assigneeName', width: 15 },
      { header: '创建人', key: 'creatorName', width: 15 },
      { header: '创建时间', key: 'createdAt', width: 20 },
      { header: '截止日期', key: 'dueDate', width: 20 },
    ];

    sheet.getRow(1).font = { bold: true };

    for (const task of tasks) {
      sheet.addRow({
        id: task.id,
        title: task.title,
        status: this.translateStatus(task.status),
        priority: this.translatePriority(task.priority),
        customerName: task.customer?.name || '-',
        orderNumber: task.orderNumber || '-',
        trackingNumber: task.trackingNumber || '-',
        refundAmount: task.refundAmount ? `¥${task.refundAmount}` : '-',
        assigneeName: task.assignee?.name || '未分配',
        creatorName: task.creator?.name || '-',
        createdAt: this.formatDate(task.createdAt),
        dueDate: task.dueDate ? this.formatDate(task.dueDate) : '-',
      });
    }

    const summarySheet = workbook.addWorksheet('统计信息');
    const statusCounts = this.countByStatus(tasks);
    const priorityCounts = this.countByPriority(tasks);

    summarySheet.addRow(['统计信息']).font = { bold: true, size: 14 };
    summarySheet.addRow([]);

    summarySheet.addRow(['按状态统计']).font = { bold: true };
    summarySheet.addRow(['状态', '数量']);
    for (const [status, count] of Object.entries(statusCounts)) {
      summarySheet.addRow([this.translateStatus(status as TaskStatus), count]);
    }

    summarySheet.addRow([]);
    summarySheet.addRow(['按优先级统计']).font = { bold: true };
    summarySheet.addRow(['优先级', '数量']);
    for (const [priority, count] of Object.entries(priorityCounts)) {
      summarySheet.addRow([this.translatePriority(priority as TaskPriority), count]);
    }

    summarySheet.addRow([]);
    summarySheet.addRow(['总计', tasks.length]);

    return workbook.xlsx.writeBuffer() as Promise<Buffer>;
  }

  private async exportSingleTaskToExcel(
    task: any,
    history: AuditLog[]
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const detailSheet = workbook.addWorksheet('任务详情');
    const historySheet = workbook.addWorksheet('操作历史');

    detailSheet.columns = [
      { header: '字段', key: 'field', width: 20 },
      { header: '值', key: 'value', width: 60 },
    ];

    const detailRows = [
      { field: '任务ID', value: task.id },
      { field: '标题', value: task.title },
      { field: '描述', value: task.description || '-' },
      { field: '状态', value: this.translateStatus(task.status) },
      { field: '优先级', value: this.translatePriority(task.priority) },
      { field: '客户名称', value: task.customer?.name || '-' },
      { field: '客户电话', value: task.customer?.phone || '-' },
      { field: '订单号', value: task.orderNumber || '-' },
      { field: '快递单号', value: task.trackingNumber || '-' },
      { field: '退款金额', value: task.refundAmount ? `¥${task.refundAmount}` : '-' },
      { field: '负责人', value: task.assignee?.name || '未分配' },
      { field: '创建人', value: task.creator?.name || '-' },
      { field: '创建时间', value: this.formatDate(task.createdAt) },
      { field: '截止日期', value: task.dueDate ? this.formatDate(task.dueDate) : '-' },
    ];

    detailSheet.addRows(detailRows);
    detailSheet.getRow(1).font = { bold: true };

    historySheet.columns = [
      { header: '时间', key: 'time', width: 22 },
      { header: '操作人', key: 'user', width: 15 },
      { header: '操作类型', key: 'action', width: 12 },
      { header: '说明', key: 'reason', width: 40 },
    ];

    historySheet.getRow(1).font = { bold: true };

    for (const log of history) {
      historySheet.addRow({
        time: this.formatDate(log.timestamp),
        user: (log.user as any)?.name || '-',
        action: this.translateAction(log.action),
        reason: log.reason || '-',
      });
    }

    return workbook.xlsx.writeBuffer() as Promise<Buffer>;
  }

  private exportToMarkdown(
    tasks: (Task & {
      customer: Customer | null;
      creator: { id: string; name: string; email: string } | null;
      assignee: { id: string; name: string; email: string } | null;
    })[]
  ): string {
    const statusCounts = this.countByStatus(tasks);
    const priorityCounts = this.countByPriority(tasks);

    let markdown = `# 客服跟进任务报告\n\n`;
    markdown += `**导出时间**: ${this.formatDate(new Date())}\n\n`;
    markdown += `**总计**: ${tasks.length} 条任务\n\n`;

    markdown += `## 统计摘要\n\n`;
    markdown += `### 按状态\n\n`;
    markdown += `| 状态 | 数量 |\n|------|------|\n`;
    for (const [status, count] of Object.entries(statusCounts)) {
      markdown += `| ${this.translateStatus(status as TaskStatus)} | ${count} |\n`;
    }

    markdown += `\n### 按优先级\n\n`;
    markdown += `| 优先级 | 数量 |\n|--------|------|\n`;
    for (const [priority, count] of Object.entries(priorityCounts)) {
      markdown += `| ${this.translatePriority(priority as TaskPriority)} | ${count} |\n`;
    }

    markdown += `\n## 任务列表\n\n`;
    markdown += `| 标题 | 状态 | 优先级 | 客户 | 负责人 | 创建时间 |\n`;
    markdown += `|------|------|--------|------|--------|----------|\n`;

    for (const task of tasks) {
      markdown += `| ${task.title} | ${this.translateStatus(task.status)} | ${this.translatePriority(task.priority)} | ${task.customer?.name || '-'} | ${task.assignee?.name || '未分配'} | ${this.formatDate(task.createdAt)} |\n`;
    }

    return markdown;
  }

  private exportSingleTaskToMarkdown(task: any, history: AuditLog[]): string {
    let markdown = `# 任务详情报告\n\n`;
    markdown += `**任务ID**: ${task.id}\n\n`;
    markdown += `**导出时间**: ${this.formatDate(new Date())}\n\n`;

    markdown += `## 基本信息\n\n`;
    markdown += `| 字段 | 值 |\n|------|-----|\n`;
    markdown += `| 标题 | ${task.title} |\n`;
    markdown += `| 描述 | ${task.description || '-'} |\n`;
    markdown += `| 状态 | ${this.translateStatus(task.status)} |\n`;
    markdown += `| 优先级 | ${this.translatePriority(task.priority)} |\n`;
    markdown += `| 客户名称 | ${task.customer?.name || '-'} |\n`;
    markdown += `| 订单号 | ${task.orderNumber || '-'} |\n`;
    markdown += `| 快递单号 | ${task.trackingNumber || '-'} |\n`;
    markdown += `| 退款金额 | ${task.refundAmount ? `¥${task.refundAmount}` : '-'} |\n`;
    markdown += `| 负责人 | ${task.assignee?.name || '未分配'} |\n`;
    markdown += `| 创建人 | ${task.creator?.name || '-'} |\n`;
    markdown += `| 创建时间 | ${this.formatDate(task.createdAt)} |\n`;
    markdown += `| 截止日期 | ${task.dueDate ? this.formatDate(task.dueDate) : '-'} |\n`;

    if (task.notes?.length) {
      markdown += `\n## 备注\n\n`;
      for (const note of task.notes) {
        markdown += `### ${(note.user as any)?.name || '-'} (${this.formatDate(note.createdAt)})\n\n`;
        markdown += `${note.content}\n\n`;
      }
    }

    if (history.length) {
      markdown += `\n## 操作历史\n\n`;
      markdown += `| 时间 | 操作人 | 操作类型 | 说明 |\n`;
      markdown += `|------|--------|----------|------|\n`;
      for (const log of history) {
        markdown += `| ${this.formatDate(log.timestamp)} | ${(log.user as any)?.name || '-'} | ${this.translateAction(log.action)} | ${log.reason || '-'} |\n`;
      }
    }

    return markdown;
  }

  private async exportToPDF(
    tasks: (Task & {
      customer: Customer | null;
      creator: { id: string; name: string; email: string } | null;
      assignee: { id: string; name: string; email: string } | null;
    })[]
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 50,
      });

      const buffers: Buffer[] = [];
      doc.on('data', (buf) => buffers.push(buf));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      doc.fontSize(20).text('客服跟进任务报告', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`导出时间: ${this.formatDate(new Date())}`);
      doc.text(`总计: ${tasks.length} 条任务`);
      doc.moveDown();

      const statusCounts = this.countByStatus(tasks);
      doc.fontSize(14).text('按状态统计');
      doc.fontSize(10);
      for (const [status, count] of Object.entries(statusCounts)) {
        doc.text(`${this.translateStatus(status as TaskStatus)}: ${count}`);
      }

      doc.moveDown();

      const tableTop = doc.y;
      const colWidths = [200, 80, 60, 100, 80, 120];
      const headers = ['标题', '状态', '优先级', '客户', '负责人', '创建时间'];

      doc.font('Helvetica-Bold');
      let x = 50;
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], x, tableTop, { width: colWidths[i] });
        x += colWidths[i];
      }

      doc.moveDown();
      doc.font('Helvetica');

      let y = tableTop + 20;
      for (const task of tasks) {
        x = 50;
        const values = [
          task.title,
          this.translateStatus(task.status),
          this.translatePriority(task.priority),
          task.customer?.name || '-',
          task.assignee?.name || '未分配',
          this.formatDate(task.createdAt),
        ];

        for (let i = 0; i < values.length; i++) {
          doc.text(values[i], x, y, { width: colWidths[i] });
          x += colWidths[i];
        }
        y += 20;

        if (y > 550) {
          doc.addPage();
          y = 50;
        }
      }

      doc.end();
    });
  }

  private async exportSingleTaskToPDF(task: any, history: AuditLog[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
      });

      const buffers: Buffer[] = [];
      doc.on('data', (buf) => buffers.push(buf));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      doc.fontSize(20).text('任务详情报告', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`任务ID: ${task.id}`);
      doc.text(`导出时间: ${this.formatDate(new Date())}`);
      doc.moveDown();

      doc.fontSize(14).text('基本信息');
      doc.moveDown(0.5);

      const info = [
        ['标题', task.title],
        ['描述', task.description || '-'],
        ['状态', this.translateStatus(task.status)],
        ['优先级', this.translatePriority(task.priority)],
        ['客户名称', task.customer?.name || '-'],
        ['订单号', task.orderNumber || '-'],
        ['快递单号', task.trackingNumber || '-'],
        ['退款金额', task.refundAmount ? `¥${task.refundAmount}` : '-'],
        ['负责人', task.assignee?.name || '未分配'],
        ['创建人', task.creator?.name || '-'],
        ['创建时间', this.formatDate(task.createdAt)],
        ['截止日期', task.dueDate ? this.formatDate(task.dueDate) : '-'],
      ];

      doc.fontSize(10);
      for (const [label, value] of info) {
        doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
        doc.font('Helvetica').text(value);
      }

      doc.end();
    });
  }

  private translateStatus(status: TaskStatus): string {
    const map: Record<TaskStatus, string> = {
      [TaskStatus.PENDING]: '待处理',
      [TaskStatus.IN_PROGRESS]: '处理中',
      [TaskStatus.COMPLETED]: '已完成',
      [TaskStatus.CANCELLED]: '已取消',
      [TaskStatus.REOPENED]: '重新开启',
    };
    return map[status] || status;
  }

  private translatePriority(priority: TaskPriority): string {
    const map: Record<TaskPriority, string> = {
      [TaskPriority.LOW]: '低',
      [TaskPriority.MEDIUM]: '中',
      [TaskPriority.HIGH]: '高',
      [TaskPriority.URGENT]: '紧急',
    };
    return map[priority] || priority;
  }

  private translateAction(action: string): string {
    const map: Record<string, string> = {
      CREATE: '创建',
      UPDATE: '更新',
      DELETE: '删除',
      ROLLBACK: '回滚',
      LOCK: '锁定',
      UNLOCK: '解锁',
      EXPORT: '导出',
    };
    return map[action] || action;
  }

  private formatDate(date: Date): string {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  private countByStatus(tasks: { status: TaskStatus }[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      counts[task.status] = (counts[task.status] || 0) + 1;
    }
    return counts;
  }

  private countByPriority(tasks: { priority: TaskPriority }[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      counts[task.priority] = (counts[task.priority] || 0) + 1;
    }
    return counts;
  }
}

export const exportService = new ExportService();