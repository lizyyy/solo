import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import dayjs from 'dayjs';
import { config } from '../config';
import logger from '../utils/logger';
import { Ticket, TicketStatus, TicketPriority } from '../models/Ticket';
import { FollowUp, FollowUpStatus, FollowUpType } from '../models/FollowUp';
import { Event, EventType } from '../models/Event';
import { Op } from 'sequelize';

export type ExportFormat = 'excel' | 'markdown' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  type: 'tickets' | 'followups' | 'events' | 'comprehensive';
  filters?: {
    status?: string[];
    priority?: string[];
    assigneeId?: string;
    startDate?: Date;
    endDate?: Date;
    ticketId?: string;
  };
  includeDetails?: boolean;
  includeEvents?: boolean;
}

export interface ExportResult {
  id: string;
  filename: string;
  filePath: string;
  format: ExportFormat;
  size: number;
  createdAt: Date;
}

class ExportService {
  private readonly storagePath: string;

  constructor() {
    this.storagePath = config.storage.path;
    this.ensureStorageDirectory();
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.access(this.storagePath);
    } catch {
      await fs.mkdir(this.storagePath, { recursive: true });
    }
  }

  async createExport(options: ExportOptions): Promise<ExportResult> {
    const exportId = uuidv4();
    const timestamp = dayjs().format('YYYYMMDD_HHmmss');
    const filename = this.generateFilename(options.type, options.format, timestamp);
    const filePath = path.join(this.storagePath, filename);

    logger.info(`Starting export: ${exportId}, type: ${options.type}, format: ${options.format}`);

    try {
      switch (options.format) {
        case 'excel':
          await this.exportToExcel(filePath, options);
          break;
        case 'markdown':
          await this.exportToMarkdown(filePath, options);
          break;
        case 'pdf':
          await this.exportToPDF(filePath, options);
          break;
        default:
          throw new Error(`Unsupported format: ${options.format}`);
      }

      const stats = await fs.stat(filePath);

      const result: ExportResult = {
        id: exportId,
        filename,
        filePath,
        format: options.format,
        size: stats.size,
        createdAt: new Date(),
      };

      logger.info(`Export completed: ${exportId}, size: ${stats.size} bytes`);

      return result;
    } catch (error) {
      logger.error('Export failed:', error);
      try {
        await fs.unlink(filePath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  private generateFilename(type: string, format: ExportFormat, timestamp: string): string {
    const extensions: Record<ExportFormat, string> = {
      excel: 'xlsx',
      markdown: 'md',
      pdf: 'pdf',
    };
    return `export_${type}_${timestamp}.${extensions[format]}`;
  }

  private async exportToExcel(filePath: string, options: ExportOptions): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Customer Follow-up System';
    workbook.created = new Date();

    if (options.type === 'tickets' || options.type === 'comprehensive') {
      await this.addTicketsSheet(workbook, options);
    }

    if (options.type === 'followups' || options.type === 'comprehensive') {
      await this.addFollowUpsSheet(workbook, options);
    }

    if ((options.type === 'events' || options.type === 'comprehensive') && options.includeEvents) {
      await this.addEventsSheet(workbook, options);
    }

    await workbook.xlsx.writeFile(filePath);
  }

  private async addTicketsSheet(workbook: ExcelJS.Workbook, options: ExportOptions): Promise<void> {
    const tickets = await this.fetchTickets(options);
    
    const sheet = workbook.addWorksheet('工单列表', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = [
      { header: '工单ID', key: 'id', width: 36 },
      { header: '标题', key: 'title', width: 40 },
      { header: '客户名称', key: 'customerName', width: 20 },
      { header: '客户电话', key: 'customerPhone', width: 15 },
      { header: '状态', key: 'status', width: 15 },
      { header: '优先级', key: 'priority', width: 10 },
      { header: '分类', key: 'category', width: 15 },
      { header: '创建时间', key: 'createdAt', width: 20 },
      { header: '更新时间', key: 'updatedAt', width: 20 },
      { header: '版本', key: 'version', width: 8 },
    ];

    const statusMap: Record<string, string> = {
      [TicketStatus.OPEN]: '待处理',
      [TicketStatus.IN_PROGRESS]: '处理中',
      [TicketStatus.PENDING_FOLLOWUP]: '待跟进',
      [TicketStatus.COMPLETED]: '已完成',
      [TicketStatus.CLOSED]: '已关闭',
      [TicketStatus.CANCELLED]: '已取消',
    };

    const priorityMap: Record<string, string> = {
      [TicketPriority.LOW]: '低',
      [TicketPriority.NORMAL]: '普通',
      [TicketPriority.HIGH]: '高',
      [TicketPriority.URGENT]: '紧急',
    };

    tickets.forEach((ticket) => {
      sheet.addRow({
        id: ticket.id,
        title: ticket.title,
        customerName: ticket.customerName,
        customerPhone: ticket.customerPhone,
        status: statusMap[ticket.status] || ticket.status,
        priority: priorityMap[ticket.priority] || ticket.priority,
        category: ticket.category,
        createdAt: dayjs(ticket.createdAt).format('YYYY-MM-DD HH:mm:ss'),
        updatedAt: dayjs(ticket.updatedAt).format('YYYY-MM-DD HH:mm:ss'),
        version: ticket.version,
      });
    });

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  }

  private async addFollowUpsSheet(workbook: ExcelJS.Workbook, options: ExportOptions): Promise<void> {
    const followUps = await this.fetchFollowUps(options);
    
    const sheet = workbook.addWorksheet('跟进记录', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = [
      { header: '跟进ID', key: 'id', width: 36 },
      { header: '工单ID', key: 'ticketId', width: 36 },
      { header: '内容', key: 'content', width: 50 },
      { header: '类型', key: 'followUpType', width: 12 },
      { header: '承诺动作', key: 'promisedAction', width: 30 },
      { header: '截止时间', key: 'promisedDeadline', width: 20 },
      { header: '状态', key: 'status', width: 12 },
      { header: '创建人', key: 'createdBy', width: 36 },
      { header: '创建时间', key: 'createdAt', width: 20 },
    ];

    const typeMap: Record<string, string> = {
      [FollowUpType.CALL]: '电话',
      [FollowUpType.MESSAGE]: '消息',
      [FollowUpType.EMAIL]: '邮件',
      [FollowUpType.COMPENSATION]: '补偿',
      [FollowUpType.VISIT]: '上门',
      [FollowUpType.OTHER]: '其他',
    };

    const statusMap: Record<string, string> = {
      [FollowUpStatus.PENDING]: '待处理',
      [FollowUpStatus.IN_PROGRESS]: '进行中',
      [FollowUpStatus.COMPLETED]: '已完成',
      [FollowUpStatus.OVERDUE]: '已逾期',
      [FollowUpStatus.CANCELLED]: '已取消',
    };

    followUps.forEach((fu) => {
      sheet.addRow({
        id: fu.id,
        ticketId: fu.ticketId,
        content: fu.content,
        followUpType: typeMap[fu.followUpType] || fu.followUpType,
        promisedAction: fu.promisedAction,
        promisedDeadline: fu.promisedDeadline 
          ? dayjs(fu.promisedDeadline).format('YYYY-MM-DD HH:mm:ss') 
          : '',
        status: statusMap[fu.status] || fu.status,
        createdBy: fu.createdBy,
        createdAt: dayjs(fu.createdAt).format('YYYY-MM-DD HH:mm:ss'),
      });
    });

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  }

  private async addEventsSheet(workbook: ExcelJS.Workbook, options: ExportOptions): Promise<void> {
    const events = await this.fetchEvents(options);
    
    const sheet = workbook.addWorksheet('事件历史', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = [
      { header: '事件ID', key: 'id', width: 36 },
      { header: '实体ID', key: 'aggregateId', width: 36 },
      { header: '实体类型', key: 'aggregateType', width: 12 },
      { header: '事件类型', key: 'eventType', width: 25 },
      { header: '版本', key: 'version', width: 8 },
      { header: '操作人ID', key: 'operatorId', width: 36 },
      { header: '创建时间', key: 'createdAt', width: 20 },
    ];

    events.forEach((event) => {
      sheet.addRow({
        id: event.id,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        eventType: event.eventType,
        version: event.version,
        operatorId: event.operatorId,
        createdAt: dayjs(event.createdAt).format('YYYY-MM-DD HH:mm:ss'),
      });
    });

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  }

  private async exportToMarkdown(filePath: string, options: ExportOptions): Promise<void> {
    let content = `# 客服跟进系统导出报告\n\n`;
    content += `生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n\n`;
    content += `---\n\n`;

    if (options.type === 'tickets' || options.type === 'comprehensive') {
      content += await this.generateTicketsMarkdown(options);
    }

    if (options.type === 'followups' || options.type === 'comprehensive') {
      content += await this.generateFollowUpsMarkdown(options);
    }

    if ((options.type === 'events' || options.type === 'comprehensive') && options.includeEvents) {
      content += await this.generateEventsMarkdown(options);
    }

    await fs.writeFile(filePath, content, 'utf-8');
  }

  private async generateTicketsMarkdown(options: ExportOptions): Promise<string> {
    const tickets = await this.fetchTickets(options);
    
    let content = `## 工单列表 (${tickets.length}条)\n\n`;
    content += `| ID | 标题 | 客户 | 状态 | 优先级 | 创建时间 |\n`;
    content += `|----|------|------|------|--------|----------|\n`;

    tickets.forEach((ticket) => {
      content += `| ${ticket.id.substring(0, 8)}... | ${ticket.title.substring(0, 30)}${ticket.title.length > 30 ? '...' : ''} | ${ticket.customerName || '-'} | ${ticket.status} | ${ticket.priority} | ${dayjs(ticket.createdAt).format('YYYY-MM-DD')} |\n`;
    });

    content += '\n';

    if (options.includeDetails) {
      for (const ticket of tickets) {
        content += `### ${ticket.title}\n\n`;
        content += `- **ID**: ${ticket.id}\n`;
        content += `- **状态**: ${ticket.status}\n`;
        content += `- **优先级**: ${ticket.priority}\n`;
        content += `- **客户**: ${ticket.customerName} (${ticket.customerPhone || '-'})\n`;
        if (ticket.description) {
          content += `- **描述**: ${ticket.description}\n`;
        }
        content += '\n';
      }
    }

    return content;
  }

  private async generateFollowUpsMarkdown(options: ExportOptions): Promise<string> {
    const followUps = await this.fetchFollowUps(options);
    
    let content = `## 跟进记录 (${followUps.length}条)\n\n`;

    for (const fu of followUps) {
      content += `### 跟进记录 - ${dayjs(fu.createdAt).format('YYYY-MM-DD HH:mm')}\n\n`;
      content += `- **类型**: ${fu.followUpType}\n`;
      content += `- **状态**: ${fu.status}\n`;
      if (fu.promisedAction) {
        content += `- **承诺动作**: ${fu.promisedAction}\n`;
      }
      if (fu.promisedDeadline) {
        content += `- **截止时间**: ${dayjs(fu.promisedDeadline).format('YYYY-MM-DD HH:mm')}\n`;
      }
      content += `\n**内容**: ${fu.content}\n\n`;
    }

    return content;
  }

  private async generateEventsMarkdown(options: ExportOptions): Promise<string> {
    const events = await this.fetchEvents(options);
    
    let content = `## 事件历史 (${events.length}条)\n\n`;
    content += `| 时间 | 事件类型 | 实体 | 版本 |\n`;
    content += `|------|----------|------|------|\n`;

    events.forEach((event) => {
      content += `| ${dayjs(event.createdAt).format('YYYY-MM-DD HH:mm')} | ${event.eventType} | ${event.aggregateType} | v${event.version} |\n`;
    });

    content += '\n';
    return content;
  }

  private async exportToPDF(filePath: string, options: ExportOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: '客服跟进系统报告',
          Author: 'Customer Follow-up System',
        },
      });

      const stream = doc.pipe(require('fs').createWriteStream(filePath));

      doc.fontSize(20).text('客服跟进系统报告', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`, { align: 'center' });
      doc.moveDown(2);

      this.generatePDFContent(doc, options).then(() => {
        doc.end();
      }).catch(reject);

      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }

  private async generatePDFContent(doc: PDFKit.PDFDocument, options: ExportOptions): Promise<void> {
    if (options.type === 'tickets' || options.type === 'comprehensive') {
      const tickets = await this.fetchTickets(options);
      
      doc.fontSize(16).text(`工单列表 (${tickets.length}条)`);
      doc.moveDown();

      tickets.forEach((ticket, index) => {
        doc.fontSize(12).text(`${index + 1}. ${ticket.title}`);
        doc.fontSize(10).text(`   ID: ${ticket.id}`);
        doc.text(`   客户: ${ticket.customerName || '-'} | 状态: ${ticket.status} | 优先级: ${ticket.priority}`);
        doc.moveDown(0.5);
      });

      doc.moveDown();
    }

    if (options.type === 'followups' || options.type === 'comprehensive') {
      const followUps = await this.fetchFollowUps(options);
      
      doc.fontSize(16).text(`跟进记录 (${followUps.length}条)`);
      doc.moveDown();

      followUps.forEach((fu, index) => {
        doc.fontSize(12).text(`${index + 1}. [${fu.followUpType}] ${dayjs(fu.createdAt).format('YYYY-MM-DD HH:mm')}`);
        doc.fontSize(10).text(`   状态: ${fu.status}`);
        if (fu.promisedDeadline) {
          doc.text(`   截止: ${dayjs(fu.promisedDeadline).format('YYYY-MM-DD HH:mm')}`);
        }
        doc.text(`   ${fu.content.substring(0, 200)}${fu.content.length > 200 ? '...' : ''}`);
        doc.moveDown(0.5);
      });
    }
  }

  private async fetchTickets(options: ExportOptions): Promise<Ticket[]> {
    const where: Record<string, unknown> = {};

    if (options.filters?.status?.length) {
      where['status'] = { [Op.in]: options.filters.status } as any;
    }

    if (options.filters?.priority?.length) {
      where['priority'] = { [Op.in]: options.filters.priority } as any;
    }

    if (options.filters?.assigneeId) {
      where['assigneeId'] = options.filters.assigneeId;
    }

    if (options.filters?.ticketId) {
      where['id'] = options.filters.ticketId;
    }

    if (options.filters?.startDate) {
      where['createdAt'] = { [Op.gte]: options.filters.startDate } as any;
    }

    if (options.filters?.endDate) {
      where['createdAt'] = {
        ...(where['createdAt'] as object),
        [Op.lte]: options.filters.endDate,
      } as any;
    }

    return Ticket.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });
  }

  private async fetchFollowUps(options: ExportOptions): Promise<FollowUp[]> {
    const where: Record<string, unknown> = {};

    if (options.filters?.ticketId) {
      where['ticketId'] = options.filters.ticketId;
    }

    if (options.filters?.startDate) {
      where['createdAt'] = { [Op.gte]: options.filters.startDate } as any;
    }

    if (options.filters?.endDate) {
      where['createdAt'] = {
        ...(where['createdAt'] as object),
        [Op.lte]: options.filters.endDate,
      } as any;
    }

    return FollowUp.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });
  }

  private async fetchEvents(options: ExportOptions): Promise<Event[]> {
    const where: Record<string, unknown> = {};

    if (options.filters?.ticketId) {
      where['aggregateId'] = options.filters.ticketId;
    }

    if (options.filters?.startDate) {
      where['createdAt'] = { [Op.gte]: options.filters.startDate } as any;
    }

    if (options.filters?.endDate) {
      where['createdAt'] = {
        ...(where['createdAt'] as object),
        [Op.lte]: options.filters.endDate,
      } as any;
    }

    return Event.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });
  }

  async getExportFilePath(filename: string): Promise<string> {
    const filePath = path.join(this.storagePath, filename);
    await fs.access(filePath);
    return filePath;
  }

  async cleanupOldExports(): Promise<number> {
    const retentionMs = config.storage.exportRetentionDays * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - retentionMs);

    let deletedCount = 0;

    try {
      const files = await fs.readdir(this.storagePath);
      
      for (const file of files) {
        const filePath = path.join(this.storagePath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} old export files`);
      }
    } catch (error) {
      logger.error('Failed to cleanup old exports:', error);
    }

    return deletedCount;
  }
}

export const exportService = new ExportService();
export default exportService;
